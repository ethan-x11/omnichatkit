"use client"
import React, { useEffect } from 'react';
import { OmniChatProps, A2UILayout } from '../types';
import { AGUIChatProvider } from './AGUIChatProvider';
import { AIChatProvider } from './AIChatProvider';
import { useAIChatStore } from '../store/useAIChatStore';

export function OmniChat({
  api_mode,
  theme,
  useA2UI = true,
  a2uiProps,
  apiEndpoint,
  chatManagerProps,
  sessionStorageMode = 'disabled',
  sessionRoute = '/session',
  children
}: OmniChatProps) {
  
  const setCatalog = useAIChatStore((state) => state.setCatalog);
  const setIncludeBasicCatalog = useAIChatStore((state) => state.setIncludeBasicCatalog);
  const setA2uiToolName = useAIChatStore((state) => state.setA2uiToolName);
  const setA2uiVersion = useAIChatStore((state) => state.setA2uiVersion);
  const setApiMode = useAIChatStore((state) => state.setApiMode);

  useEffect(() => {
    setApiMode(api_mode);
    if (useA2UI && a2uiProps) {
      if (a2uiProps.catalog) setCatalog(a2uiProps.catalog);
      if (a2uiProps.includeBasicCatalog !== undefined) setIncludeBasicCatalog(a2uiProps.includeBasicCatalog);
      if (a2uiProps.a2uiToolName) setA2uiToolName(a2uiProps.a2uiToolName);
      if (a2uiProps.a2uiVersion) setA2uiVersion(a2uiProps.a2uiVersion);
    }
  }, [api_mode, useA2UI, a2uiProps, setApiMode, setCatalog, setIncludeBasicCatalog, setA2uiToolName, setA2uiVersion]);
  
  // Map OmniChat prop 'a2uiRenderingOption' to ChatManager 'layout'
  const chatLayout: A2UILayout = (useA2UI && a2uiProps?.a2uiRenderingOption === 'detached') ? 'split' : 'inline';

  // Select the appropriate provider based on api_mode
  const Provider = api_mode === 'ag-ui' ? AGUIChatProvider : AIChatProvider;

  // Extract optional connection params from chatManagerProps
  const agentId = chatManagerProps?.agentId;
  const sessionId = chatManagerProps?.sessionId;
  const normalizedSessionRoute = sessionRoute.startsWith('/') ? sessionRoute : `/${sessionRoute}`;

  // Render the provider, children, and automatically inject the ChatManager
  return (
    <Provider theme={theme} apiEndpoint={apiEndpoint} agentId={agentId} sessionId={sessionId} sessionStorageMode={sessionStorageMode} sessionRoute={normalizedSessionRoute}>
      <div className="flex w-full h-full gap-4">
        {children}
      </div>
    </Provider>
  );
}
