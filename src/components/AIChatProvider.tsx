import React, { createContext, useContext, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { AIChatProviderProps } from '../types';
import { useAIChatStore } from '../store/useAIChatStore';
import { createSessionTitlePrompt, normalizeSessionTitle } from '../lib/session-title';
import type { SessionTitleMessage } from '../lib/session-title';
import type { StorageMode } from '../types';

// Expose the return type of useChat mixed with our custom properties
export type UseChatHelpers = ReturnType<typeof useChat>;
export type ChatContextHelpers = UseChatHelpers & {
  sessionStorageMode: StorageMode;
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  append: (message: any, requestOptions?: any) => Promise<any>;
  handleSubmit: (event?: { preventDefault?: () => void }, requestOptions?: any) => void;
};

export const AIChatContext = createContext<ChatContextHelpers | null>(null);

import { DefaultChatTransport } from 'ai';

/**
 * Provides the chat state context using the Vercel AI SDK (`useChat` hook) internally.
 * This is the classic mode provider where the AI backend returns standard AI streams.
 *
 * @param props - Provider configuration.
 * @returns A context provider wrapping the chat UI components.
 */
export function AIChatProvider({ children, theme = 'standard', apiEndpoint = '/api/chat', agentId, sessionId, sessionStorageMode = 'disabled', sessionRoute = '/session', chatApiSchema }: AIChatProviderProps) {
  const [input, setInput] = React.useState('');
  const setTheme = useAIChatStore((state) => state.setTheme);
  const setSessionStorageMode = useAIChatStore((state) => state.setSessionStorageMode);
  const setSessionRoute = useAIChatStore((state) => state.setSessionRoute);
  const loadSessions = useAIChatStore((state) => state.loadSessions);
  const ensureSession = useAIChatStore((state) => state.ensureSession);
  const renameSession = useAIChatStore((state) => state.renameSession);
  const activeSessionId = useAIChatStore((state) => state.activeSessionId);

  // Initialize store with props
  useEffect(() => {
    setTheme(theme);
    if (sessionStorageMode) setSessionStorageMode(sessionStorageMode);
    if (sessionRoute) setSessionRoute(sessionRoute);
  }, [theme, sessionStorageMode, sessionRoute, setTheme, setSessionStorageMode, setSessionRoute]);

  // Fetch initial sessions if API mode
  useEffect(() => {
    if (sessionStorageMode === 'api' && sessionRoute) {
      loadSessions().catch((error) => console.error('Failed to load sessions:', error));
    }
  }, [sessionStorageMode, sessionRoute, loadSessions]);

  // Clean up api route and append agentId if provided
  const baseApi = apiEndpoint.endsWith('/') ? apiEndpoint.slice(0, -1) : apiEndpoint;
  const finalApiRoute = agentId ? `${baseApi}/${agentId}` : baseApi;
  const sessionsEnabled = sessionStorageMode !== 'disabled';
  const effectiveSessionId = sessionsEnabled ? activeSessionId ?? sessionId : undefined;

  // Build a stable prepareRequestBody function when chatApiSchema.apiRequestSchema is provided
  const prepareRequestBody = React.useMemo(() => {
    return (params: { messages: any[]; requestBody?: Record<string, unknown> }) => {
      let finalMessages = params.messages;
      
      // Intercept sendHistory flag from request body
      if (params.requestBody && params.requestBody.sendHistory === false) {
        finalMessages = finalMessages.length > 0 ? [finalMessages[finalMessages.length - 1]] : [];
      }

      const reqSchema = chatApiSchema?.apiRequestSchema;
      if (!reqSchema) {
        return {
          messages: finalMessages,
          ...(params.requestBody ?? {}),
        };
      }

      const { messagesKey = 'messages', userMessageKey, extraBody, transform } = reqSchema;
      const base: Record<string, unknown> = {
        ...extraBody,
        [messagesKey]: finalMessages,
        ...(userMessageKey
          ? { [userMessageKey]: finalMessages.at(-1)?.content ?? '' }
          : {}),
        ...(params.requestBody ?? {}),
      };
      return transform ? transform(base) : base;
    };
  }, [chatApiSchema]);

  // Initialize Vercel AI SDK chat
  const chatHelpers = useChat({
    transport: new DefaultChatTransport({
      api: finalApiRoute,
      body: effectiveSessionId ? { sessionId: effectiveSessionId } : undefined,
      prepareSendMessagesRequest: prepareRequestBody as any,
    }),
    // Add additional AI SDK configurations here
  });
  const titleResponseRef = React.useRef('');
  const titleChatIdRef = React.useRef(`omnichatkit-title-${Math.random().toString(36).slice(2)}`);
  const autoTitledSessionIdsRef = React.useRef(new Set<string>());
  const titleChatHelpers = useChat({
    id: titleChatIdRef.current,
    transport: new DefaultChatTransport({
      api: finalApiRoute,
      body: { sessionOperation: 'generate-title', transient: true },
    }),
    onFinish: (event) => {
      const textPart = event.message.parts?.find((p: any) => p.type === 'text');
      titleResponseRef.current = textPart && 'text' in textPart ? textPart.text : '';
    },
  });

  const generateInitialSessionTitle = React.useCallback(async (messages: SessionTitleMessage[]) => {
    if (!sessionsEnabled) {
      throw new Error('Session titles require sessionStorageMode to be "memory" or "api".');
    }

    titleResponseRef.current = '';
    titleChatHelpers.setMessages([]);

    try {
      await titleChatHelpers.sendMessage(
        { role: 'user', content: createSessionTitlePrompt(messages) } as any,
        { body: { sessionOperation: 'generate-title', transient: true } } as any,
      );
      const lastMessage = titleChatHelpers.messages.at(-1);
      const textPart = lastMessage?.parts?.find(p => p.type === 'text');
      const textContent = textPart && 'text' in textPart ? textPart.text : '';
      const title = normalizeSessionTitle(titleResponseRef.current || textContent);
      if (!title) throw new Error('The agent returned an empty session title.');
      return title;
    } finally {
      titleChatHelpers.setMessages([]);
    }
  }, [sessionsEnabled, titleChatHelpers.sendMessage, titleChatHelpers.messages, titleChatHelpers.setMessages]);

  const sessionAwareAppend = React.useCallback(async (message: any, requestOptions?: any) => {
    if (!sessionsEnabled) {
      return chatHelpers.sendMessage(message, requestOptions);
    }

    const stateBeforeAppend = useAIChatStore.getState();
    const requestedSessionId = requestOptions?.body?.sessionId ?? sessionId;
    const activeSession = stateBeforeAppend.sessions.find((session) => session.id === stateBeforeAppend.activeSessionId);
    // A title is generated only for the first message of a newly created
    // conversation. A configured initial sessionId must not suppress this
    // after the user has explicitly opened a new conversation.
    const isNewSession = !stateBeforeAppend.activeSessionId
      ? !requestedSessionId
      : activeSession?.title === 'New Session' && !activeSession.messages?.length;
    const firstMessage = typeof message.content === 'string' ? message.content : 'New Session';
    const resolvedSessionId = await ensureSession(firstMessage, requestedSessionId);
    const response = chatHelpers.sendMessage(message, {
      ...requestOptions,
      body: { ...requestOptions?.body, ...(resolvedSessionId ? { sessionId: resolvedSessionId } : {}) },
    } as any);

    if (isNewSession && resolvedSessionId && !autoTitledSessionIdsRef.current.has(resolvedSessionId)) {
      autoTitledSessionIdsRef.current.add(resolvedSessionId);
      void generateInitialSessionTitle([{ role: message.role, content: message.content }])
        .then((title) => renameSession(resolvedSessionId, title))
        .catch((error) => console.error('Failed to generate a title for the new session:', error));
    }

    return response;
  }, [chatHelpers.sendMessage, ensureSession, generateInitialSessionTitle, renameSession, sessionId, sessionsEnabled]);

  const sessionAwareHandleSubmit = React.useCallback((event?: { preventDefault?: () => void }, requestOptions?: any) => {
    event?.preventDefault?.();
    const content = input.trim();
    if (!content) return;

    setInput('');
    void sessionAwareAppend({ role: 'user', content } as any, requestOptions);
  }, [input, setInput, sessionAwareAppend]);

  const chatContextValue = React.useMemo(() => ({
    ...chatHelpers,
    input,
    setInput,
    append: sessionAwareAppend,
    handleSubmit: sessionAwareHandleSubmit,
    sessionStorageMode,
  }), [chatHelpers, input, setInput, sessionAwareAppend, sessionAwareHandleSubmit, sessionStorageMode]);

  return (
    <AIChatContext.Provider value={chatContextValue}>
      {children}
    </AIChatContext.Provider>
  );
}

/**
 * Accesses the chat context provided by `AIChatProvider`.
 * @returns The chat helpers provided by Vercel AI SDK and custom store configurations.
 */
export function useAIChatContext() {
  const context = useContext(AIChatContext);
  if (!context) {
    throw new Error('useAIChatContext must be used within an AIChatProvider');
  }
  return context;
}
