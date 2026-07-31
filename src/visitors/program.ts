import type { NodePath, PluginPass } from "@babel/core";
import { addNamed } from "@babel/helper-module-imports";
import type { Ctx } from "../context";

type State = PluginPass;

export const createProgramVisitor = (ctx: Ctx) => {
  const { config } = ctx;

  const inject = (
    path: NodePath,
    name: string,
    state: State,
    key: "signalVarName" | "computedVarName"
  ) => {
    const binding = path.scope.getBinding(name);
    // Only reuse an existing binding when it is a real module import —
    // a local `let signal = ...` must not be mistaken for the helper.
    if (binding && binding.kind === "module") {
      state[key] = name;
      return;
    }
    const id = addNamed(path, name, config.importSource, { nameHint: name });
    state[key] = id.name;
  };

  return {
    Program(path: NodePath, state: State) {
      if (config.autoImport) {
        inject(path, "signal", state, "signalVarName");
        inject(path, "computed", state, "computedVarName");
      } else {
        state.signalVarName = "signal";
        state.computedVarName = "computed";
      }
    },
  };
};
