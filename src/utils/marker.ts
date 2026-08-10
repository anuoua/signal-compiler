import type { Node } from "@babel/types";

/**
 * Comment marker that marks a function as an inline component (render prop),
 * e.g. `<Comp Title={({ msg: $msg }) => ...} />`.
 *
 * The JSX transform plugin (j20's jsx-transform) attaches this comment to the
 * function node *before* signal-compiler runs, so signal-compiler itself stays
 * JSX-agnostic — it only has to recognize the marker. This requires the JSX
 * transform to run first in the pipeline (separate Babel pass), because the
 * marker must already exist when signal-compiler's function visitor fires.
 *
 * Attach it with a block comment (NOT a line comment — `return // @marker`
 * would break under ASI):
 *
 * ```js
 * path.addComment("leading", " @signal-component "); // on the function node
 * ```
 */
export const SIGNAL_COMPONENT_MARKER = "@signal-component";

/**
 * True when `node` carries a `@signal-component` marker comment (leading,
 * trailing or inner). Substring match, so `/* @signal-component *​/` with any
 * surrounding whitespace is recognized.
 */
export const hasSignalComponentMarker = (node: Node): boolean =>
  [
    ...(node.leadingComments ?? []),
    ...(node.trailingComments ?? []),
    ...(node.innerComments ?? []),
  ].some((comment) => comment.value.includes(SIGNAL_COMPONENT_MARKER));
