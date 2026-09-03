import { useState, useCallback, useRef, useEffect } from 'react';
import { HttpAgent } from '@ag-ui/client';
import { Message as AGUIMessage, Role, BaseEvent } from '@ag-ui/core';
import { UseChatHelpers } from '../components/AIChatProvider';

/**
 * Adapts the `@ag-ui/client` `HttpAgent` to match the Vercel AI SDK `useChat` API surface.
 * Handles state, streaming, tool executions, and action synchronization for the Agentic UI.
 *
 * @param config - Configuration options.
 * @param config.api - The base URL of the Agentic UI backend endpoint.
 * @param config.body - Additional body parameters to send with requests, such as `sessionId`.
 * @param config.agentId - The specific agent identifier, appended to the API route.
 * @returns An object matching the Vercel AI SDK `UseChatHelpers` interface, plus custom event data.
 */
export function useAGUIChat({ api, body, agentId }: { api: string; body?: Record<string, any>; agentId?: string }): UseChatHelpers {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitted' | 'streaming' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<Error | undefined>(undefined);
  const [events, setEvents] = useState<BaseEvent[]>([]);
  const agentRef = useRef<HttpAgent | null>(null);
  const agentSessionIdRef = useRef<string | undefined>(body?.sessionId);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<any[]>([]);
  const lastAssistantResponseRef = useRef('');

  // Minimal placeholder implementation for UseChatHelpers 
  const data = undefined;

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const createAgent = useCallback((currentSessionId?: string) => {
    const baseApi = api.endsWith('/') ? api.slice(0, -1) : api;
    const finalApiUrl = agentId ? `${baseApi}/${agentId}` : baseApi;

    return new HttpAgent({
      url: finalApiUrl,
      threadId: currentSessionId,
      fetch: (fetchUrl, init) => fetch(fetchUrl, {
        ...init,
        signal: abortControllerRef.current?.signal || init?.signal
      })
    });
  }, [agentId, api]);

  useEffect(() => {
    const currentSessionId = body?.sessionId;
    agentRef.current = createAgent(currentSessionId);
    agentSessionIdRef.current = currentSessionId;

    return () => {
      agentRef.current?.abortRun();
    };
  }, [body?.sessionId, createAgent]);

  const handleInputChange = useCallback((e: any) => {
    setInput(e.target.value);
  }, []);

  const stop = useCallback(() => {
    agentRef.current?.abortRun();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setStatus('ready');
    setMessages((prev) => {
      const lastMsg = prev[prev.length - 1];
      if (lastMsg && lastMsg.role === 'system' && lastMsg.content === 'Response Stopped') {
        return prev;
      }
      return [...prev, {
        id: Date.now().toString(),
        role: 'system',
        content: 'Response Stopped'
      }];
    });
  }, []);

  const append = useCallback(async (message: any, chatRequestOptions?: any) => {
    const requestedSessionId = chatRequestOptions?.body?.sessionId ?? body?.sessionId;
    if (requestedSessionId !== agentSessionIdRef.current) {
      agentRef.current?.abortRun();
      agentRef.current = createAgent(requestedSessionId);
      agentSessionIdRef.current = requestedSessionId;
    }

    if (!agentRef.current) return '';
    const newMessage = {
      ...message,
      id: message.id || Date.now().toString(),
    };
    
    // Optimistic UI
    const previousMessages = messagesRef.current;
    messagesRef.current = [...previousMessages, newMessage];
    lastAssistantResponseRef.current = '';
    setMessages(messagesRef.current);
    setStatus('submitted');
    setError(undefined);
    setEvents([]);
    
    try {
      const aguiMessages = messagesRef.current.map(m => ({
        ...m
      })) as AGUIMessage[];

      setStatus('streaming');
      agentRef.current.setMessages(aguiMessages);
      
      abortControllerRef.current = new AbortController();
      
      const result = await agentRef.current.runAgent({}, {
        onEvent: (params) => {
          setEvents((prev) => [...prev, params.event]);
        },
        onMessagesChanged: (params) => {
          // As the stream happens, AG-UI accumulates messages in params.messages
          if (params.messages && params.messages.length > 0) {
            const processedMessages: any[] = [];
            params.messages.forEach(m => {
              if (m.role === 'tool') {
                const toolCallId = (m as any).tool_call_id || (m as any).toolCallId || m.id;
                // Find ai message with this tool invocation
                const aiMsg = processedMessages.find(pm => pm.toolInvocations?.some((t: any) => t.toolCallId === toolCallId));
                if (aiMsg) {
                  const toolInv = aiMsg.toolInvocations.find((t: any) => t.toolCallId === toolCallId);
                  if (toolInv) {
                    toolInv.result = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
                  }
                } else {
                  processedMessages.push({
                    id: m.id || Date.now().toString(),
                    role: m.role,
                    content: typeof m.content === 'string' ? m.content : '',
                    toolCallId
                  });
                }
              } else {
                const toolCalls = (m as any).toolCalls || (m as any).tool_calls;
                const toolInvocations = toolCalls?.length > 0 ? toolCalls.map((t: any) => {
                  const name = t.name || (t.function && t.function.name) || t.toolName || 'Unknown Tool';
                  let args = t.args || (t.function && t.function.arguments);
                  
                  // Safely parse args
                  let parsedArgs = args;
                  if (typeof args === 'string') {
                    if (args.trim() === '') {
                      parsedArgs = {};
                    } else {
                      try {
                        parsedArgs = JSON.parse(args);
                      } catch (e) {
                        // Keep as partial string during streaming
                        parsedArgs = args;
                      }
                    }
                  } else if (!args) {
                    parsedArgs = {};
                  }

                  return {
                    toolCallId: t.id || t.toolCallId || Math.random().toString(),
                    toolName: name,
                    args: parsedArgs
                  };
                }) : undefined;
  
                processedMessages.push({
                  id: m.id || Date.now().toString(),
                  role: m.role,
                  content: typeof m.content === 'string' ? m.content : '',
                  toolInvocations
                });
              }
            });
            messagesRef.current = processedMessages;
            const latestAssistantMessage = [...processedMessages].reverse().find((message) => message.role === 'assistant');
            if (typeof latestAssistantMessage?.content === 'string' && latestAssistantMessage.content) {
              lastAssistantResponseRef.current = latestAssistantMessage.content;
            }
            setMessages(processedMessages);
          }
        },
      });
      
      setStatus('ready');
      return lastAssistantResponseRef.current;
    } catch (err) {
      const isAborted = String(err).toLowerCase().includes('aborted') || (err instanceof Error && err.name === 'AbortError');
      if (isAborted) {
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.role === 'system' && lastMsg.content === 'Response Stopped') return prev;
          return [...prev, {
            id: Date.now().toString(),
            role: 'system',
            content: 'Response Stopped'
          }];
        });
      } else {
        setError(err instanceof Error ? err : new Error(String(err)));
        setStatus('error');
      }
      return '';
    }
  }, [body?.sessionId, createAgent]);

  const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>, chatRequestOptions?: any) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    const content = input;
    setInput('');
    void append({ role: 'user', content }, chatRequestOptions);
  }, [input, append]);

  const reload = useCallback(async () => {
    if (messages.length > 0) {
      const lastUserMsgIndex = [...messages].reverse().findIndex(m => m.role === 'user');
      if (lastUserMsgIndex !== -1) {
        const actualIndex = messages.length - 1 - lastUserMsgIndex;
        const newMessages = messages.slice(0, actualIndex);
        const retryMsg = messages[actualIndex];
        setMessages(newMessages);
        await append(retryMsg);
        return '';
      }
    }
    return '';
  }, [messages, append]);
  
  const addToolResult = useCallback(({ toolCallId, result }: any) => {
    // Unsupported natively here, but implemented for type compliance
  }, []);

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    status,
    error,
    stop,
    append,
    reload,
    setInput,
    setMessages,
    addToolResult,
    data,
    isLoading: status === 'submitted' || status === 'streaming',
    events,
  } as unknown as UseChatHelpers & { events: BaseEvent[] };
}
