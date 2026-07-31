import { it, expect } from "vitest";
import { transform } from "@babel/core";
import { signalCompiler } from "../src/index";

const run = (code: string) =>
  transform(code, {
    plugins: [
      ["@babel/plugin-syntax-jsx"],
      [signalCompiler, { importSource: "source" }],
    ],
  })!.code!;

it("bug1: nested return inside if must be wrapped", () => {
  const out = run("function $useFoo($a) {\n  if (true) return $a;\n  return $a + 1;\n}\n");
  console.log("\n--- bug1 nested-return ---\n" + out);
  // both the nested and the top-level return get wrapped (excludes the import line)
  const wrappedReturns = (out.match(/_computed\(\(\) =>/g) || []).length;
  expect(wrappedReturns).toBe(2);
  expect(out).not.toContain("return $a.value;"); // no bare signal return
});

it("bug2: plain named function param is not rewritten (consistent w/ arrow)", () => {
  const out = run("function helper({ x: $x }) {\n  return $x;\n}\n");
  console.log("\n--- bug2 plain-fn ---\n" + out);
  expect(out).not.toContain("__$"); // no temp var / param rewrite
  expect(out).toContain("x: $x"); // destructure pattern preserved
});

it("bug3: named-function-expression hook return is wrapped", () => {
  const out = run("const $useBar = function ($a) { return $a; };\n");
  console.log("\n--- bug3 fn-expr-hook ---\n" + out);
  expect(out).toContain("_computed(() => $a.value)");
});

it("bug4: local `let signal` does not hijack import injection", () => {
  const out = run("let signal = 99;\nlet $a = 1;\nconsole.log($a, signal);\n");
  console.log("\n--- bug4 shadowed-signal ---\n" + out);
  expect(out).toContain("import { signal as _signal"); // injected despite local binding
  expect(out).toContain("_signal(1)"); // uses the injected helper
});
