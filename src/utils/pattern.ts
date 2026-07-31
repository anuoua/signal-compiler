import * as t from "@babel/types";
import { template } from "@babel/core";
import { isSignal } from "./is";

export type PatternBuilder = (
  pattern: t.ObjectPattern | t.ArrayPattern,
  object: t.Expression | string,
  kind: "let" | "const",
  insert: (stmt: t.Statement) => void
) => void;

const memberAccess = template.expression(`%%OBJECT%%[%%PROPERTY%%]`);
const memberAccessWithInit = template.expression(
  `(%%OBJECT%%[%%PROPERTY%%] ?? %%INIT%%)`
);
const restSlice = template.expression(`%%OBJECT%%.slice(%%PROPERTY%%)`);

const makeDecl = (kind: "let" | "const") =>
  template.statement(`${kind} %%VAR_NAME%% = %%INIT%%`);

const makeRestOmit = (
  kind: "let" | "const",
  omitKeys: string[],
  varName: string,
  init: unknown
): t.Statement =>
  template.statement(`
    ${kind} %%VAR_NAME%% = (() => {
      const { ${omitKeys
        .map((key, index) => (isSignal(key) ? `${key}: ___${index}` : key))
        .join(",")}, ...___${omitKeys.length} } = %%INIT%%;
      return ___${omitKeys.length};
    })()
  `)({ VAR_NAME: varName, INIT: init }) as t.Statement;

export const hasSignalInPattern = (
  id: t.ObjectPattern | t.ArrayPattern
): boolean => {
  if (t.isObjectPattern(id)) {
    return id.properties.some((p) => {
      if (t.isRestElement(p)) {
        return t.isIdentifier(p.argument) && isSignal(p.argument.name);
      }
      if (!t.isIdentifier(p.key)) return false;
      const value = (p as t.ObjectProperty).value;
      if (t.isIdentifier(value)) return isSignal(value.name);
      if (t.isAssignmentPattern(value)) {
        if (t.isIdentifier(value.left)) return isSignal(value.left.name);
        if (t.isObjectPattern(value.left) || t.isArrayPattern(value.left))
          return hasSignalInPattern(value.left);
      }
      if (t.isObjectPattern(value) || t.isArrayPattern(value))
        return hasSignalInPattern(value);
      return false;
    });
  }
  if (t.isArrayPattern(id)) {
    return id.elements.some((e) => {
      if (!e) return false;
      if (t.isIdentifier(e)) return isSignal(e.name);
      if (t.isAssignmentPattern(e)) {
        if (t.isIdentifier(e.left)) return isSignal(e.left.name);
        if (t.isObjectPattern(e.left) || t.isArrayPattern(e.left))
          return hasSignalInPattern(e.left);
      }
      if (t.isRestElement(e))
        return t.isIdentifier(e.argument) && isSignal(e.argument.name);
      if (t.isObjectPattern(e) || t.isArrayPattern(e))
        return hasSignalInPattern(e);
      return false;
    });
  }
  return false;
};

export const buildPattern: PatternBuilder = (pattern, object, kind, insert) => {
  const declare = (varName: string, init: unknown) =>
    insert(makeDecl(kind)({ VAR_NAME: varName, INIT: init }) as t.Statement);

  switch (pattern.type) {
    case "ObjectPattern": {
      const omitKeys: string[] = [];
      pattern.properties.forEach((property) => {
        if (t.isObjectProperty(property)) {
          if (t.isIdentifier(property.key)) omitKeys.push(property.key.name);
          const value = property.value as t.Node;
          switch (value.type) {
            case "Identifier": {
              declare(
                value.name,
                memberAccess({
                  OBJECT: object,
                  PROPERTY: `"${(property.key as t.Identifier).name}"`,
                })
              );
              break;
            }
            case "AssignmentPattern": {
              const key = `"${(property.key as t.Identifier).name}"`;
              if (t.isIdentifier(value.left)) {
                declare(
                  value.left.name,
                  memberAccessWithInit({
                    OBJECT: object,
                    PROPERTY: key,
                    INIT: value.right,
                  })
                );
              } else if (
                t.isArrayPattern(value.left) ||
                t.isObjectPattern(value.left)
              ) {
                const expr = memberAccessWithInit({
                  OBJECT: object,
                  PROPERTY: key,
                  INIT: value.right,
                });
                buildPattern(value.left, expr as t.Expression, kind, insert);
              }
              break;
            }
            case "ArrayPattern":
            case "ObjectPattern": {
              const expr = memberAccess({
                OBJECT: object,
                PROPERTY: `"${(property.key as t.Identifier).name}"`,
              });
              buildPattern(value, expr as t.Expression, kind, insert);
              break;
            }
          }
        } else if (t.isRestElement(property)) {
          if (t.isIdentifier(property.argument)) {
            insert(
              makeRestOmit(kind, omitKeys, property.argument.name, object)
            );
          }
        }
      });
      break;
    }
    case "ArrayPattern": {
      pattern.elements.forEach((element, elementIndex) => {
        if (element === null) return;
        switch (element.type) {
          case "Identifier": {
            declare(
              element.name,
              memberAccess({ OBJECT: object, PROPERTY: `"${elementIndex}"` })
            );
            break;
          }
          case "AssignmentPattern": {
            declare(
              (element.left as t.Identifier).name,
              memberAccessWithInit({
                OBJECT: object,
                PROPERTY: `"${elementIndex}"`,
                INIT: element.right,
              })
            );
            break;
          }
          case "RestElement": {
            declare(
              (element.argument as t.Identifier).name,
              restSlice({ OBJECT: object, PROPERTY: `${elementIndex}` })
            );
            break;
          }
          case "ArrayPattern":
          case "ObjectPattern": {
            const expr = memberAccess({
              OBJECT: object,
              PROPERTY: `"${elementIndex}"`,
            });
            buildPattern(element, expr as t.Expression, kind, insert);
            break;
          }
        }
      });
      break;
    }
  }
};

/**
 * Rewrite a destructuring *assignment* target (not a declaration) so that every
 * signal-named binding is redirected to its `.value`. Used for statement-form
 * destructuring assignments like `({ $a } = obj)` / `[$a] = arr`.
 *
 * Mutates the pattern in place. Caller is expected to `skip()` traversal of
 * the rewritten subtree so the read visitor does not touch the emitted
 * `.value` accesses.
 */
export const rewriteAssignmentPattern = (
  pattern: t.ObjectPattern | t.ArrayPattern
): void => {
  const wrap = (id: t.Expression): t.MemberExpression =>
    t.memberExpression(id, t.identifier("value"), false);

  if (t.isObjectPattern(pattern)) {
    pattern.properties.forEach((property) => {
      if (t.isObjectProperty(property)) {
        const value = property.value as t.Node;
        if (t.isIdentifier(value) && isSignal(value.name)) {
          property.value = wrap(t.cloneNode(value));
          property.shorthand = false;
        } else if (
          t.isAssignmentPattern(value) &&
          t.isIdentifier(value.left) &&
          isSignal(value.left.name)
        ) {
          value.left = wrap(value.left);
        } else if (t.isObjectPattern(value) || t.isArrayPattern(value)) {
          rewriteAssignmentPattern(value);
        }
      } else if (
        t.isRestElement(property) &&
        t.isIdentifier(property.argument) &&
        isSignal(property.argument.name)
      ) {
        property.argument = wrap(property.argument);
      }
    });
  } else if (t.isArrayPattern(pattern)) {
    pattern.elements.forEach((element, i) => {
      if (!element) return;
      if (t.isIdentifier(element) && isSignal(element.name)) {
        pattern.elements[i] = wrap(t.cloneNode(element));
      } else if (
        t.isAssignmentPattern(element) &&
        t.isIdentifier(element.left) &&
        isSignal(element.left.name)
      ) {
        element.left = wrap(element.left);
      } else if (
        t.isRestElement(element) &&
        t.isIdentifier(element.argument) &&
        isSignal(element.argument.name)
      ) {
        element.argument = wrap(element.argument);
      } else if (t.isObjectPattern(element) || t.isArrayPattern(element)) {
        rewriteAssignmentPattern(element);
      }
    });
  }
};
