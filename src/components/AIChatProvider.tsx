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
  generateSessionTitle: (messages: SessionTitleMessage[]) => Promise<string>;
  isGeneratingSessionTitle: boolean;
  sessionStorageMode: StorageMode;
};

export const AIChatContext = createContext<ChatContextHelpers | null>(null);

export function AIChatProvider({ children, theme = 'standard', apiEndpoint = '/api/chat', agentId, sessionId, sessionStorageMode = 'disabled', sessionRoute = '/session' }: AIChatProviderProps) {
  const setTheme = useAIChatStore((state) => state.setTheme);
  const setSessionStorageMode = useAIChatStore((state) => state.setSessionStorageMode);
  const setSessionRoute = useAIChatStore((state) => state.setSessionRoute);
  const loadSessions = useAIChatStore((state) => state.loadSessions);
  const ensureSession = useAIChatStore((state) => state.ensureSession);
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

  // Initialize Vercel AI SDK chat
  const chatHelpers = useChat({
    api: finalApiRoute,
    body: effectiveSessionId ? { sessionId: effectiveSessionId } : undefined,
    // Add additional AI SDK configurations here
  });
  const titleResponseRef = React.useRef('');
  const titleChatIdRef = React.useRef(`omnichatkit-title-${Math.random().toString(36).slice(2)}`);
  const [isGeneratingSessionTitle, setIsGeneratingSessionTitle] = React.useState(false);
  const titleChatHelpers = useChat({
    api: finalApiRoute,
    id: titleChatIdRef.current,
    body: { sessionOperation: 'generate-title', transient: true },
    onFinish: (message) => {
      titleResponseRef.current = message.content;
    },
  });

  const sessionAwareAppend = React.useCallback(async (message: any, requestOptions?: any) => {
    if (!sessionsEnabled) {
      return chatHelpers.append(message, requestOptions);
    }

    const requestedSessionId = requestOptions?.body?.sessionId ?? sessionId;
    const firstMessage = typeof message.content === 'string' ? message.content : 'New Session';
    const resolvedSessionId = await ensureSession(firstMessage, requestedSessionId);

    return chatHelpers.append(message, {
      ...requestOptions,
      body: { ...requestOptions?.body, ...(resolvedSessionId ? { sessionId: resolvedSessionId } : {}) },
    });
  }, [chatHelpers.append, ensureSession, sessionId, sessionsEnabled]);

  const generateSessionTitle = React.useCallback(async (messages: SessionTitleMessage[]) => {
    if (!sessionsEnabled) {
      throw new Error('Session titles require sessionStorageMode to be "memory" or "api".');
    }

    titleResponseRef.current = '';
    titleChatHelpers.setMessages([]);
    setIsGeneratingSessionTitle(true);

    try {
      await titleChatHelpers.append(
        { role: 'user', content: createSessionTitlePrompt(messages) },
        { body: { sessionOperation: 'generate-title', transient: true } },
      );
      const title = normalizeSessionTitle(titleResponseRef.current || titleChatHelpers.messages.at(-1)?.content);
      if (!title) throw new Error('The agent returned an empty session title.');
      return title;
    } finally {
      titleChatHelpers.setMessages([]);
      setIsGeneratingSessionTitle(false);
    }
  }, [sessionsEnabled, titleChatHelpers.append, titleChatHelpers.messages, titleChatHelpers.setMessages]);

  const chatContextValue = React.useMemo(() => ({
    ...chatHelpers,
    append: sessionAwareAppend,
    generateSessionTitle,
    isGeneratingSessionTitle,
    sessionStorageMode,
  }), [chatHelpers, generateSessionTitle, isGeneratingSessionTitle, sessionAwareAppend, sessionStorageMode]);

  return (
    <AIChatContext.Provider value={chatContextValue}>
      {children}
    </AIChatContext.Provider>
  );
}

export function useAIChatContext() {
  const context = useContext(AIChatContext);
  if (!context) {
    throw new Error('useAIChatContext must be used within an AIChatProvider');
  }
  return context;
}
