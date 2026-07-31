import jsx from "@babel/plugin-syntax-jsx";
import * as babelCore from "@babel/core";
import type { PluginObj } from "@babel/core";
import { defaultConfig, type Config } from "./types";
import type { Ctx } from "./context";
import { buildPattern, hasSignalInPattern } from "./utils/pattern";
import { createProgramVisitor } from "./visitors/program";
import { createDeclarationVisitor } from "./visitors/declaration";
import { createReferenceVisitor } from "./visitors/reference";
import { createFunctionVisitor } from "./visitors/function";

export const signalCompiler = (
  _babel: typeof babelCore,
  options: Partial<Config> = {}
): PluginObj => {
  const config = { ...defaultConfig, ...options };

  let tempCount = 0;
  const ctx: Ctx = {
    config,
    createTempVar: () => `__$${tempCount++}`,
    buildPattern,
    hasSignalInPattern,
  };

  return {
    name: "signal-compiler",
    inherits: jsx,
    visitor: {
      ...createProgramVisitor(ctx),
      ...createDeclarationVisitor(ctx),
      ...createReferenceVisitor(ctx),
      ...createFunctionVisitor(ctx),
    } as PluginObj["visitor"],
  };
};
