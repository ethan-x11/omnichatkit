import React from 'react';
import { AIChatContext } from '../components/AIChatProvider';
import { AGUIChatContext } from '../components/AGUIChatProvider';
import { useAIChatStore } from '../store/useAIChatStore';
import type { ChatContextHelpers } from '../components/AIChatProvider';

/**
 * `useChatContext` is a convenience hook that automatically returns the correct
 * chat context — either {@link AIChatContext} (classic) or {@link AGUIChatContext}
 * (ag-ui) — based on the `api_mode` prop passed to the nearest `<OmniChat>` wrapper.
 *
 * It can also be used outside of `<OmniChat>` by consuming either provider directly;
 * in that case it falls back to whichever context is available in the tree.
 *
 * @throws If neither context is available in the React tree.
 *
 * @example
 * // Inside any component rendered within <OmniChat api_mode="ag-ui" ...>
 * const { messages, append, status } = useChatContext();
 */
export function useChatContext(): ChatContextHelpers {
  const apiMode = useAIChatStore((state) => state.apiMode);

  const aiContext = React.useContext(AIChatContext);
  const aguiContext = React.useContext(AGUIChatContext);

  // If api_mode was explicitly registered by OmniChat, honour it.
  if (apiMode === 'ag-ui') {
    if (!aguiContext) {
      throw new Error(
        'useChatContext: api_mode is "ag-ui" but no AGUIChatProvider was found in the React tree. ' +
        'Wrap your component with <AGUIChatProvider> or <OmniChat api_mode="ag-ui">.'
      );
    }
    return aguiContext;
  }

  if (apiMode === 'classic') {
    if (!aiContext) {
      throw new Error(
        'useChatContext: api_mode is "classic" but no AIChatProvider was found in the React tree. ' +
        'Wrap your component with <AIChatProvider> or <OmniChat api_mode="classic">.'
      );
    }
    return aiContext;
  }

  // Fallback: return whichever context is present (for direct provider usage without OmniChat).
  const context = aiContext ?? aguiContext;
  if (!context) {
    throw new Error(
      'useChatContext: No AIChatProvider or AGUIChatProvider found in the React tree. ' +
      'Wrap your component with one of those providers or with <OmniChat>.'
    );
  }
  return context;
}
