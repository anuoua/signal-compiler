import type { NodePath } from "@babel/core";

/**
 * Emit a code-frame warning without aborting compilation. Uses Babel's
 * `file.warn` when available (so the warning surfaces with position info in
 * build tooling), falling back to `console.warn` for standalone usage.
 */
export const warn = (path: NodePath, message: string): void => {
  const frame = path.buildCodeFrameError(message);
  const file = (path.hub as any)?.file;
  if (file && typeof file.warn === "function") file.warn(frame);
  else console.warn(frame.message);
};
