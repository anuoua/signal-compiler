import type { PluginPass } from "@babel/core";

export interface Config {
  importSource: string;
  autoImport?: boolean;
  diagnostics?: boolean;
  identifierSignalDeclaration?: boolean;
  patternSignalDeclaration?: boolean;
  identifierSignalRead?: boolean;
  customHookSignal?: boolean;
  identifierSignalAssign?: boolean;
  markerSignalComponent?: boolean;
}

export const defaultConfig: Required<Config> = {
  importSource: "j20",
  autoImport: true,
  diagnostics: true,
  identifierSignalDeclaration: true,
  patternSignalDeclaration: true,
  identifierSignalRead: true,
  customHookSignal: true,
  identifierSignalAssign: true,
  markerSignalComponent: true,
};

declare module "@babel/core" {
  interface PluginPass {
    signalVarName: string;
    computedVarName: string;
  }
}
