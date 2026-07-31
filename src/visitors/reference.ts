import * as t from "@babel/types";
import type { NodePath, PluginPass } from "@babel/core";
import type { Ctx } from "../context";
import { isDollar, isSignal } from "../utils/is";
import { valueOf } from "../utils/build";
import { rewriteAssignmentPattern } from "../utils/pattern";

type State = PluginPass;

/**
 * True when `path` sits on the LEFT side of an assignment — i.e. walking up
 * from `path`, the first AssignmentExpression ancestor has `path` within its
 * `left` operand. Used to keep the read visitor off `.value` accesses that are
 * assignment targets (both `$a.value = ..` and the rewritten
 * `({ $a: $a.value } = ..)`).
 */
const isWithinAssignmentLeft = (path: NodePath): boolean => {
  let cur: NodePath | null = path;
  while (cur && !cur.isStatement() && !cur.isFunction()) {
    const parent: NodePath | undefined = cur.parentPath ?? undefined;
    if (parent?.isAssignmentExpression()) {
      return parent.get("left") === cur;
    }
    cur = parent ?? null;
  }
  return false;
};

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

      // `{ $name }` inside a destructuring pattern (declaration or assignment).
      const isPatternProperty =
        parentPath.isProperty() && parentPath.parentPath.isObjectPattern();

      // `$a.value = ..` or the rewritten `({ $a: $a.value } = ..)` — the `.value`
      // member is a write target, its `$a` must not be rewritten again.
      const isAssignMemberTarget =
        parentPath.isMemberExpression() &&
        t.isIdentifier(parentPath.node.property, { name: "value" }) &&
        isWithinAssignmentLeft(parentPath);

      if (
        isSignal(path.node.name) &&
        path.isReferencedIdentifier() &&
        !inDollarCall &&
        !isPatternProperty &&
        !isAssignMemberTarget
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

      // `$a = ..` / `$a += ..` → `$a.value <op> ..`
      if (left.isIdentifier() && isSignal(left.node.name)) {
        left.replaceWith(valueOf(left.node));
        return;
      }

      // `({ $a } = obj)` / `[$a] = arr` → redirect every signal target to .value.
      // The emitted `.value` members are kept safe from the read visitor by
      // `isAssignMemberTarget` above (no need to skip traversal).
      if (left.isObjectPattern() || left.isArrayPattern()) {
        rewriteAssignmentPattern(left.node);
      }
    },
  };
};
