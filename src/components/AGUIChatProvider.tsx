import React, { createContext, useContext, useEffect } from 'react';
import { useAGUIChat } from '../hooks/useAGUIChat';
import { AIChatProviderProps } from '../types';
import { useAIChatStore } from '../store/useAIChatStore';
import type { ChatContextHelpers } from './AIChatProvider';
import { createSessionTitlePrompt, normalizeSessionTitle } from '../lib/session-title';
import type { SessionTitleMessage } from '../lib/session-title';

export const AGUIChatContext = createContext<ChatContextHelpers | null>(null);

export function AGUIChatProvider({ children, theme = 'standard', apiEndpoint = '/api/agent', agentId, sessionId, sessionStorageMode = 'disabled', sessionRoute = '/session' }: AIChatProviderProps) {
  const setTheme = useAIChatStore((state) => state.setTheme);
  const setSessionStorageMode = useAIChatStore((state) => state.setSessionStorageMode);
  const setSessionRoute = useAIChatStore((state) => state.setSessionRoute);
  const loadSessions = useAIChatStore((state) => state.loadSessions);
  const ensureSession = useAIChatStore((state) => state.ensureSession);

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

  const activeSessionId = useAIChatStore((state) => state.activeSessionId);
  const sessionsEnabled = sessionStorageMode !== 'disabled';

  // Initialize AG-UI chat via custom hook
  const chatHelpers = useAGUIChat({
    api: apiEndpoint,
    body: sessionsEnabled ? (activeSessionId ? { sessionId: activeSessionId } : (sessionId ? { sessionId } : undefined)) : undefined,
    agentId
  });
  const [isGeneratingSessionTitle, setIsGeneratingSessionTitle] = React.useState(false);
  const titleChatHelpers = useAGUIChat({
    api: apiEndpoint,
    agentId,
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

    titleChatHelpers.setMessages([]);
    setIsGeneratingSessionTitle(true);

    try {
      const response = await titleChatHelpers.append({
        role: 'user',
        content: createSessionTitlePrompt(messages),
      });
      const title = normalizeSessionTitle(response || titleChatHelpers.messages.at(-1)?.content);
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
    <AGUIChatContext.Provider value={chatContextValue}>
      {children}
    </AGUIChatContext.Provider>
  );
}

export function useAGUIChatContext() {
  const context = useContext(AGUIChatContext);
  if (!context) {
    throw new Error('useAGUIChatContext must be used within an AGUIChatProvider');
  }
  return context;
}
