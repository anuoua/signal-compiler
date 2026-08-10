import { it, expect } from "vitest";
import { transform } from "@babel/core";
import { signalCompiler, SIGNAL_COMPONENT_MARKER } from "../src/index";
import { hasSignalComponentMarker } from "../src/utils/marker";

const run = (code: string, opts: Record<string, unknown> = {}) =>
  transform(code, {
    plugins: [
      ["@babel/plugin-syntax-jsx"],
      [signalCompiler, { importSource: "source", ...opts }],
    ],
  })!.code!;

it("exports the marker contract string", () => {
  expect(SIGNAL_COMPONENT_MARKER).toBe("@signal-component");
});

it("anonymous function without marker is left untouched (no silent compile)", () => {
  const out = run("const f = ({ x: $x }) => $x;\n");
  expect(out).not.toContain("__$"); // no temp var / param rewrite
  expect(out).toContain("x: $x"); // destructure pattern preserved
});

it("marker on a named lowercase function still compiles it as a component", () => {
  const out = run("const renderItem = /* @signal-component */ ({ msg: $msg }) => $msg;\n");
  expect(out).toContain("__$0 =>");
  expect(out).toContain("const $msg = _computed(() => __$0.value[\"msg\"]);");
  expect(out).toContain("return $msg.value;");
});

it("markerSignalComponent: false disables the marker path", () => {
  const out = run(
    "const f = /* @signal-component */ ({ x: $x }) => $x;\n",
    { markerSignalComponent: false }
  );
  expect(out).not.toContain("__$"); // untouched
  expect(out).toContain("x: $x");
});

it("marker is recognized on leading/trailing/inner comments", () => {
  const withComments = (type: "leading" | "trailing" | "inner", value: string) => {
    const node: any = { type: "ArrowFunctionExpression" };
    node[`${type}Comments`] = [{ type: "CommentBlock", value }];
    return node;
  };
  expect(hasSignalComponentMarker(withComments("leading", " @signal-component "))).toBe(true);
  expect(hasSignalComponentMarker(withComments("trailing", "@signal-component"))).toBe(true);
  expect(hasSignalComponentMarker(withComments("inner", " x @signal-component y "))).toBe(true);
  expect(hasSignalComponentMarker(withComments("leading", " something-else "))).toBe(false);
});
