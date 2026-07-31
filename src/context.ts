import type { Config } from "./types";
import type { PatternBuilder, hasSignalInPattern } from "./utils/pattern";

export interface Ctx {
  config: Required<Config>;
  createTempVar: () => string;
  buildPattern: PatternBuilder;
  hasSignalInPattern: typeof hasSignalInPattern;
}
