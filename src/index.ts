// @ts-ignore
import jsx from "@babel/plugin-syntax-jsx";
import * as babelCore from "@babel/core";
import { identifierSignalDeclaration } from "./strategies/identifier-signal-declaration";
import { identifierSignalRead } from "./strategies/identifier-signal-read";
import { composeVisitors } from "./utils/compose-visitors";
import type { PluginObj } from "@babel/core";
import type { Config, GlobalState } from "./types";
import { patternSignalDeclaration } from "./strategies/pattern-signal-declaration";
import { customHookSignal } from "./strategies/custom-hook-signal";
import { identifierSignalAssign } from "./strategies/identifier-signal-assign";
import { autoImport } from "./strategies/add-source";

const defaultConfig: Config = {
  autoImport: true,
  importSource: "j20",
  identifierSignalDeclaration: true,
  patternSignalDeclaration: true,
  identifierSignalRead: true,
  customHookSignal: true,
  identifierSignalAssign: true,
};

export const signalCompiler = (
  babel: typeof babelCore,
  config: Required<Config>
): PluginObj => {
  const globalState: GlobalState = {
    signalImported: false,
    createVarCount: 0,
  };

  config = {
    ...defaultConfig,
    ...config,
  };

  const strategies = [
    config.identifierSignalDeclaration
      ? identifierSignalDeclaration(babel, config, globalState)
      : null,
    config.patternSignalDeclaration
      ? patternSignalDeclaration(babel, config, globalState)
      : null,
    config.identifierSignalAssign ? identifierSignalAssign(babel) : null,
    config.identifierSignalRead ? identifierSignalRead(babel) : null,
    config.customHookSignal ? customHookSignal(babel, config) : null,
    config.autoImport ? autoImport(babel, config) : null,
  ].filter((i) => i) as babelCore.Visitor[];

  return {
    name: "signal-compiler",
    inherits: jsx,
    visitor: composeVisitors(strategies),
  };
};
