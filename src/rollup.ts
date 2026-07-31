import type { Plugin } from "rollup";
import * as babelCore from "@babel/core";
import { createFilter } from "@rollup/pluginutils";
import type { FilterPattern } from "@rollup/pluginutils";
import { signalCompiler } from ".";
import type { Config } from "./types";

export interface Options {
  include?: FilterPattern;
  exclude?: FilterPattern;
  sourcemap?: boolean;
  config?: Config;
}

export function signalCompilerRollup(options: Options = {}): Plugin {
  const { include, exclude, sourcemap = true } = options;
  const idFilter = createFilter(include, exclude);

  return {
    name: "signal-compiler",
    transform(code: string, id: string) {
      if (!idFilter(id)) return null;

      let result: babelCore.BabelFileResult | null;
      try {
        result = babelCore.transform(code, {
          plugins: [
            ["@babel/plugin-syntax-jsx"],
            [signalCompiler, { ...(options.config as object) }],
          ],
        });
      } catch (error) {
        this.error({
          message: `signal-compiler failed to transform ${id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
        return null;
      }

      if (!result || result.code == null) {
        this.warn({ message: `signal-compiler produced no output for ${id}` });
        return null;
      }

      return {
        code: result.code,
        map: sourcemap ? result.map ?? null : null,
      };
    },
  };
}
