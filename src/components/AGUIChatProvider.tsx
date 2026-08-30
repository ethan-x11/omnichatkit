import React, { createContext, useContext, useEffect } from 'react';
import { useAGUIChat } from '../hooks/useAGUIChat';
import { AIChatProviderProps } from '../types';
import { useAIChatStore } from '../store/useAIChatStore';
import { UseChatHelpers } from './AIChatProvider';

export const AGUIChatContext = createContext<UseChatHelpers | null>(null);

export function AGUIChatProvider({ children, theme = 'standard', apiEndpoint = '/api/agent', agentId, sessionId, sessionStorageMode, sessionRoute = '/session' }: AIChatProviderProps) {
  const setTheme = useAIChatStore((state) => state.setTheme);
  const setSessionStorageMode = useAIChatStore((state) => state.setSessionStorageMode);
  const setSessionRoute = useAIChatStore((state) => state.setSessionRoute);
  const setSessions = useAIChatStore((state) => state.setSessions);

  // Initialize store with props
  useEffect(() => {
    setTheme(theme);
    if (sessionStorageMode) setSessionStorageMode(sessionStorageMode);
    if (sessionRoute) setSessionRoute(sessionRoute);
  }, [theme, sessionStorageMode, sessionRoute, setTheme, setSessionStorageMode, setSessionRoute]);

  // Fetch initial sessions if API mode
  useEffect(() => {
    if (sessionStorageMode === 'api' && sessionRoute) {
      fetch(sessionRoute)
        .then(res => {
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            return res.json();
          }
          throw new Error("Expected JSON response");
        })
        .then(data => {
          if (Array.isArray(data)) setSessions(data);
        })
        .catch(err => console.error('Failed to load sessions:', err));
    }
  }, [sessionStorageMode, sessionRoute, setSessions]);

  const activeSessionId = useAIChatStore((state) => state.activeSessionId);

  // Initialize AG-UI chat via custom hook
  const chatHelpers = useAGUIChat({
    api: apiEndpoint,
    body: activeSessionId ? { sessionId: activeSessionId } : (sessionId ? { sessionId } : undefined),
    agentId
  });

  return (
    <AGUIChatContext.Provider value={chatHelpers}>
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
