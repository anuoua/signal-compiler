# Signal Compiler [中文](./README.md)

A revolutionary compilation strategy for building Signal-based reactive applications.

Make signal development approachable and seamless, dramatically increasing readability while enjoying effortless TypeScript support and an exceptional developer experience.

## ✨ Why Choose Signal Compiler?

- **Zero runtime overhead**: Convert plain JavaScript to fine-grained reactive signals at build time.
- **Intuitive API**: Use familiar `$` prefixed variables—no need to learn new primitives.
- **Signal Propagation**: Force passing the reactive chain through explicit naming tags, preventing unintentional non-reactive leaks.
- **Framework Agnostic**: Compatible with tools like Babel and Vite. Works seamlessly with signal libraries like [j20](https://github.com/anuoua/j20) or [Preact Signal](https://github.com/preactjs/signals).
- **Type Safety**: Full TypeScript type inference out of the box.
- **No Confusion**: Signals and regular variables are clearly distinguished to avoid confusion.

Say goodbye to verbose signal wrappers and embrace declarative reactivity!

## 🚀 Quick Start

### Installation

```bash
npm install signal-compiler
```

### Babel Configuration

Add the plugin in `babel.config.js`:

```javascript
import { signalCompiler } from "signal-compiler";

export default {
  plugins: [
    [
      signalCompiler,
      {
        importSource: "@preact/signals", // Specify the signal module (e.g. '@preact/signals')
      },
    ],
  ],
};
```

### Vite Configuration

Integrate via the Rollup plugin in `vite.config.js`:

```javascript
import { defineConfig } from "vite";
import { signalCompilerRollup } from "signal-compiler/rollup";

export default defineConfig({
  plugins: [
    signalCompilerRollup({
      include: "src/**/*.{js,jsx,ts,tsx}", // Target files/directories
      config: {
        importSource: "@preact/signals",
      },
    }),
  ],
});
```

Run your build (`npm run build` or `vite dev`), and your `$` prefixed code will magically become reactive!

## 📖 Core Compilation Strategy

The compilation strategy is based on **naming tags**, making the use of signals feel native-like, allowing developers to write more intuitive code;

The compiler will automatically inject `signal()` and `computed()` from the module you specify (e.g., @preact/signals).

### Core Concepts

1. **Signal Variables**: Variables prefixed with `$` (excluding `$use`) are actually signal objects. Users can use them seamlessly, just like regular variables.
2. **Signal Reading**: All signal variable reads are automatically unwrapped—no need to manually add `.value`. Users can use them seamlessly, just like regular variables.
3. **Signal Assignment**: When assigning values to signal variables, `.value` is automatically added. Users can assign values seamlessly, just like regular variables.
4. **Signal Propagation**: Signals must be passed through `$` prefixed variables (usually derived signals, i.e., `computed`) to maintain reactivity. Otherwise, the variable value will be the original signal object, requiring manual addition of `.value` for value retrieval. In TypeScript, the value type will not match the actual value.

### Compilation Rules

1. **Signal Creation**

Use `let` with `$` prefix:

```javascript
let $name = 1;
// Compiles to:
import { signal } from "@preact/signals";
let $name = signal(1);
```

2. **Signal Reading**

Automatically append `.value`:

```javascript
let $name = 1;
console.log($name);
// Compiles to:
let $name = signal(1);
console.log($name.value);
```

3. **Signal Assignment**

Redirect to `.value`:

```javascript
let $name = 1;
$name = 2;
console.log($name);
// Compiles to:
let $name = signal(1);
$name.value = 2;
console.log($name.value);
```

4. **Signal Derivation**

Use `const` with `$` prefix:

```javascript
let $name = 1;
const $displayName = $name + "a";
// Compiles to:
import { signal, computed } from "@preact/signals";
let $name = signal(1);
const $displayName = computed(() => $name.value + "a");
```

5. **Custom Hook**

Use `$use` prefixed function names for reactivity:

```javascript
function $useName($age) {
  let $name = 1;
  return $name + $age;
}
let $age = 1;
const $name = $useName($age);
console.log($name);

// Compiles to:
function $useName($age) {
  let $name = signal(1);
  // 1. Return value is wrapped in computed
  return computed(() => $name.value + $age.value);
}
let $age = signal(1);
// 2. Custom Hook function parameters are wrapped in computed when used
const $name = $useName(computed(() => $age.value));
console.log($name.value);
```

6. **Destructuring Assignment**

Activate the compilation strategy by assigning a variable alias with the `$` prefix, to maintain reactivity:

```javascript
// Input parameter is a signal; the 'name' variable needs to use the `$` prefixed alias to activate the compilation strategy to preserve reactivity.
function $useName({ name: $name }) {
  return {
    displayName: $name + "a",
  };
}

// Activate compilation strategy via alias $displayName to preserve reactivity.
const { displayName: $displayName } = $useName({
  name: 1,
});
console.log($displayName);

// Compiles to:
function $useName($__0) {
  // $__0 is a temporary variable storing the input parameters.
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

## Signal Propagation

Based on the above compilation strategy, you should understand that only variables with the `$` prefix will be compiled into signals.
Therefore, the transmission of the reactive chain is achieved by explicitly marking through variables with the `$` prefix.

Signal transmission path:

```
Signal Declaration -> Derived Signal -> Hook (Input Parameter Signal) -> Hook (Return Value Signal) -> Derived/Destructured Signal
```

Each step will undergo signal compilation, ensuring reactivity is not interrupted. This is the signal propagation mechanism.

## 📄 License

MIT