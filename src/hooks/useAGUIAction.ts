import { useEffect } from 'react';
import { useAIChatStore } from '../store/useAIChatStore';
import { AGUIAction } from '../types';

/**
 * Registers an AG-UI action (tool) to be made available to the agent backend.
 * The action is passed into the RunAgentInput.tools array when useAGUIChat runs.
 * When the backend requests this tool, its handler will be executed.
 * 
 * @param action - The action definition including name, description, parameters schema and a handler.
 */
export function useAGUIAction(action: AGUIAction) {
  const registerAction = useAIChatStore((state) => state.registerAction);
  const unregisterAction = useAIChatStore((state) => state.unregisterAction);

  useEffect(() => {
    registerAction(action);
    return () => {
      unregisterAction(action.name);
    };
  }, [action.name, action.description, action.handler, action.parameters, registerAction, unregisterAction]);
}
