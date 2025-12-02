export interface GlobalState {
  signalImported: boolean;
  createVarCount: number;
}

export interface Config {
  importSource: string;
  autoImport?: boolean;
  identifierSignalDeclaration?: boolean;
  patternSignalDeclaration?: boolean;
  identifierSignalRead?: boolean;
  customHookSignal?: boolean;
  identifierSignalAssign?: boolean;
}
