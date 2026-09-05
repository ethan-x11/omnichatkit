import React, { createContext, useContext, useEffect } from 'react';
import { useAGUIChat } from '../hooks/useAGUIChat';
import { AIChatProviderProps } from '../types';
import { useAIChatStore } from '../store/useAIChatStore';
import type { ChatContextHelpers } from './AIChatProvider';
import { createSessionTitlePrompt, normalizeSessionTitle } from '../lib/session-title';
import type { SessionTitleMessage } from '../lib/session-title';

export const AGUIChatContext = createContext<ChatContextHelpers | null>(null);

/**
 * Provides the chat state context using the custom `useAGUIChat` hook.
 * This is used for the Agentic UI API mode, handling structured JSON actions.
 *
 * @param props - Provider configuration.
 * @returns A context provider wrapping the chat UI components.
 */
export function AGUIChatProvider({ children, theme = 'standard', apiEndpoint = '/api/agent', agentId, sessionId, sessionStorageMode = 'disabled', sessionRoute = '/session' }: AIChatProviderProps) {
  const setTheme = useAIChatStore((state) => state.setTheme);
  const setSessionStorageMode = useAIChatStore((state) => state.setSessionStorageMode);
  const setSessionRoute = useAIChatStore((state) => state.setSessionRoute);
  const loadSessions = useAIChatStore((state) => state.loadSessions);
  const ensureSession = useAIChatStore((state) => state.ensureSession);
  const renameSession = useAIChatStore((state) => state.renameSession);

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
  const autoTitledSessionIdsRef = React.useRef(new Set<string>());
  const titleChatHelpers = useAGUIChat({
    api: apiEndpoint,
    agentId,
  });

  const generateInitialSessionTitle = React.useCallback(async (messages: SessionTitleMessage[]) => {
    if (!sessionsEnabled) {
      throw new Error('Session titles require sessionStorageMode to be "memory" or "api".');
    }

    titleChatHelpers.setMessages([]);

    try {
      const response = await titleChatHelpers.append({
        role: 'user',
        content: createSessionTitlePrompt(messages),
      });
      const lastMessage = titleChatHelpers.messages.at(-1);
      const textPart = lastMessage?.parts?.find((p: any) => p.type === 'text');
      const textContent = textPart && 'text' in textPart ? textPart.text : '';
      const title = normalizeSessionTitle(response || textContent);
      if (!title) throw new Error('The agent returned an empty session title.');
      return title;
    } finally {
      titleChatHelpers.setMessages([]);
    }
  }, [sessionsEnabled, titleChatHelpers.append, titleChatHelpers.messages, titleChatHelpers.setMessages]);

  const sessionAwareAppend = React.useCallback(async (message: any, requestOptions?: any) => {
    if (!sessionsEnabled) {
      return chatHelpers.append(message, requestOptions);
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
    const response = chatHelpers.append(message, {
      ...requestOptions,
      body: { ...requestOptions?.body, ...(resolvedSessionId ? { sessionId: resolvedSessionId } : {}) },
    });

    if (isNewSession && resolvedSessionId && !autoTitledSessionIdsRef.current.has(resolvedSessionId)) {
      autoTitledSessionIdsRef.current.add(resolvedSessionId);
      void generateInitialSessionTitle([{ role: message.role, content: message.content }])
        .then((title) => renameSession(resolvedSessionId, title))
        .catch((error) => console.error('Failed to generate a title for the new session:', error));
    }

    return response;
  }, [chatHelpers.append, ensureSession, generateInitialSessionTitle, renameSession, sessionId, sessionsEnabled]);

  const sessionAwareHandleSubmit = React.useCallback((event?: { preventDefault?: () => void }, requestOptions?: any) => {
    event?.preventDefault?.();
    const content = chatHelpers.input.trim();
    if (!content) return;

    chatHelpers.setInput('');
    void sessionAwareAppend({ role: 'user', content }, requestOptions);
  }, [chatHelpers.input, chatHelpers.setInput, sessionAwareAppend]);

  const chatContextValue = React.useMemo(() => ({
    ...chatHelpers,
    append: sessionAwareAppend,
    handleSubmit: sessionAwareHandleSubmit,
    sessionStorageMode,
  }), [chatHelpers, sessionAwareAppend, sessionAwareHandleSubmit, sessionStorageMode]);

  return (
    <AGUIChatContext.Provider value={chatContextValue}>
      {children}
    </AGUIChatContext.Provider>
  );
}

/**
 * Accesses the chat context provided by `AGUIChatProvider`.
 * @returns The custom AGUI chat helpers and store configurations.
 */
export function useAGUIChatContext() {
  const context = useContext(AGUIChatContext);
  if (!context) {
    throw new Error('useAGUIChatContext must be used within an AGUIChatProvider');
  }
  return context;
}
