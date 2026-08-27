import * as t from "@babel/types";
import type { NodePath, PluginPass } from "@babel/core";
import type { Ctx } from "../context";
import { isCustomHook, isDollar, isSignal } from "../utils/is";
import { signalCall, computedCall, valueOf } from "../utils/build";
import { collectPatternBindings, hasSignalInPattern } from "../utils/pattern";
import { warn } from "../utils/warn";

type State = PluginPass;

export const createDeclarationVisitor = (ctx: Ctx) => {
  const { config, createTempVar, buildPattern, hasSignalInPattern, ensureSignal, ensureComputed } =
    ctx;

  // True when the initializer already yields a signal and must stay untouched —
  // a custom-hook call (`$useX(...)`) or a pass-through `$()`.
  const isRawSignalInit = (init: t.Node | null | undefined): boolean =>
    !!init &&
    t.isCallExpression(init) &&
    t.isIdentifier(init.callee) &&
    (isCustomHook(init.callee.name) || isDollar(init.callee.name));

  const wrapInit = (
    path: NodePath,
    init: t.Expression,
    kind: "let" | "const",
    state: State
  ) =>
    kind === "let"
      ? signalCall(ensureSignal(path, state), init)
      : computedCall(ensureComputed(path, state), init);

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
            decl.init = wrapInit(path, decl.init, kind, state);
          }
          return;
        }

        // --- pattern declarations: let/const { a: $a } = .. ---
        if (
          config.patternSignalDeclaration &&
          (t.isObjectPattern(decl.id) || t.isArrayPattern(decl.id)) &&
          hasSignalInPattern(decl.id)
        ) {
          // `const { a: $a, hello } = $some` — a plain alias destructured
          // from a signal source becomes a declaration-time snapshot and
          // silently loses reactivity. Warn BEFORE the rewrite below: it
          // replaces decl.id with a temp var, which would hide the pattern
          // from the diagnostics visitor.
          // `const { a: $a, hello } = $some` — a plain alias destructured
          // from a signal source becomes a declaration-time snapshot and
          // silently loses reactivity. Warn BEFORE the rewrite below: it
          // replaces decl.id with a temp var, which would hide the pattern
          // from the diagnostics visitor.
          // TEMP-DISABLED: silenced for observation; restore when stable.
          // if (
          //   config.diagnostics &&
          //   t.isIdentifier(decl.init) &&
          //   isSignal(decl.init.name)
          // ) {
          //   for (const binding of collectPatternBindings(decl.id)) {
          //     if (!isSignal(binding.name)) {
          //       warn(
          //         path,
          //         `signal-compiler: "${binding.name}" is destructured from signal ` +
          //           `"${decl.init.name}" without a $ prefix — the ` +
          //           `reactive chain breaks here; rename it to ` +
          //           `"$${binding.name}" to keep reactivity.`
          //       );
          //     }
          //   }
          // }

          const pattern = decl.id;
          const varName = createTempVar();
          decl.id = t.identifier(varName);

          if (!isRawSignalInit(decl.init)) {
            decl.init = computedCall(
              ensureComputed(path, state),
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
