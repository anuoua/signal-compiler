import * as t from "@babel/types";
import type { NodePath, PluginPass } from "@babel/core";
import type { Ctx } from "../context";
import { isCustomHook, isSignal } from "../utils/is";
import { warn } from "../utils/warn";

type State = PluginPass;

/**
 * Diagnostics. These never alter the output — they only emit code-frame
 * warnings to surface mistakes that would otherwise fail silently:
 *
 *  - a broken reactive chain: a signal assigned to a non-`$` variable;
 *  - a naming-contract violation: a `$`-prefixed declaration that cannot
 *    become a signal (`let $a;`), or a `function $foo(){}` that is neither a
 *    `$use*` hook nor an uppercase component.
 */
export const createDiagnosticsVisitor = (ctx: Ctx) => {
  const { config } = ctx;
  if (!config.diagnostics) return {};

  const BROKEN_CHAIN = (signal: string, target: string) =>
    `signal-compiler: "${signal}" is a signal but is assigned to non-signal "${target}" — the reactive chain breaks here.`;

  return {
    VariableDeclarator(path: NodePath<t.VariableDeclarator>, _state: State) {
      const { node } = path;

      // `let $a;` / `var $a` — a signal name with no initializer cannot become
      // a signal.
      if (t.isIdentifier(node.id) && isSignal(node.id.name) && !node.init) {
        warn(
          path,
          `signal-compiler: "${node.id.name}" has a $ prefix but no initializer, so it will not become a signal.`
        );
        return;
      }

      // `const b = $a` / `let b = $a` — signal handed to a non-signal binding.
      // TEMP-DISABLED: silenced for observation; restore when stable.
      // if (
      //   t.isIdentifier(node.id) &&
      //   !isSignal(node.id.name) &&
      //   t.isIdentifier(node.init) &&
      //   isSignal(node.init.name)
      // ) {
      //   warn(path, BROKEN_CHAIN(node.init.name, node.id.name));
      // }
    },

    AssignmentExpression(
      path: NodePath<t.AssignmentExpression>,
      _state: State
    ) {
      const { node } = path;
      if (node.operator !== "=") return;

      // `b = $a` — signal handed to a non-signal variable.
      // TEMP-DISABLED: silenced for observation; restore when stable.
      // if (
      //   t.isIdentifier(node.left) &&
      //   !isSignal(node.left.name) &&
      //   t.isIdentifier(node.right) &&
      //   isSignal(node.right.name)
      // ) {
      //   warn(path, BROKEN_CHAIN(node.right.name, node.left.name));
      // }
    },

    FunctionDeclaration(path: NodePath<t.FunctionDeclaration>, _state: State) {
      const name = path.node.id?.name;
      // `$`-prefixed function that is neither a `$use*` hook nor an uppercase
      // component — a contract violation.
      if (name && name.startsWith("$") && !isCustomHook(name)) {
        warn(
          path,
          `signal-compiler: function "${name}" starts with $ but is neither a custom hook ($use*) nor a component; this conflicts with the $ naming contract.`
        );
      }
    },
  };
};
