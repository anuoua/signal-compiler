# Signal Compiler

一种基于**命名约定**的编译策略，用于构建 Signal 信号驱动的响应式应用。

只要给变量加上 `$` 前缀，编译器就会在构建时把它自动转换成信号——开发时几乎无感，代码更接近普通变量，可读性更高，同时获得完整的 TypeScript 类型推导。

告别冗长的 `signal()` 包装器，拥抱声明式响应性。　[English](./README-en_US.md)

## 特点

- **声明式 API**：用熟悉的 `$` 前缀变量，无需学习新的运行时原语。
- **命名即信号**：`$` 前缀是唯一约定，信号与普通变量泾渭分明，显式可控。
- **框架无关**：提供 Babel 插件与 Vite/Rollup 插件，可与 [j20](https://github.com/anuoua/j20)、[Preact Signals](https://github.com/preactjs/signals) 等任意信号库搭配。
- **类型友好**：源码里就是普通变量，TypeScript 无需任何特殊配置即可正常工作。

## 工作原理

编译器扫描代码中所有 `$` 前缀的标识符，并按规则改写：

- `let $x = v` → 创建可变信号
- `const $x = v` → 创建派生信号
- 读取 `$x` → 自动追加 `.value`
- 赋值 `$x = v` → 重定向到 `.value = v`

所需的 `signal` / `computed` 会从你指定的模块（`importSource`）**按需自动注入**——只有当文件里真正创建或派生信号时才注入对应的辅助函数（为避免与已有变量冲突，注入的标识符带下划线前缀）。因此一个**只读取、赋值**信号的文件（例如跨文件消费）不会产生任何额外 import；只有声明了信号的文件顶部才会出现：

```javascript
import { signal as _signal, computed as _computed } from "@preact/signals";
```

> 下文各规则的「编译为」省略了重复的 import 行，但 `_signal` / `_computed` 即代表上述按需注入的辅助函数。

## 快速开始

### 安装

```bash
npm install signal-compiler
```

### Babel 配置

```javascript
// babel.config.js
import { signalCompiler } from "signal-compiler";

export default {
  plugins: [
    [signalCompiler, { importSource: "@preact/signals" }],
  ],
};
```

### Vite 配置

```javascript
// vite.config.js
import { defineConfig } from "vite";
import { signalCompilerRollup } from "signal-compiler/rollup";

export default defineConfig({
  plugins: [
    signalCompilerRollup({
      include: "src/**/*.{js,jsx,ts,tsx}",
      config: { importSource: "@preact/signals" },
    }),
  ],
});
```

运行 `vite dev` 或 `vite build`，`$` 前缀代码即被自动编译。

## 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `importSource` | `string` | `"j20"` | `signal` / `computed` 的来源模块 |
| `autoImport` | `boolean` | `true` | 是否自动（按需）注入 `signal` / `computed`（关闭则需自行导入，标识符须命名为 `signal` / `computed`） |
| `diagnostics` | `boolean` | `true` | 开启编译期诊断（响应链断裂、命名契约违例，见[诊断](#诊断)） |
| `identifierSignalDeclaration` | `boolean` | `true` | `let` / `const $x` 标识符声明的转换 |
| `patternSignalDeclaration` | `boolean` | `true` | 解构声明（`let/const { a: $a }`）的转换 |
| `identifierSignalRead` | `boolean` | `true` | 信号读取时追加 `.value` |
| `identifierSignalAssign` | `boolean` | `true` | 信号赋值时重定向到 `.value` |
| `customHookSignal` | `boolean` | `true` | 自定义 Hook（`$use*`）的参数与返回值转换 |
| `markerSignalComponent` | `boolean` | `true` | 识别 `@signal-component` 注释标记的行内组件（render prop，见[行内组件](#8-行内组件signal-component-标记)） |

> Babel 用户直接在插件选项中传入；Vite/Rollup 用户将其放在 `config` 字段下。

## 编译规则

### 1. 创建信号

`let` 声明的 `$` 前缀变量会被 `signal()` 包裹：

```javascript
let $name = 1;
// 编译为：
let $name = _signal(1);
```

### 2. 读取信号

任何对信号的引用都会自动追加 `.value`：

```javascript
let $name = 1;
console.log($name);
// 编译为：
let $name = _signal(1);
console.log($name.value);
```

### 3. 赋值信号

对信号赋值会重定向到 `.value`，包括复合赋值与自增自减：

```javascript
let $name = 1;
$name = 2;
$name += 1;
$name++;
console.log($name);
// 编译为：
let $name = _signal(1);
$name.value = 2;
$name.value += 1;
$name.value++;
console.log($name.value);
```

**解构赋值语句**（非声明的 `({ $a } = obj)` / `[$a] = arr`）同样会把每个 `$` 目标重定向到 `.value`：

```javascript
let $a, $b;
({ $a, k: $b } = obj);
[$a, $b] = arr;
// 编译为：
({ $a: $a.value, k: $b.value } = obj);
[$a.value, $b.value] = arr;
```

### 4. 派生信号

`const` 声明的 `$` 前缀变量会被 `computed()` 包裹，自动建立依赖：

```javascript
let $name = 1;
const $displayName = $name + "a";
// 编译为：
let $name = _signal(1);
const $displayName = _computed(() => $name.value + "a");
```

**例外**：当初始化表达式本身已经是信号来源时，会跳过 `computed` 包裹——包括自定义 Hook 调用（`$useX(...)`，其返回值已是信号）和透传调用 `$()`（见下条）。

### 5. 信号透传 `$()`

当信号出现在 **名为 `$` 的函数调用**中时，编译器会**跳过**对其 `.value` 的转换。`$` 表示「我明确要的是信号对象本身」。因此 `const $x = $($a)` 这种形式不会被包成 `computed`，参数 `$a` 也不会被追加 `.value`：

```javascript
let $a = 1;
const $b = $($a);
// 编译为：
let $a = _signal(1);
const $b = $($a);
```

这在与需要「信号对象本身」的 API 交互时非常有用。

### 6. 自定义 Hook

函数名以 `$use` 开头的函数会被视为自定义 Hook。编译器会：

1. 把**返回值**包裹进 `computed`；
2. 在**调用处**把每个实参包裹进 `computed`（以保留响应性）。

```javascript
function $useName($age) {
  let $name = 1;
  return $name + $age;
}
let $age = 1;
const $name = $useName($age);
console.log($name);

// 编译为：
function $useName($age) {
  let $name = _signal(1);
  return _computed(() => $name.value + $age.value);   // 返回值 → computed
}
let $age = _signal(1);
// 派生信号 const $name 的初始值是 Hook 调用，故跳过 computed 包裹；
// 调用时实参 $age 被包进 computed。
const $name = $useName(_computed(() => $age.value));
console.log($name.value);
```

> Hook 体内**所有** `return`（含 `if` / `for` / `try` 等嵌套块中的）都会被包裹；属于内部嵌套函数的 `return` 不会。

**展开参数不被支持（编译器的限制）**：自定义 Hook（`$use*`）、组件、`@signal-component` 标注的函数，**调用处展开传入**（`$useQuery(...$params)`）或**声明处使用 rest 参数**（`(...args)`、`(...$args)`）都会编译报错——这三类函数的参数必须是**固定的、命名的 `$` 信号**，展开/rest 会固化或动态化参数列表，破坏信号契约：

```javascript
const $qs = $useQuery(...$params); // ⚠ 报错：spread arguments are not supported
const $useQuery = (...args) => ...; // ⚠ 报错：rest parameter "args" is not supported
// 改为：数组信号参数
const $useQuery = ($params) => $params.value.map(a => a.value);
const $qs = $useQuery($params);
```

> 例外：解构 pattern 内的 rest（`({ a: $a, ...$rest })`）是**对象剩余属性**，不是参数集合，会被正常转换为 `$rest` computed，不受此限制。

### 7. 组件函数

函数名首字母大写（符合 React 组件约定）即视为组件。组件的**每一个参数都必须是 `$` 信号**（自定义 Hook、组件、`@signal-component` 标注函数的统一契约）——标识符参数不带 `$`（`(props)`）或解构别名不带 `$`（`({ a: b })`）会在编译期报错。

- **标识符参数**（如 `($props)`）：不解构、不改写。框架传入的是信号对象，函数体内对 `$props` 的引用会照常追加 `.value`。
- **解构参数**：会被替换为临时变量，每个 `$` 前缀的解构目标转成 `computed`（含默认值与 `...$rest`）：

```javascript
const App = ({ msg: $msg = "hello" }) => {
  return $msg;
};
// 编译为：
const App = __$0 => {
  const $msg = _computed(() => __$0.value["msg"] ?? "hello");
  return $msg.value;
};
```

### 8. 行内组件（`@signal-component` 标记）

行内组件（render prop，如 `<Comp Title={({ msg: $msg }) => ...} />`）是**匿名函数**，没有名字可依。signal-compiler 本身不处理 JSX，因此约定：由 JSX 转换插件（如 j20 的 jsx-transform）在函数节点上添加 `@signal-component` 注释标记，编译器检测到标记即按组件编译（参数解构 → `computed`）：

```javascript
// 源（JSX 转换插件先于 signal-compiler 执行，并在函数上添加标记）：
const Comp = () => ({
  get Title() {
    return /* @signal-component */ ({ msg: $msg }) => {
      return $msg;
    };
  },
});
// 编译为：
const Comp = () => ({
  get Title() {
    return /* @signal-component */ __$0 => {
      const $msg = _computed(() => __$0.value["msg"]);
      return $msg.value;
    };
  },
});
```

要点：

- **标记必须用块注释**（`/* @signal-component */`，即 `t.addComment(node, "leading", "@signal-component")`），不要用行注释——行内组件常落在 `return` 表达式位置，行注释会触发 ASI 损坏代码。
- 标记需在 signal-compiler 运行**之前**存在，因此 JSX 转换插件必须先于 signal-compiler 执行（独立 Babel pass）。
- 识别优先级：`$use*` Hook > 首字母大写组件 > `@signal-component` 标记。
- 标记字符串可从入口导出以避免漂移：`import { SIGNAL_COMPONENT_MARKER } from "signal-compiler"`。
- 可通过 `markerSignalComponent: false` 关闭。

### 9. 解构赋值

通过 `$` 前缀的别名接收解构值，可保留响应性。编译器会把整个右侧包进 `computed`，再为每个 `$` 别名生成一个 `computed` 访问：

```javascript
function $useName({ name: $name }) {
  return { displayName: $name + "a" };
}
const { displayName: $displayName } = $useName({ name: 1 });
console.log($displayName);

// 编译为：
function $useName(__$0) {
  const $name = _computed(() => __$0.value["name"]);
  return _computed(() => ({
    displayName: $name.value + "a"
  }));
}
const __$1 = $useName(_computed(() => ({ name: 1 })));
const $displayName = _computed(() => __$1.value["displayName"]);
console.log($displayName.value);
```

> `__$0`、`__$1` … 是编译器生成的临时变量（下划线开头，全局递增），用来暂存信号对象。

## 信号传递

信号只能传递给下一个信号——即传递链上的每一步都必须保持 `$` 前缀（包括函数入参）。一旦在中途赋给非 `$` 前缀的变量，响应链就会断裂，界面不再更新。

```javascript
const $useMsg = ({ msg: $msg = "hello" }) => {
  return { msg: $msg };
};
let $hello2 = { msg: "hello2" };
const { msg: $msg } = $useMsg($hello2);
```

链路：`$hello2 → $useMsg($hello2) → { msg: $msg }`，每一步都保持了 `$` 前缀，传递成功。

## 诊断

开启 `diagnostics`（默认开启）后，编译器会对三类**原本会静默失效**的错误打印带代码位置的警告（不会中断编译）：

1. **响应链断裂**——信号被赋给非 `$` 前缀的变量：
   ```javascript
   let $a = 1;
   const b = $a;   // ⚠ "$a" is a signal but is assigned to non-signal "b" — the reactive chain breaks here.
   ```
2. **命名契约违例**——`$` 前缀的声明无法成为信号：
   ```javascript
   let $a;              // ⚠ "$a" has a $ prefix but no initializer, so it will not become a signal.
   function $foo() {}   // ⚠ function "$foo" starts with $ but is neither a custom hook ($use*) nor a component.
   ```
3. **解构快照断裂**——从信号源解构出非 `$` 前缀的普通别名，该别名会成为声明时刻的一次性快照：
   ```javascript
   const { a: $a, hello } = $some;  // ⚠ "hello" is destructured from signal "$some" without a $ prefix — the reactive chain breaks here.
   // 需要响应时改为：const { a: $a, hello: $hello } = $some;
   ```

警告带文件位置与代码高亮，便于排查；可通过 `diagnostics: false` 关闭。

## 局限与注意事项

- **基于命名约定**：编译器仅凭 `$` 前缀识别信号，**不区分作用域与绑定**。任何带 `$` 前缀的标识符（包括第三方代码、jQuery 风格的 `$xxx`）都会被当作信号转换。混用此类代码时请注意隔离。
- **响应链必须显式维护**：见[信号传递](#信号传递)，丢失 `$` 前缀即丢失响应性——开启 [诊断](#诊断) 可在编译期自动发现这类断裂。
- **`$` 前缀是强约定**：`$use*` 是 Hook、首字母大写且带 `$` 参数的是组件、其余 `$xxx` 是信号。请避免命名冲突。
- **行内组件需标记**：匿名函数（render prop）不会被自动识别为组件，需要 JSX 转换插件添加 `@signal-component` 注释（见[行内组件](#8-行内组件signal-component-标记)），且该插件必须先于 signal-compiler 执行。

## TypeScript

源码中 `$` 前缀变量就是普通变量，类型按正常规则推导，无需任何额外配置：

```typescript
let $count = 0;        // TS 推导为 number
const $double = $count * 2;  // TS 推导为 number
```

需要注意：TypeScript 仍把这些变量当作普通值（如 `number`），它**不知道**运行时这其实是个信号对象。这是该方案的取舍——换来的是零类型配置与原生语法。编译（信号化）只发生在 Babel / Rollup 构建阶段，不影响类型检查。

## 许可证

[MIT](./LICENSE)
