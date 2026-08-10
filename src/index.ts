import jsx from "@babel/plugin-syntax-jsx";
import * as babelCore from "@babel/core";
import type { PluginObj } from "@babel/core";
import { defaultConfig, type Config } from "./types";
import type { Ctx } from "./context";
import { buildPattern, hasSignalInPattern } from "./utils/pattern";
import { createInjector } from "./utils/inject";
import { createDeclarationVisitor } from "./visitors/declaration";
import { createReferenceVisitor } from "./visitors/reference";
import { createFunctionVisitor } from "./visitors/function";
import { createDiagnosticsVisitor } from "./visitors/diagnostics";
import { mergeVisitors } from "./utils/merge-visitors";

// --- 约定/标记工具，供 JSX 转换插件（如 j20 的 jsx-transform）共用 ---
export { SIGNAL_COMPONENT_MARKER, hasSignalComponentMarker } from "./utils/marker";
export { hasSignalInPattern } from "./utils/pattern";
export { isDollar, isSignal, isCustomHook, isComponentFunction } from "./utils/is";

export const signalCompiler = (
  _babel: typeof babelCore,
  options: Partial<Config> = {}
): PluginObj => {
  const config = { ...defaultConfig, ...options };

  let tempCount = 0;
  const injector = createInjector(config.importSource, config.autoImport);
  const ctx: Ctx = {
    config,
    createTempVar: () => `__$${tempCount++}`,
    buildPattern,
    hasSignalInPattern,
    ensureSignal: injector.ensureSignal,
    ensureComputed: injector.ensureComputed,
  };

  return {
    name: "signal-compiler",
    inherits: jsx,
    visitor: mergeVisitors(
      createDeclarationVisitor(ctx),
      createReferenceVisitor(ctx),
      createFunctionVisitor(ctx),
      createDiagnosticsVisitor(ctx)
    ),
  };
};
