"use client"
import React, { useEffect, useRef } from 'react';
import { OmniChatProps, A2UILayout } from '../types';
import { AGUIChatProvider } from './AGUIChatProvider';
import { AIChatProvider } from './AIChatProvider';
import { useAIChatStore } from '../store/useAIChatStore';

/**
 * The main wrapper component for OmniChatKit.
 * It initializes the global state, sets up the chat provider based on the `api_mode`,
 * and manages session configurations. All other OmniChatKit components (like `ChatManager`
 * and `SessionManager`) should be rendered inside this provider.
 *
 * @param props - Configuration properties for the OmniChat instance.
 * @returns A wrapped React element providing chat context to its children.
 */
export function OmniChat({
  api_mode,
  theme,
  a2uiProps,
  apiEndpoint,
  chatApiSchema,
  chatManagerProps,
  sessionStorageMode = 'disabled',
  sessionRoute = '/session',
  children
}: OmniChatProps) {
  
  const setApiMode = useAIChatStore((state) => state.setApiMode);
  const setChatApiSchema = useAIChatStore((state) => state.setChatApiSchema);
  const setA2UIProps = useAIChatStore((state) => state.setA2UIProps);

  const isInitialized = useRef(false);
  if (!isInitialized.current) {
    useAIChatStore.setState({
      apiMode: api_mode,
      chatApiSchema: api_mode === 'classic' ? chatApiSchema : undefined,
      a2uiProps
    });
    isInitialized.current = true;
  }

  useEffect(() => {
    setApiMode(api_mode);
    setChatApiSchema(api_mode === 'classic' ? chatApiSchema : undefined);
    if (a2uiProps) {
      setA2UIProps(a2uiProps);
    }
  }, [api_mode, chatApiSchema, setApiMode, setChatApiSchema, a2uiProps, setA2UIProps]);
  
  // Map OmniChat prop 'a2uiRenderingOption' to ChatManager 'layout'
  const a2uiRenderingOption = a2uiProps?.a2uiRenderingOption;
  const chatLayout: A2UILayout = (!!a2uiProps && a2uiRenderingOption === 'detached') ? 'split' : 'inline';

  // Select the appropriate provider based on api_mode
  const Provider = api_mode === 'ag-ui' ? AGUIChatProvider : AIChatProvider;

  // Extract optional connection params from chatManagerProps
  const agentId = chatManagerProps?.agentId;
  const sessionId = chatManagerProps?.sessionId;
  const normalizedSessionRoute = sessionRoute.startsWith('/') ? sessionRoute : `/${sessionRoute}`;

  // Render the provider, children, and automatically inject the ChatManager
  return (
    <Provider theme={theme} apiEndpoint={apiEndpoint} agentId={agentId} sessionId={sessionId} sessionStorageMode={sessionStorageMode} sessionRoute={normalizedSessionRoute} chatApiSchema={api_mode === 'classic' ? chatApiSchema : undefined}>
      <div className="flex w-full h-full gap-4">
        {children}
      </div>
    </Provider>
  );
}
