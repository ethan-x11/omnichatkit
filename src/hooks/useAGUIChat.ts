import { useState, useCallback, useRef, useEffect } from 'react';
import { HttpAgent } from '@ag-ui/client';
import { Message as AGUIMessage, Role, BaseEvent } from '@ag-ui/core';
import { UseChatHelpers } from '../components/AIChatProvider';

// useAGUIChat adapter implements Vercel UseChatHelpers interface for compatibility
// but internally uses @ag-ui/client for state and streaming
export function useAGUIChat({ api, body, agentId }: { api: string; body?: Record<string, any>; agentId?: string }): UseChatHelpers {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitted' | 'streaming' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<Error | undefined>(undefined);
  const [events, setEvents] = useState<BaseEvent[]>([]);
  const agentRef = useRef<HttpAgent | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Minimal placeholder implementation for UseChatHelpers 
  const data = undefined;
  
  useEffect(() => {
    const baseApi = api.endsWith('/') ? api.slice(0, -1) : api;
    const finalApiUrl = agentId ? `${baseApi}/${agentId}` : baseApi;
    const currentSessionId = body?.sessionId;
    
    agentRef.current = new HttpAgent({ 
      url: finalApiUrl,
      threadId: currentSessionId, // Persist proper threadId across streams for the same session, but start fresh when session changes
      fetch: (fetchUrl, init) => fetch(fetchUrl, {
        ...init,
        signal: abortControllerRef.current?.signal || init?.signal
      })
    });
    return () => {
      agentRef.current?.abortRun();
    };
  }, [api, agentId, body?.sessionId]);

  const handleInputChange = useCallback((e: any) => {
    setInput(e.target.value);
  }, []);

  const stop = useCallback(() => {
    agentRef.current?.abortRun();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setStatus('ready');
  }, []);

  const append = useCallback(async (message: any, chatRequestOptions?: any) => {
    if (!agentRef.current) return '';
    const newMessage = {
      id: Date.now().toString(),
      role: message.role as string,
      content: message.content as string,
    };
    
    // Optimistic UI
    setMessages((prev) => [...prev, newMessage]);
    setStatus('submitted');
    
    try {
      const aguiMessages = [...messages, newMessage].map(m => ({
        role: m.role as any,
        content: m.content as string,
        id: m.id
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
            setMessages(processedMessages);
          }
        },
      });
      
      setStatus('ready');
      return '';
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setStatus('error');
      return '';
    }
  }, [messages]);

  const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    const content = input;
    setInput('');
    append({ role: 'user', content });
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
