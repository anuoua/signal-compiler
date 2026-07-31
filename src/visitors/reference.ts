import * as t from "@babel/types";
import type { NodePath, PluginPass } from "@babel/core";
import type { Ctx } from "../context";
import { isDollar, isSignal } from "../utils/is";
import { valueOf } from "../utils/build";

type State = PluginPass;

export const createReferenceVisitor = (ctx: Ctx) => {
  const { config } = ctx;

  return {
    Identifier(path: NodePath<t.Identifier>, _state: State) {
      if (!config.identifierSignalRead) return;

      const parent = path.parent;
      const parentPath = path.parentPath;

      // `$($a)` — pass-through call, leave the argument untouched.
      const inDollarCall =
        t.isCallExpression(parent) &&
        t.isIdentifier(parent.callee) &&
        isDollar(parent.callee.name);

      // `{ $name }` inside a destructuring pattern.
      const isPatternProperty =
        parentPath.isProperty() && parentPath.parentPath.isObjectPattern();

      // `$a.value = ..` — already redirected by the assign visitor.
      const isAssignTarget =
        parentPath.isMemberExpression() &&
        parentPath.parentPath.isAssignmentExpression() &&
        parentPath.parentPath.node.left === parentPath.node;

      if (
        isSignal(path.node.name) &&
        path.isReferencedIdentifier() &&
        !inDollarCall &&
        !isPatternProperty &&
        !isAssignTarget
      ) {
        path.replaceWith(valueOf(t.identifier(path.node.name)));
        path.skip();
      }
    },

    AssignmentExpression(
      path: NodePath<t.AssignmentExpression>,
      _state: State
    ) {
      if (!config.identifierSignalAssign) return;

      const left = path.get("left");
      if (left.isIdentifier() && isSignal(left.node.name)) {
        left.replaceWith(valueOf(left.node));
      }
    },
  };
};
