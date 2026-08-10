import { it, expect } from "vitest";
import {
  signalCompiler,
  SIGNAL_COMPONENT_MARKER,
  hasSignalComponentMarker,
  hasSignalInPattern,
  isDollar,
  isSignal,
  isCustomHook,
  isComponentFunction,
} from "../src/index";
import * as t from "@babel/types";

// 这些工具是给 JSX 转换插件（j20 的 jsx-transform）共用的约定/标记接口，
// 公开导出后必须保持稳定，防止 j20 侧复制逻辑导致约定漂移。
it("exports the naming-convention helpers", () => {
  expect(isDollar("$")).toBe(true);
  expect(isDollar("$a")).toBe(false);

  expect(isSignal("$a")).toBe(true);
  expect(isSignal("$useX")).toBe(false); // hook 不算信号
  expect(isSignal("$")).toBe(false);

  expect(isCustomHook("$useName")).toBe(true);
  expect(isCustomHook("$name")).toBe(false);

  expect(isComponentFunction("App")).toBe(true);
  expect(isComponentFunction("app")).toBe(false);
});

it("exports hasSignalInPattern", () => {
  expect(hasSignalInPattern(t.objectPattern([t.objectProperty(t.identifier("msg"), t.identifier("$msg"))]))).toBe(true);
  expect(hasSignalInPattern(t.objectPattern([t.objectProperty(t.identifier("msg"), t.identifier("msg"))]))).toBe(false);
  expect(hasSignalInPattern(t.arrayPattern([t.identifier("$x")]))).toBe(true);
});

it("exports marker helpers", () => {
  expect(SIGNAL_COMPONENT_MARKER).toBe("@signal-component");
  const fn = t.arrowFunctionExpression([], t.identifier("undefined"));
  t.addComment(fn, "leading", ` ${SIGNAL_COMPONENT_MARKER} `);
  expect(hasSignalComponentMarker(fn)).toBe(true);
});

it("still exports the plugin entry", () => {
  expect(typeof signalCompiler).toBe("function");
});
