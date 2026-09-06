"use client"
import React, { useEffect, useRef } from 'react';
import { OmniChatProps, A2UILayout } from '../types';
import { AGUIChatProvider } from './AGUIChatProvider';
import { AIChatProvider } from './AIChatProvider';
import { useAIChatStore, AIChatState } from '../store/useAIChatStore';

/**
 * The main wrapper component for OmniChatKit.
 * It initializes the global state, sets up the chat provider based on the `apiMode`,
 * and manages session configurations. All other OmniChatKit components (like `ChatManager`
 * and `SessionManager`) should be rendered inside this provider.
 *
 * @param props - Configuration properties for the OmniChat instance.
 * @returns A wrapped React element providing chat context to its children.
 */
export function OmniChat({
  apiMode,
  theme,
  a2uiProps,
  apiEndpoint,
  chatApiSchema,
  chatManagerProps,
  sessionStorageMode = 'disabled',
  sessionRoute = '/session',
  children
}: OmniChatProps) {

  const setApiMode = useAIChatStore((state: AIChatState) => state.setApiMode);
  const setChatApiSchema = useAIChatStore((state: AIChatState) => state.setChatApiSchema);
  const setA2UIProps = useAIChatStore((state: AIChatState) => state.setA2UIProps);

  const isInitialized = useRef(false);
  if (!isInitialized.current) {
    useAIChatStore.setState({
      apiMode: apiMode,
      chatApiSchema: apiMode === 'classic' ? chatApiSchema : undefined,
      a2uiProps
    });
    isInitialized.current = true;
  }

  useEffect(() => {
    setApiMode(apiMode);
    setChatApiSchema(apiMode === 'classic' ? chatApiSchema : undefined);
    if (a2uiProps) {
      setA2UIProps(a2uiProps);
    }
  }, [apiMode, chatApiSchema, setApiMode, setChatApiSchema, a2uiProps, setA2UIProps]);

  // Map OmniChat prop 'a2uiRenderingOption' to ChatManager 'layout'
  const a2uiRenderingOption = a2uiProps?.a2uiRenderingOption;
  const chatLayout: A2UILayout = (!!a2uiProps && a2uiRenderingOption === 'detached') ? 'split' : 'inline';

  // Select the appropriate provider based on apiMode
  const Provider = apiMode === 'ag-ui' ? AGUIChatProvider : AIChatProvider;

  // Extract optional connection params from chatManagerProps
  const agentId = chatManagerProps?.agentId;
  const agentDescription = chatManagerProps?.agentDescription;
  const sessionId = chatManagerProps?.sessionId;
  const normalizedSessionRoute = sessionRoute.startsWith('/') ? sessionRoute : `/${sessionRoute}`;

  // Render the provider, children, and automatically inject the ChatManager
  return (
    <Provider theme={theme} apiEndpoint={apiEndpoint} agentId={agentId} agentDescription={agentDescription} sessionId={sessionId} sessionStorageMode={sessionStorageMode} sessionRoute={normalizedSessionRoute} chatApiSchema={apiMode === 'classic' ? chatApiSchema : undefined}>
      <div className="flex w-full h-full gap-4">
        {children}
      </div>
    </Provider>
  );
}
