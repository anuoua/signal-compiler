import type { Config } from "./types";
import type { PatternBuilder, hasSignalInPattern } from "./utils/pattern";
import type { Injector } from "./utils/inject";

export interface Ctx {
  config: Required<Config>;
  createTempVar: () => string;
  buildPattern: PatternBuilder;
  hasSignalInPattern: typeof hasSignalInPattern;
  ensureSignal: Injector["ensureSignal"];
  ensureComputed: Injector["ensureComputed"];
}
