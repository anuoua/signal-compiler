import * as t from "@babel/types";
import type { NodePath, PluginPass, Visitor } from "@babel/core";
import type { Ctx } from "../context";
import { isCustomHook, isComponentFunction } from "../utils/is";
import { computedCall, valueOf } from "../utils/build";
import { hasSignalComponentMarker } from "../utils/marker";

type State = PluginPass;
// Every function shape shares `params`/`body`; FunctionDeclaration is used as
// the access type because it carries all of them, including `id`.
type FnNode = t.FunctionDeclaration;

export const createFunctionVisitor = (ctx: Ctx) => {
  const { config, createTempVar, buildPattern, hasSignalInPattern, ensureComputed } = ctx;

  // Resolve the binding name of a function: prefer `const $useX = () => {}`
  // (the variable it is assigned to), fall back to a declared name.
  const getFunctionName = (path: NodePath): string | undefined => {
    if (
      path.parentPath?.isVariableDeclarator() &&
      t.isIdentifier(path.parentPath.node.id)
    ) {
      return path.parentPath.node.id.name;
    }
    return (path.node as FnNode).id?.name;
  };

  const insertIntoBody = (fnPath: NodePath, stmt: t.Statement) => {
    const fn = fnPath.node as FnNode;
    if (fn.body && t.isBlockStatement(fn.body)) {
      fn.body.body.unshift(stmt);
    } else {
      // expression-body arrow: wrap so we can prepend statements
      // expression-body arrow: wrap so we can prepend statements. The original
      // body expression must be RETURNED, not dropped as a bare expression
      // statement — otherwise the component/hook returns undefined.
      (fnPath.node as t.ArrowFunctionExpression).body = t.blockStatement([
        stmt,
        t.returnStatement(fn.body as t.Expression),
      ]);
    }
  };

  const processParams = (fnPath: NodePath) => {
    const fn = fnPath.node as FnNode;
    fn.params.forEach((param, index) => {
      if (!t.isObjectPattern(param) && !t.isArrayPattern(param)) return;
      if (!hasSignalInPattern(param)) return;

      const varName = createTempVar();
      fn.params[index] = t.identifier(varName);
      const object = valueOf(t.identifier(varName));

      buildPattern(param, object, "const", (stmt) =>
        insertIntoBody(fnPath, stmt)
      );
    });
  };

  const processReturns = (fnPath: NodePath, state: State) => {
    const bodyPath = fnPath.get("body") as NodePath;
    if (bodyPath.isBlockStatement()) {
      const computed = ensureComputed(fnPath, state);
      // Wrap EVERY direct return of this hook, including those nested in
      // if/for/try blocks — but never returns belonging to an inner function.
      bodyPath.traverse({
        ReturnStatement(retPath: NodePath<t.ReturnStatement>) {
          if (retPath.node.argument == null) return;
          retPath.node.argument = computedCall(computed, retPath.node.argument);
        },
        Function(innerPath: NodePath) {
          innerPath.skip();
        },
      } as Visitor);
    } else if (bodyPath.isExpression()) {
      // expression-body arrow hook: the body itself is the returned signal
      (fnPath.node as t.ArrowFunctionExpression).body = computedCall(
        ensureComputed(fnPath, state),
        bodyPath.node as t.Expression
      );
    }
  };

  const visitFunction = (path: NodePath, state: State) => {
    const name = getFunctionName(path);

    const isHook = !!name && isCustomHook(name);
    const isComponent = !!name && isComponentFunction(name);
    // Marker-driven inline component (render prop). Priority:
    // `$use*` hook > uppercase component > `@signal-component` marker.
    const isMarkedComponent =
      config.markerSignalComponent && hasSignalComponentMarker(path.node);

    if (!isHook && !isComponent && !isMarkedComponent) return;

    if (config.patternSignalDeclaration) processParams(path);
    if (isHook && config.customHookSignal) processReturns(path, state);
  };

  const visitCall = (path: NodePath<t.CallExpression>, state: State) => {
    if (!config.customHookSignal) return;
    const callee = path.node.callee;
    if (!t.isIdentifier(callee) || !isCustomHook(callee.name)) return;

    // Spread arguments are rejected: `f(...arr)` snapshots the argument list
    // at the call site, so the hook's params would be fixed at call time and
    // lose reactivity to the source signal (length changes in particular can
    // never reach the hook). There is no spread shape that preserves the
    // signal contract — pass the array signal as a single argument instead.
    const spread = path.node.arguments.find((arg) => t.isSpreadElement(arg));
    if (spread) {
      throw path.buildCodeFrameError(
        `signal-compiler: spread arguments are not supported in custom hook calls ` +
          `(\`${callee.name}(...\`). Spreading snapshots the argument list at the ` +
          `call site and breaks the signal contract — the hook would not react ` +
          `to changes of the spread signal. Pass the array signal as a single ` +
          `argument instead, e.g. \`${callee.name}($params)\`.`
      );
    }

    const computed = ensureComputed(path, state);
    path.node.arguments = path.node.arguments.map((arg) =>
      computedCall(computed, arg as t.Expression)
    );
  };

  return {
    CallExpression: visitCall,
    FunctionDeclaration: visitFunction,
    FunctionExpression: visitFunction,
    ArrowFunctionExpression: visitFunction,
  };
};
