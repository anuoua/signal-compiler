import * as t from "@babel/types";

export const signalCall = (name: string, expr: t.Expression): t.Expression =>
  t.callExpression(t.identifier(name), [expr]);

export const computedCall = (name: string, expr: t.Expression): t.Expression =>
  t.callExpression(t.identifier(name), [t.arrowFunctionExpression([], expr)]);

export const valueOf = (id: t.Expression): t.MemberExpression =>
  t.memberExpression(id, t.identifier("value"), false);
