"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AIChatContext } from './AIChatProvider';
import { AGUIChatContext } from './AGUIChatProvider';
import { catalog as preBuiltCustomCatalog } from './a2ui';
import { surfaceBus, type A2UIOp } from './a2ui/surface-bus';
import { A2UICanvasProps } from '../types';
import { useAIChatStore } from '../store/useAIChatStore';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types for the in-memory surface state
// ---------------------------------------------------------------------------

interface ComponentNode {
  id: string;
  component: string;
  /** child IDs or a single child ID */
  children?: string | string[];
  child?: string;
  [prop: string]: unknown;
}

interface SurfaceState {
  surfaceId: string;
  /** catalog ID from createSurface, used when includeBasicCatalog is true */
  catalogId?: string;
  /** Whether the surface requested a data model */
  sendDataModel?: boolean;
  components: Record<string, ComponentNode>;
  rootId: string | null;
  dataModel: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseOpsFromToolResult(result: unknown): A2UIOp[] {
  if (!result) return [];
  // result may be a JSON string or already an object/array
  let parsed: unknown = result;
  if (typeof result === 'string') {
    try { parsed = JSON.parse(result); } catch { return []; }
  }
  if (Array.isArray(parsed)) return parsed as A2UIOp[];
  if (typeof parsed === 'object' && parsed !== null) {
    // Could be a wrapper: { messages: [...] } (as in the example JSON)
    const p = parsed as Record<string, unknown>;
    if (Array.isArray(p.messages)) return p.messages as A2UIOp[];
    // Or a single op
    return [parsed as A2UIOp];
  }
  return [];
}

function applyOp(state: SurfaceState, op: A2UIOp): SurfaceState {
  // updateComponents
  if ('updateComponents' in op) {
    const uc = op.updateComponents as {
      surfaceId?: string;
      components?: ComponentNode[];
    };
    if (uc.surfaceId && uc.surfaceId !== state.surfaceId) return state;
    const next = { ...state, components: { ...state.components } };
    for (const comp of uc.components ?? []) {
      next.components[comp.id] = comp;
      // The first component in the list whose id is 'root' (or the very first)
      // becomes the root
      if (comp.id === 'root' && !next.rootId) next.rootId = 'root';
    }
    // If still no rootId, pick the first component
    if (!next.rootId) {
      next.rootId = Object.keys(next.components)[0] ?? null;
    }
    return next;
  }
  // updateDataModel
  if ('updateDataModel' in op) {
    const ud = op.updateDataModel as {
      surfaceId?: string;
      data?: Record<string, unknown>;
    };
    if (ud.surfaceId && ud.surfaceId !== state.surfaceId) return state;
    return {
      ...state,
      dataModel: { ...state.dataModel, ...(ud.data ?? {}) },
    };
  }
  return state;
}

function resolveValue(value: unknown, dataModel: Record<string, unknown>): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const v = value as Record<string, unknown>;
    if (typeof v.path === 'string') {
      // JSON Pointer style: /username → dataModel.username
      const segments = v.path.replace(/^\//, '').split('/');
      let cur: unknown = dataModel;
      for (const seg of segments) {
        if (cur == null || typeof cur !== 'object') return undefined;
        cur = (cur as Record<string, unknown>)[seg];
      }
      return cur;
    }
  }
  return value;
}

function resolveProps(
  rawProps: Record<string, unknown>,
  dataModel: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rawProps)) {
    out[k] = resolveValue(v, dataModel);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Error Boundary for Generative UI
// ---------------------------------------------------------------------------
class NodeErrorBoundary extends React.Component<{ children: React.ReactNode, componentName: string }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode, componentName: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-2 border border-destructive/50 bg-destructive/10 text-destructive text-xs rounded m-1">
          <strong>Error in {this.props.componentName}:</strong> {String(this.state.error?.message || this.state.error)}
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Recursive renderer
// ---------------------------------------------------------------------------

function RenderNode({
  nodeId,
  surface,
  catalog,
  dispatch,
  depth = 0,
}: {
  nodeId: string;
  surface: SurfaceState;
  catalog: Record<string, React.FC<any>>;
  dispatch: (payload: unknown) => void;
  depth?: number;
}) {
  const node = surface.components[nodeId];
  if (!node) {
    console.warn(`[A2UICanvas] component node "${nodeId}" not found`);
    return null;
  }

  const Component = catalog[node.component];
  if (!Component) {
    console.warn(`[A2UICanvas] component type "${node.component}" not in catalog`);
    return (
      <div className="p-2 border border-destructive rounded text-destructive text-xs">
        Unknown: {node.component}
      </div>
    );
  }

  // Extract component-type field only; keep everything else in props
  // (child, children, tabs, etc. are part of the component's own prop schema)
  const { id: _id, component: _component, ...rest } = node;

  // Resolve {path} bindings in props
  const resolvedProps = resolveProps(rest as Record<string, unknown>, surface.dataModel);

  /**
   * children render function — used by layout components (Row, Column, Card, List, Tabs, Modal…)
   * which receive `children: (id: string) => ReactNode` per the RendererProps interface.
   */
  const childrenFn = (childId: string) => (
    <RenderNode
      key={childId}
      nodeId={childId}
      surface={surface}
      catalog={catalog}
      dispatch={dispatch}
      depth={depth + 1}
    />
  );

  return (
    <NodeErrorBoundary componentName={node.component}>
      <Component
        key={nodeId}
        props={resolvedProps}
        dispatch={dispatch}
        children={childrenFn}
      />
    </NodeErrorBoundary>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Renders the Agentic UI (A2UI) surface. It listens to the `surfaceBus` for
 * UI rendering operations and recursively mounts dynamic components based on
 * the LLM's instructions.
 *
 * @param props - Configuration properties for the canvas.
 * @returns The rendered UI canvas.
 */
export function A2UICanvas({ emptyState, className, style }: A2UICanvasProps = {}) {
  const a2uiProps = useAIChatStore((state) => state.a2uiProps);
  const {
    agentId,
    a2uiToolName = 'renderComponent',
    a2uiVersion = 'V0.9',
    includeBasicCatalog = true,
    includePreBuiltCustomComponents = true,
    layout = 'inline',
    catalog: providedCatalog,
  } = a2uiProps || {};
  // ── Catalog composition ─────────────────────────────────────────────────
  const catalog = useMemo<Record<string, React.FC<any>>>(() => ({
    // pre-built custom catalog (our renderers.tsx)
    ...(includePreBuiltCustomComponents ? preBuiltCustomCatalog : {}),
    // basic catalog (same renderers, flagged by includeBasicCatalog — no external dep needed)
    ...(includeBasicCatalog ? preBuiltCustomCatalog : {}),
    // user-supplied overrides / additions
    ...providedCatalog,
  }), [includePreBuiltCustomComponents, includeBasicCatalog, providedCatalog]);

  // ── Message context ──────────────────────────────────────────────────────
  const aiContext = React.useContext(AIChatContext);
  const aguiContext = React.useContext(AGUIChatContext);
  const context = aiContext || aguiContext;

  if (!context) {
    throw new Error('A2UICanvas must be used within OmniChat, AIChatProvider, or AGUIChatProvider');
  }

  const { messages } = context;

  // ── Tool bridge: parse ops from the matching tool result and push to bus ─
  const seenToolResultsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const msg of messages) {
      const toolParts = (msg.parts ?? []).filter((p: any) => p.type === 'tool-invocation');
      const invocations: any[] =
        toolParts.length > 0
          ? toolParts.map((p: any) => p.toolInvocation)
          : ((msg as any).toolInvocations ?? []);

      for (const tool of invocations) {
        if (tool.toolName !== a2uiToolName) continue;
        if (!tool.result) continue;

        // Deduplicate by toolCallId — only push once per result
        const key = `${tool.toolCallId}`;
        if (seenToolResultsRef.current.has(key)) continue;
        seenToolResultsRef.current.add(key);

        const ops = parseOpsFromToolResult(tool.result);
        if (ops.length > 0) {
          surfaceBus.push(agentId ?? 'default', ops);
        }
      }
    }
  }, [messages, a2uiToolName, agentId]);

  // ── Bus subscription: maintain surface state ─────────────────────────────
  const [surface, setSurface] = useState<SurfaceState | null>(null);
  const seenOpsRef = useRef(0);
  const createdSurfaceIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const channel = agentId ?? 'default';

    function applyNewOps(ops: A2UIOp[]) {
      if (!ops.length) return;

      for (const op of ops) {
        if ('createSurface' in op) {
          const cs = op.createSurface as {
            surfaceId?: string;
            catalogId?: string;
            sendDataModel?: boolean;
          };
          const sid = cs.surfaceId;
          if (!sid) continue;

          // Skip duplicate createSurface for same surfaceId
          if (createdSurfaceIdsRef.current.has(sid)) {
            console.log(`[A2UICanvas] skip duplicate createSurface(${sid})`);
            continue;
          }
          createdSurfaceIdsRef.current.add(sid);

          setSurface({
            surfaceId: sid,
            catalogId: cs.catalogId,
            sendDataModel: cs.sendDataModel,
            components: {},
            rootId: null,
            dataModel: {},
          });
        }

        if ('deleteSurface' in op) {
          const ds = op.deleteSurface as { surfaceId?: string };
          setSurface((prev) =>
            prev?.surfaceId === ds.surfaceId ? null : prev,
          );
        }

        if ('updateComponents' in op || 'updateDataModel' in op) {
          setSurface((prev) => {
            if (!prev) return prev;
            return applyOp(prev, op);
          });
        }
      }
    }

    // Replay existing buffer
    const initial = surfaceBus.snapshot(channel);
    if (initial.ops.length > seenOpsRef.current) {
      applyNewOps(initial.ops.slice(seenOpsRef.current) as A2UIOp[]);
      seenOpsRef.current = initial.ops.length;
    }

    // Subscribe to future pushes
    const unsub = surfaceBus.subscribe(channel, (snap) => {
      const tail = snap.ops.slice(seenOpsRef.current);
      if (tail.length > 0) {
        applyNewOps(tail as A2UIOp[]);
        seenOpsRef.current = snap.ops.length;
      }
    });

    return unsub;
  }, [agentId]);

  // ── Dispatch: forward action events back to the chat context ─────────────
  const dispatch = React.useCallback(
    (payload: unknown) => {
      console.log('[A2UICanvas] dispatch', payload);
      // Future: forward to agent via context.append or a2uiAction forwardedProps
    },
    [],
  );

  // ── Render ────────────────────────────────────────────────────────────────
  if (!surface || !surface.rootId) {
    if (emptyState) {
      return (
        <div className={`h-full flex flex-col items-center justify-center p-8 ${className || ''}`} style={style}>
          {emptyState}
        </div>
      );
    }
    return null;
  }

  return (
    <div
      className={cn(
        "a2ui-canvas w-full h-full rounded-md border bg-background text-foreground shadow-sm overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:bg-transparent dark:[&::-webkit-scrollbar]:bg-transparent [&::-webkit-scrollbar-track]:bg-transparent dark:[&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-zinc-400 dark:hover:[&::-webkit-scrollbar-thumb]:bg-zinc-600",
        className
      )}
      style={style}
      data-layout={layout ?? 'inline'}
      data-surface-id={surface.surfaceId}
      data-a2ui-version={a2uiVersion}
    >
      <RenderNode
        nodeId={surface.rootId}
        surface={surface}
        catalog={catalog}
        dispatch={dispatch}
      />
    </div>
  );
}
