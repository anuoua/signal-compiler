# 信号 Signal 编译器 [English](./README-en_US.md)

一种革命性的编译策略，用于构建基于 Signal 信号的响应式应用程序。

让信号的开发接近无感，大幅增加可读性，同时享受无缝的 TypeScript 支持和卓越的开发者体验。

## 特点

- **直观 API**：使用熟悉的 `$` 前缀变量——无需学习新原语。
- **信号传递**：通过显式命名标记强制传递响应链，显式可控。
- **框架无关**：兼容 Babel、Vite 等工具。与 [j20](https://github.com/anuoua/j20) 或者 [Preact Signal](https://github.com/preactjs/signals) 等信号库完美搭配。
- **无混淆**：信号与普通变量区分开，不会混淆。

告别冗长的信号包装器，迎接声明式响应性！

## 快速开始

### 安装

```bash
npm install signal-compiler
```

### Babel 配置

在 `babel.config.js` 中添加插件：

```javascript
import { signalCompiler } from "signal-compiler";

export default {
  plugins: [
    [
      signalCompiler,
      {
        importSource: "@preact/signals", // 指定信号模块（例如 '@preact/signals'）
      },
    ],
  ],
};
```

### Vite 配置

在 `vite.config.js` 中通过 Rollup 插件集成：

```javascript
import { defineConfig } from "vite";
import { signalCompilerRollup } from "signal-compiler/rollup";

export default defineConfig({
  plugins: [
    signalCompilerRollup({
      include: "src/**/*.{js,jsx,ts,tsx}", // 目标文件/目录
      config: {
        importSource: "@preact/signals",
      },
    }),
  ],
});
```

运行您的构建（ `npm run build` 或 `vite dev` ），您的 `$` 前缀代码将神奇地变为响应式！

## 核心编译策略

编译策略基于**命名标记**，使信号的使用极其无感，让开发者编写更直观的代码；

编译器会从您指定的模块（例如 @preact/signals）自动注入 `signal()` 和 `computed()` 。

### 编译策略

1、**信号创建**

使用 `let` 搭配 `$` 前缀：

```javascript
let $name = 1;
// 编译为：
import { signal } from "@preact/signals";
let $name = signal(1);
```

2、**信号读取**

自动追加 `.value` ：

```javascript
let $name = 1;
console.log($name);
// 编译为：
let $name = signal(1);
console.log($name.value);
```

3、**信号赋值**

重定向到 `.value` ：

```javascript
let $name = 1;
$name = 2;
console.log($name);
// 编译为：
let $name = signal(1);
$name.value = 2;
console.log($name.value);
```

4、**信号派生**

使用 `const` 搭配 `$` 前缀：

```javascript
let $name = 1;
const $displayName = $name + "a";
// 编译为：
import { signal, computed } from "@preact/signals";
let $name = signal(1);
const $displayName = computed(() => $name.value + "a");
```

注：派生信号如果紧接着自定义 Hook，会跳过编译，因为自定义 Hook 返回的结果已经是信号。

5、**自定义 Hook**

函数名以 `$use` 前缀会触发编译，解构入参和出参均会被处理：

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
  let $name = signal(1);
  // 1. 返回值包裹在 computed 中
  return computed(() => $name.value + $age.value);
}
let $age = signal(1);
// 2. 自定义 Hook 函数，参数会被包裹在 computed 中
// const $name 派生信号在遇到自定义 Hook 时会跳过编译
// 所以 $useName 不会被包裹在 computed 中。
const $name = $useName(computed(() => $age.value));
console.log($name.value);
```

6、**组件函数**

函数名首字母为大写（以匹配类 React 框架的组件函数），而且入参包含以 `$` 为前缀的变量，会触发编译，解构入参会被处理。

```javascript
const App = ($props) => {}; // 入参不解构，无需处理，框架在传入前自行处理

const App = ({ msg: $msg = "hello" }) => {};
// 编译为
const App = (__$0) => {
  const $msg = computed(() => __$0.value.msg ?? "hello");
};
```

7、**解构赋值**

通过设置 `$` 前缀的变量别名激活编译策略，以保持响应性：

```javascript
// 输入参数为信号，name 变量需要使用 $ 前缀的别名传递，激活编译策略，以保留响应性。
function $useName({ name: $name }) {
  return {
    displayName: $name + "a",
  };
}

// 通过别名 $displayName 激活编译策略， 以保留响应性。
const { displayName: $displayName } = $useName({
  name: 1,
});
console.log($displayName);

// 编译为：
function $useName($__0) {
  // $__0 是临时变量，存储入参参数。
  const $name = computed(() => $__0.value.name);
  return computed(() => ({
    displayName: $name.value + "a",
  }));
}

const $__0 = $useName(
  computed(() => ({
    name: 1,
  }))
);
const $displayName = computed(() => $__0.value.displayName);
console.log($displayName.value);
```

## 信号传递

信号只能传递给下一个信号，即总是保持 `$` 前缀，包括入参。

一旦传递过程中传递给了非信号变量，那么你所期望的响应链就会中断，最终造成你的界面不再更新。

```javascript
const $useMsg = ({ msg: $msg = "hello" }) => {
  return {
    msg: $msg,
  }
};

let $hello2 = { msg: "hello2" };

const { msg: $msg } = $useMsg($hello2);
```

上面是一个常规的用法，信号传递成功：

```
$hello2 -> $useMsg($hello2) -> { msg: $msg }
```

每一步信号都传递给了下一个信号，始终保持 `$` 前缀。

## 许可证

MIT
