import type { PluginPass } from "@babel/core";

export interface Config {
  importSource: string;
  autoImport?: boolean;
  identifierSignalDeclaration?: boolean;
  patternSignalDeclaration?: boolean;
  identifierSignalRead?: boolean;
  customHookSignal?: boolean;
  identifierSignalAssign?: boolean;
}

export const defaultConfig: Required<Config> = {
  importSource: "j20",
  autoImport: true,
  identifierSignalDeclaration: true,
  patternSignalDeclaration: true,
  identifierSignalRead: true,
  customHookSignal: true,
  identifierSignalAssign: true,
};

declare module "@babel/core" {
  interface PluginPass {
    signalVarName: string;
    computedVarName: string;
  }
}
