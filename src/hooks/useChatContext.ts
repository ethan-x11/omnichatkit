import React from 'react';
import { AIChatContext } from '../components/AIChatProvider';
import { AGUIChatContext } from '../components/AGUIChatProvider';
import { useAIChatStore } from '../store/useAIChatStore';
import type { ChatContextHelpers } from '../components/AIChatProvider';

/**
 * `useChatContext` is a convenience hook that automatically returns the correct
 * chat context — either {@link AIChatContext} (classic) or {@link AGUIChatContext}
 * (ag-ui) — based on whichever provider is present in the React tree.
 *
 * When used inside `<OmniChat>`, the correct provider is rendered automatically.
 * When both providers are somehow present simultaneously, `apiMode` from the store
 * (set by `<OmniChat api_mode="...">`) is used as a tiebreaker.
 *
 * This hook intentionally does NOT rely on the `apiMode` store value as the primary
 * signal to avoid race conditions: `useEffect` (which syncs `api_mode` to the store)
 * runs after the first render, meaning the store default would always win on mount.
 *
 * @throws If neither context is available in the React tree.
 *
 * @example
 * const { messages, append, status } = useChatContext();
 */
export function useChatContext(): ChatContextHelpers {
  const apiMode = useAIChatStore((state) => state.apiMode);

  const aiContext = React.useContext(AIChatContext);
  const aguiContext = React.useContext(AGUIChatContext);

  // Fast paths: only one provider in the tree — no ambiguity, no store needed.
  if (aiContext && !aguiContext) return aiContext;
  if (aguiContext && !aiContext) return aguiContext;

  // Both providers are present: use apiMode as the tiebreaker.
  if (aiContext && aguiContext) {
    return apiMode === 'ag-ui' ? aguiContext : aiContext;
  }

  // Neither context is available.
  throw new Error(
    'useChatContext: No AIChatProvider or AGUIChatProvider found in the React tree. ' +
    'Wrap your component with one of those providers or with <OmniChat>.'
  );
}
