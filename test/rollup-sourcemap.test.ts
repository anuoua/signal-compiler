import { it, expect } from "vitest";
import { rollup } from "rollup";
import { SourceMapConsumer } from "source-map-js";
import { signalCompilerRollup } from "../src/rollup";

/**
 * 回归测试：signalCompilerRollup 必须返回真正的 sourcemap。
 *
 * 旧实现（0.1.11）调用 babelCore.transform() 时没传 sourceMaps: true，
 * result.map 恒为 null，rollup 因此假定该 transform 位置不变。
 * 一旦 signal-compiler 增删行（例如 autoImport 在文件头部注入一行 import），
 * 最终 sourcemap 就会整体漂移一行。
 */
const J20_STUB = `export const signal = (v) => v; export const computed = (f) => f();`;

// 故意不 import j20 —— signal-compiler 会在文件顶部注入一行 import（整体下移一行）
const SOURCE = `export const App = () => {
  const [todos, setTodos] = createSignal([]);
  let $count = 0;
  return todos().map((todo) => [$count, todo.text]);
};
`;

const loaders = {
  name: "virtual-loader",
  resolveId(id: string) {
    return id === "entry.js" || id === "j20" ? id : null;
  },
  load(id: string) {
    return id === "j20" ? J20_STUB : SOURCE;
  },
};

it("transform hook 返回非 null 的 map，sources 指向模块 id", () => {
  const plugin = signalCompilerRollup({ config: { importSource: "j20" } }) as unknown as {
    transform(code: string, id: string): {
      code: string;
      map: { sources: string[]; sourcesContent: string[] } | null;
    } | null;
  };
  const result = plugin.transform.call(
    { error: () => undefined, warn: () => undefined },
    SOURCE,
    "src/entry.js"
  );
  expect(result).not.toBeNull();
  expect(result!.map).not.toBeNull();
  // babel 会把 filename 归一化为 basename；重点是 sources 不再是 "unknown"
  expect(result!.map!.sources).toEqual(["entry.js"]);
  expect(result!.map!.sourcesContent[0]).toBe(SOURCE);
});

it("注入 import 导致行号下移时，最终 sourcemap 仍精确映射回源文件", async () => {
  const bundle = await rollup({
    input: "entry.js",
    treeshake: false,
    plugins: [loaders, signalCompilerRollup({ config: { importSource: "j20" } })],
  });
  const { output } = await bundle.generate({ format: "es", sourcemap: true });
  const { code, map } = output[0];
  expect(map).not.toBeNull();

  const consumer = await new SourceMapConsumer(map as object);
  const idx = code.indexOf("todo.text");
  expect(idx).toBeGreaterThan(-1);
  const before = code.slice(0, idx);
  const outLines = before.split("\n");
  const orig = consumer.originalPositionFor({
    line: outLines.length,
    column: outLines[outLines.length - 1].length,
  });
  consumer.destroy?.();

  const expectedLine =
    SOURCE.split("\n").findIndex((line) => line.includes("todo.text")) + 1;
  expect(orig.source).toMatch(/entry\.js$/);
  // 旧实现（map: null）这里会得到 expectedLine + 1（漂移一行）
  expect(orig.line).toBe(expectedLine);
});
