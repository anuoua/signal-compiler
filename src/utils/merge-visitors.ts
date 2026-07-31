import type { NodePath, PluginPass, Visitor } from "@babel/core";

type Handler = (path: NodePath, state: PluginPass) => void;

/**
 * Merge several partial visitors into one. When multiple visitors share a node
 * key, their handlers run in order (earlier visitors first). This keeps each
 * concern in its own module (transforms, diagnostics, …) while still allowing
 * them to observe the same nodes.
 *
 * `visitors` is intentionally loose: each module's handlers carry their own
 * narrowed `NodePath<T>` signatures, which are incompatible with a single
 * generic `Handler` under strict checks.
 */
export const mergeVisitors = (...visitors: ReadonlyArray<Record<string, unknown>>): Visitor => {
  const merged: Record<string, Handler> = {};
  for (const v of visitors) {
    for (const key of Object.keys(v)) {
      const next = v[key] as Handler | undefined;
      if (typeof next !== "function") continue;
      const prev = merged[key];
      merged[key] = prev
        ? (path, state) => {
            prev(path, state);
            next(path, state);
          }
        : next;
    }
  }
  return merged as Visitor;
};
