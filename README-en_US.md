# Signal Compiler [中文](./README.md)

A revolutionary compilation strategy for building Signal-based reactive applications.

Make signal development nearly transparent, dramatically improving readability while enjoying seamless TypeScript support and an exceptional developer experience.

## Features

- **Intuitive API**: Use familiar `$` prefixed variables — no need to learn new primitives.
- **Signal Propagation**: Enforce reactive chain propagation through explicit naming tags — explicit and controllable.
- **Framework Agnostic**: Compatible with tools like Babel and Vite. Works seamlessly with signal libraries such as [j20](https://github.com/anuoua/j20) or [Preact Signal](https://github.com/preactjs/signals).
- **No Confusion**: Signals and regular variables are clearly distinguished, avoiding confusion.

Say goodbye to verbose signal wrappers and embrace declarative reactivity!

## Quick Start

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

## Core Compilation Strategy

The compilation strategy is based on **naming tags**, making signal usage nearly transparent and allowing developers to write more intuitive code.

The compiler automatically injects `signal()` and `computed()` from the module you specify (e.g., @preact/signals).

### Compilation Rules

1. **Signal Creation**

Use `let` with the `$` prefix:

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

Use `const` with the `$` prefix:

```javascript
let $name = 1;
const $displayName = $name + "a";
// Compiles to:
import { signal, computed } from "@preact/signals";
let $name = signal(1);
const $displayName = computed(() => $name.value + "a");
```

Note: If a derived signal is followed by a custom Hook, compilation is skipped because the custom Hook already returns a signal.

5. **Custom Hook**

Function names prefixed with `$use` trigger compilation. Destructured input parameters and return values are both processed:

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
// const $name derived signal skips compilation when encountering a custom Hook
// so $useName is not wrapped in computed.
const $name = $useName(computed(() => $age.value));
console.log($name.value);
```

6. **Component Functions**

Function names starting with an uppercase letter (to match React-like framework component conventions) whose parameters contain `$` prefixed variables will trigger compilation. Destructured parameters will be processed.

```javascript
const App = ($props) => {}; // No destructuring of input params, no processing needed; the framework handles it before passing

const App = ({ msg: $msg = "hello" }) => {};
// Compiles to:
const App = (__$0) => {
  const $msg = computed(() => __$0.value.msg ?? "hello");
};
```

7. **Destructuring Assignment**

Activate the compilation strategy by setting a `$` prefixed variable alias to maintain reactivity:

```javascript
// Input parameter is a signal; the 'name' variable needs to be passed with a $ prefixed alias
// to activate the compilation strategy and preserve reactivity.
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

Signals can only be propagated to the next signal, i.e., always keeping the `$` prefix, including parameters.

Once a signal is passed to a non-signal variable during propagation, the reactive chain you expect will be broken, ultimately causing your UI to stop updating.

```javascript
const $useMsg = ({ msg: $msg = "hello" }) => {
  return {
    msg: $msg,
  }
};

let $hello2 = { msg: "hello2" };

const { msg: $msg } = $useMsg($hello2);
```

The above is a typical usage where signal propagation succeeds:

```
$hello2 -> $useMsg($hello2) -> { msg: $msg }
```

At each step, the signal is propagated to the next signal, always maintaining the `$` prefix.

## License

MIT
