import { addNamed } from "@babel/helper-module-imports";
import type { NodePath, PluginPass } from "@babel/core";

export interface Injector {
  ensureSignal: (path: NodePath, state: PluginPass) => string;
  ensureComputed: (path: NodePath, state: PluginPass) => string;
}

/**
 * Lazy import injection. The helpers are only added the first time the compiler
 * actually emits a `signal(...)` / `computed(...)` call, so a file that merely
 * *consumes* signals (reads `.value`, assigns) ends up with no spurious import.
 */
export const createInjector = (
  importSource: string,
  autoImport: boolean
): Injector => {
  const resolve = (
    path: NodePath,
    state: PluginPass,
    name: "signal" | "computed"
  ): string => {
    const key = name === "signal" ? "signalVarName" : "computedVarName";
    const cached = state[key];
    if (cached) return cached;

    let resolved = "";
    if (!autoImport) {
      resolved = name;
    } else {
      const binding = path.scope.getBinding(name);
      // Reuse only a real module import — a local `let signal` must not hijack.
      if (binding && binding.kind === "module") resolved = name;
    }

    if (!resolved) {
      const id = addNamed(path, name, importSource, { nameHint: name });
      resolved = id.name;
    }

    state[key] = resolved;
    return resolved;
  };

  return {
    ensureSignal: (path, state) => resolve(path, state, "signal"),
    ensureComputed: (path, state) => resolve(path, state, "computed"),
  };
};
