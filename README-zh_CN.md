# 信号编译器

一种革命性的编译时策略，用于构建基于信号的响应式应用程序。

让信号的开发接近无感，大幅增加可读性，同时享受无缝的 TypeScript 支持和卓越的开发者体验。

## ✨ 为什么选择信号编译器？

- **零运行时开销**：在构建时将普通 JavaScript 转换为细粒度响应式信号。
- **直观 API**：使用熟悉的 `$` 前缀变量——无需学习新原语。
- **信号传播**：通过显式传递强制执行响应链，防止意外的非响应泄漏。
- **框架无关**：兼容 Babel、Vite 等工具。与 [J20](https://example.com/j20) 等信号库完美搭配。
- **类型安全**：开箱即用的完整 TypeScript 类型推断。

告别冗长的信号包装器，迎接声明式响应性！

> 很重要的一点，信号会和普通变量区别开来，让你不会搞混。

## 🚀 快速开始

### 安装

```bash
npm install signal-compiler
```

### Babel 配置

在 `babel.config.js` 中添加插件：

```javascript
import { signalCompiler } from 'signal-compiler';

export default {
  plugins: [
    [
      signalCompiler,
      {
        importSource: 'j20', // 指定信号模块（例如 'j20'）
      },
    ],
  ],
};
```

### Vite 配置

在 `vite.config.js` 中通过 Rollup 插件集成：

```javascript
import { defineConfig } from 'vite';
import { signalCompilerRollup } from 'signal-compiler/rollup';

export default defineConfig({
  plugins: [
    signalCompilerRollup({
      include: 'src/**/*.{js,jsx,ts,tsx}', // 目标文件/目录
      config: {
        importSource: 'j20',
      },
    }),
  ],
});
```

运行您的构建（`npm run build` 或 `vite dev`），您的 `$` 前缀代码将神奇地变为响应式！

## 📖 核心编译策略

此策略利用**基于名称的标签传播**使信号感觉像原生一样。开发者编写直观的代码；编译器从您指定的模块（例如 J20）注入 `signal()` 和 `computed()`。

### 核心概念

1. **信号变量**：以 `$`（非`$use`） 前缀的变量实际上为信号对象，用户无感，和普通变量一样使用。
2. **信号读取**：所有信号变量读取的时候都会自动解包，无需手动添加 `.value`，用户无感，和普通变量一样使用。
4. **信号赋值**：信号变量赋值时，会自动添加 `.value`，用户无感，和普通变量一样赋值即可。
3. **信号传播**：信号必须通过 `$` 前缀变量（通常为派生信号，既 `computed` ）传递才能保持响应性，否则变量值为原信号对象，需要手动添加 `.value` 取值。

### 编译规则

1. **信号创建**  

   使用 `let` 搭配 `$` 前缀：

   ```javascript
   let $name = 1;
   // 编译为：
   let $name = signal(1);
   ```

2. **信号读取**  

   自动追加 `.value`：

   ```javascript
   let $name = 1;
   console.log($name);
   // 编译为：
   let $name = signal(1);
   console.log($name.value);
   ```

3. **信号赋值**  

   重定向到 `.value`：

   ```javascript
   let $name = 1;
   $name = 2;
   console.log($name);
   // 编译为：
   let $name = signal(1);
   $name.value = 2;
   console.log($name.value);
   ```

4. **信号派生**

   使用 `const` 搭配 `$` 前缀：

   ```javascript
   let $name = 1;
   const $displayName = $name + 'a';
   // 编译为：
   let $name = signal(1);
   const $displayName = computed(() => $name.value + 'a');
   ```

5. **自定义 Hook**  
   函数名以 `$use` 前缀以实现响应性：

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
     // 返回值包裹在 computed 中
     return computed(() => $name.value + $age.value);
   }
   let $age = signal(1);
   const $name = $useName(computed(() => $age.value)); // 参数包裹在 computed 中
   console.log($name.value);
   ```

6. **解构赋值**  
   通过别名传播信号：

   ```javascript
   // 输入参数为信号，name 变量需要使用 $ 前缀的别名传递，以保留响应性（核心传播概念）。
   function $useName({ name: $name }) {
     return {
       displayName: $name + 'a',
     };
   }

   // 通过别名 $displayName 传递以保留响应性（核心传播概念）。
   const { displayName: $displayName } = $useName({ name: 1 });
   console.log($displayName);

   // 编译为：
   function $useName($__0) {
     // $__0 是临时变量，存储 computed 参数。
     const $name = computed(() => $__0.value.name);
     return computed(() => ({
       displayName: $name.value + 'a',
     }));
   }

   const $__0 = $useName(computed(() => ({ name: 1 })));
   const $displayName = computed(() => $__0.value.displayName);
   console.log($displayName.value);
   ```

## 📄 许可证

MIT
