import { useCallback } from 'react';
import { useAIChatStore } from '../store/useAIChatStore';
import { HITLState } from '../types';

export function useHITL(): HITLState {
  const pendingHITLAction = useAIChatStore((state) => state.pendingHITLAction);
  const setPendingHITLAction = useAIChatStore((state) => state.setPendingHITLAction);
  const resumeExecution = useAIChatStore((state) => state.resumeExecution);

  const approve = useCallback((modifiedPayload?: any) => {
    if (!pendingHITLAction) return;
    const finalPayload = modifiedPayload || pendingHITLAction.payload;
    resumeExecution({ status: 'approved', payload: finalPayload });
    setPendingHITLAction(null);
  }, [pendingHITLAction, resumeExecution, setPendingHITLAction]);

  const reject = useCallback((reason?: string) => {
    if (!pendingHITLAction) return;
    resumeExecution({ status: 'rejected', reason: reason || 'User rejected the action.' });
    setPendingHITLAction(null);
  }, [pendingHITLAction, resumeExecution, setPendingHITLAction]);

  return {
    isActive: pendingHITLAction !== null,
    pendingAction: pendingHITLAction,
    approve,
    reject,
  };
}
