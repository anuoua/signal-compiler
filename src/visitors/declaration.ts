import * as t from "@babel/types";
import type { NodePath, PluginPass } from "@babel/core";
import type { Ctx } from "../context";
import { isCustomHook, isDollar, isSignal } from "../utils/is";
import { signalCall, computedCall, valueOf } from "../utils/build";

type State = PluginPass;

export const createDeclarationVisitor = (ctx: Ctx) => {
  const { config, createTempVar, buildPattern, hasSignalInPattern } = ctx;

  // True when the initializer already yields a signal and must stay untouched —
  // a custom-hook call (`$useX(...)`) or a pass-through `$()`.
  const isRawSignalInit = (init: t.Node | null | undefined): boolean =>
    !!init &&
    t.isCallExpression(init) &&
    t.isIdentifier(init.callee) &&
    (isCustomHook(init.callee.name) || isDollar(init.callee.name));

  const wrapInit = (init: t.Expression, kind: "let" | "const", state: State) =>
    kind === "let"
      ? signalCall(state.signalVarName, init)
      : computedCall(state.computedVarName, init);

  return {
    VariableDeclaration(
      path: NodePath<t.VariableDeclaration>,
      state: State
    ) {
      const { node } = path;

      node.declarations.forEach((decl) => {
        const kind = node.kind;
        if (kind !== "let" && kind !== "const") return;

        // --- identifier declarations: let $x = .. / const $x = .. ---
        if (config.identifierSignalDeclaration && t.isIdentifier(decl.id)) {
          if (
            decl.init &&
            isSignal(decl.id.name) &&
            !isRawSignalInit(decl.init)
          ) {
            decl.init = wrapInit(decl.init, kind, state);
          }
          return;
        }

        // --- pattern declarations: let/const { a: $a } = .. ---
        if (
          config.patternSignalDeclaration &&
          (t.isObjectPattern(decl.id) || t.isArrayPattern(decl.id)) &&
          hasSignalInPattern(decl.id)
        ) {
          const pattern = decl.id;
          const varName = createTempVar();
          decl.id = t.identifier(varName);

          if (!isRawSignalInit(decl.init)) {
            decl.init = computedCall(
              state.computedVarName,
              (decl.init ?? t.identifier("undefined")) as t.Expression
            );
          }

          // The freshly-emitted `const $x = <member>` statements are visited
          // next (queued as siblings during this traversal) and wrapped into
          // `computed(...)` by the identifier branch above.
          const object = valueOf(t.identifier(varName));
          buildPattern(pattern, object, kind, (stmt) =>
            path.insertAfter(stmt)
          );
        }
      });
    },
  };
};
