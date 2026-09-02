"use client";

import React, { useEffect, useMemo } from 'react';
import { AIChatContext } from './AIChatProvider';
import { AGUIChatContext } from './AGUIChatProvider';
import { useAIChatStore } from '../store/useAIChatStore';
import { catalog as internalCatalog } from './a2ui';
import { A2UICanvasProps } from '../types';

export function A2UICanvas({
  agentId,
  a2uiToolName,
  a2uiVersion,
  catalog: userCatalog,
  includeBasicCatalog = true,
  layout,
}: A2UICanvasProps) {
  const setCatalog = useAIChatStore((state) => state.setCatalog);
  const setIncludeBasicCatalog = useAIChatStore((state) => state.setIncludeBasicCatalog);
  const setA2uiToolName = useAIChatStore((state) => state.setA2uiToolName);
  const setA2uiVersion = useAIChatStore((state) => state.setA2uiVersion);

  // Sync A2UI configuration into the global store
  useEffect(() => {
    setA2uiToolName(a2uiToolName);
    setIncludeBasicCatalog(includeBasicCatalog);
    if (userCatalog) setCatalog(userCatalog);
    if (a2uiVersion) setA2uiVersion(a2uiVersion);
  }, [a2uiToolName, a2uiVersion, includeBasicCatalog, userCatalog, setA2uiToolName, setIncludeBasicCatalog, setCatalog, setA2uiVersion]);

  const globalCatalog = useAIChatStore((state) => state.catalog);
  const storeIncludeBasicCatalog = useAIChatStore((state) => state.includeBasicCatalog);
  const storeA2uiToolName = useAIChatStore((state) => state.a2uiToolName);

  // Merge internal catalog with user-provided catalog
  const catalog = useMemo(() => ({
    ...(storeIncludeBasicCatalog ? internalCatalog : {}),
    ...globalCatalog,
  }), [globalCatalog, storeIncludeBasicCatalog]);

  const aiContext = React.useContext(AIChatContext);
  const aguiContext = React.useContext(AGUIChatContext);
  const context = aiContext || aguiContext;

  if (!context) {
    throw new Error('A2UICanvas must be used within either an AIChatProvider or an AGUIChatProvider');
  }

  const { messages } = context;

  // Find the latest tool invocation matching the a2uiToolName
  const payloadToRender = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      // Prefer parts (new API). Fall back to toolInvocations for AG-UI messages.
      const toolParts = (msg.parts ?? []).filter((p: any) => p.type === 'tool-invocation');
      const invocations: any[] = toolParts.length > 0
        ? toolParts.map((p: any) => p.toolInvocation)
        : ((msg as any).toolInvocations ?? []);
      if (invocations.length > 0) {
        for (let j = invocations.length - 1; j >= 0; j--) {
          const tool = invocations[j];
          if (tool.toolName === storeA2uiToolName) {
            return {
              // Try to extract component name from args, fallback to toolName
              name: tool.args.componentName || tool.args.name || tool.toolName,
              // Try to extract props from args, fallback to args itself
              props: tool.args.props || tool.args,
            };
          }
        }
      }
    }
    return null;
  }, [messages, storeA2uiToolName]);

  if (!payloadToRender) return null;

  const Component = (catalog as Record<string, React.FC<any>>)[payloadToRender.name];

  if (!Component) {
    console.warn(`A2UI Component '${payloadToRender.name}' not found in catalog.`);
    return <div className="p-4 border border-destructive rounded text-destructive">Component Missing: {payloadToRender.name}</div>;
  }

  return (
    <div className="a2ui-container w-full p-4 rounded-md border bg-card text-card-foreground shadow-sm" data-layout={layout ?? 'inline'}>
      <Component props={payloadToRender.props} />
    </div>
  );
}
