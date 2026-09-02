/**
 * A tiny event bus that mirrors A2UI surface ops from the chat's
 * tool-result stream into an `<A2UICanvas>` or inline pane.
 *
 * Tool results live inside the chat message renderer; the canvas may live
 * outside the message list (split pane) or be a separate DOM node (inline
 * pinned pane). The bus lets us forward ops between the two without
 * coupling React contexts.
 *
 * Per-channel (agentId) so multiple concurrent agents don't fight over
 * the same canvas state.
 */
export type A2UIOp = Record<string, unknown> & { version?: string };

type Snapshot = {
  surfaceId: string | null;
  ops: A2UIOp[];
};

type Listener = (snap: Snapshot) => void;

const buffers = new Map<string, A2UIOp[]>();
const surfaceIds = new Map<string, string | null>();
const listeners = new Map<string, Set<Listener>>();

function getSurfaceIdFromOp(op: A2UIOp): string | undefined {
  const cs = (op.createSurface as { surfaceId?: string } | undefined)?.surfaceId;
  const uc = (op.updateComponents as { surfaceId?: string } | undefined)?.surfaceId;
  const ud = (op.updateDataModel as { surfaceId?: string } | undefined)?.surfaceId;
  const ds = (op.deleteSurface as { surfaceId?: string } | undefined)?.surfaceId;
  return cs ?? uc ?? ud ?? ds;
}

function opKind(op: A2UIOp): string {
  if ('createSurface' in op) return 'createSurface';
  if ('updateComponents' in op) return 'updateComponents';
  if ('updateDataModel' in op) return 'updateDataModel';
  if ('deleteSurface' in op) return 'deleteSurface';
  return '?';
}

export const surfaceBus = {
  push(channel: string, ops: A2UIOp[]) {
    const buf = buffers.get(channel) ?? [];
    buf.push(...ops);
    buffers.set(channel, buf);
    for (const op of ops) {
      const sid = getSurfaceIdFromOp(op);
      if (sid) surfaceIds.set(channel, sid);
    }
    if (typeof window !== 'undefined') {
      console.log(
        `[surface-bus] push channel=${channel} +${ops.length} ops ` +
        `[${ops.map(opKind).join(', ')}]`,
      );
    }
    const snap = this.snapshot(channel);
    listeners.get(channel)?.forEach((fn) => fn(snap));
  },

  reset(channel: string) {
    buffers.set(channel, []);
    surfaceIds.set(channel, null);
    if (typeof window !== 'undefined') console.log(`[surface-bus] reset channel=${channel}`);
    const snap = this.snapshot(channel);
    listeners.get(channel)?.forEach((fn) => fn(snap));
  },

  snapshot(channel: string): Snapshot {
    return {
      surfaceId: surfaceIds.get(channel) ?? null,
      ops: buffers.get(channel) ?? [],
    };
  },

  subscribe(channel: string, fn: Listener): () => void {
    if (!listeners.has(channel)) listeners.set(channel, new Set());
    listeners.get(channel)!.add(fn);
    return () => {
      listeners.get(channel)?.delete(fn);
    };
  },
};
