import React, { createContext, useContext, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { AIChatProviderProps } from '../types';
import { useAIChatStore } from '../store/useAIChatStore';

// Expose the return type of useChat mixed with our custom properties
export type UseChatHelpers = ReturnType<typeof useChat>;

export const AIChatContext = createContext<UseChatHelpers | null>(null);

export function AIChatProvider({ children, theme = 'standard', apiEndpoint = '/api/chat', agentId, sessionId, sessionStorageMode, sessionRoute = '/session' }: AIChatProviderProps) {
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

  // Clean up api route and append agentId if provided
  const baseApi = apiEndpoint.endsWith('/') ? apiEndpoint.slice(0, -1) : apiEndpoint;
  const finalApiRoute = agentId ? `${baseApi}/${agentId}` : baseApi;

  // Initialize Vercel AI SDK chat
  const chatHelpers = useChat({
    api: finalApiRoute,
    body: sessionId ? { sessionId } : undefined,
    // Add additional AI SDK configurations here
  });

  return (
    <AIChatContext.Provider value={chatHelpers}>
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
