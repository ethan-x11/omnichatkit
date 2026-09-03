import { useCallback } from 'react';
import { useAIChatContext } from '../components/AIChatProvider';
import { InterruptState } from '../types';

/**
 * Hook to manage interrupt signals for the active chat stream.
 * Allows the user to halt a generation in progress.
 *
 * @returns The interrupt state, including whether the stream is active and functions to cancel it.
 */
export function useInterrupts(): InterruptState {
  const { stop, status } = useAIChatContext();
  const isLoading = status === 'submitted' || status === 'streaming';
  
  const haltStream = useCallback(() => {
    if (isLoading) {
      stop();
    }
  }, [isLoading, stop]);

  const cancelTool = useCallback(() => {
    // In Vercel AI SDK, `stop()` will also abort the request on the client side.
    if (isLoading) {
      stop();
    }
  }, [isLoading, stop]);

  return {
    isStreaming: isLoading,
    isExecutingTool: false, 
    haltStream,
    cancelTool,
  };
}
