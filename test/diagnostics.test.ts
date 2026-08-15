import { it, expect, vi, afterEach } from "vitest";
import { transform } from "@babel/core";
import { signalCompiler } from "../src/index";

const compile = (code: string, opts: Record<string, unknown> = {}) =>
  transform(code, {
    plugins: [
      ["@babel/plugin-syntax-jsx"],
      [signalCompiler, { importSource: "source", ...opts }],
    ],
  })!.code!;

const capture = (code: string, opts: Record<string, unknown> = {}) => {
  const warns: string[] = [];
  const spy = vi.spyOn(console, "warn").mockImplementation((m: string) => warns.push(m));
  compile(code, opts);
  spy.mockRestore();
  return warns.join("\n");
};

it("diagnostics: broken chain via const", () => {
  const w = capture("let $a = 1;\nconst b = $a;");
  expect(w).toContain('"$a" is a signal but is assigned to non-signal "b"');
});

it("diagnostics: broken chain via assignment", () => {
  const w = capture("let $a = 1;\nlet b;\nb = $a;");
  expect(w).toContain('"$a" is a signal but is assigned to non-signal "b"');
});

it("diagnostics: $-name without initializer", () => {
  const w = capture("let $a;");
  expect(w).toContain('"$a" has a $ prefix but no initializer');
});

it("diagnostics: contract-violating function name", () => {
  const w = capture("function $foo() {}");
  expect(w).toContain('function "$foo" starts with $');
});

it("diagnostics: clean code warns nothing", () => {
  const w = capture(
    "let $a = 1;\nconst $b = $a + 1;\nfunction $useFoo() {}\nfunction App() {}\nconst { x } = $a;"
  );
  expect(w).toBe("");
});

it("diagnostics: can be disabled via config", () => {
  const w = capture("let $a = 1;\nconst b = $a;", { diagnostics: false });
  expect(w).toBe("");
});

it("custom hook: spread argument is a compile error", () => {
  expect(() => compile("const $qs = $useQuery(...$params);")).toThrow(
    "spread arguments are not supported in custom hook calls"
  );
});

it("custom hook: spread error mentions the suggested fix", () => {
  expect(() => compile("$useF(...$params);")).toThrow(
    "Pass the array signal as a single argument instead"
  );
});

it("custom hook: spread error respects customHookSignal: false", () => {
  const code = compile("$useF(...$params);", { customHookSignal: false });
  // no error, and the read visitor still rewrites the signal identifier
  expect(code).toBe("$useF(...$params.value);");
});
