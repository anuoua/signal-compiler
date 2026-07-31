# Signal Compiler

A compilation strategy based on **naming conventions** for building Signal-driven reactive applications.

Prefix a variable with `$` and the compiler turns it into a signal at build time — development stays nearly transparent, the code reads like ordinary variables, and you keep full TypeScript inference.

Say goodbye to verbose `signal()` wrappers and embrace declarative reactivity.　[中文](./README.md)

## Features

- **Declarative API**: use the familiar `$` prefix — no new runtime primitives to learn.
- **Name is signal**: the `$` prefix is the single convention; signals and plain variables are clearly distinguished and explicit.
- **Framework agnostic**: ships a Babel plugin and a Vite/Rollup plugin, pairing with any signal library such as [j20](https://github.com/anuoua/j20) or [Preact Signals](https://github.com/preactjs/signals).
- **Type-friendly**: source code uses ordinary variables, so TypeScript works without any special configuration.

## How it works

The compiler scans every `$`-prefixed identifier and rewrites it according to the rules:

- `let $x = v` → creates a mutable signal
- `const $x = v` → creates a derived signal
- reading `$x` → automatically appends `.value`
- assigning `$x = v` → redirects to `.value = v`

The required `signal` / `computed` are **auto-injected** from the module you specify (`importSource`). To avoid clashing with existing bindings, the injected identifiers are underscore-prefixed and both are always injected. A file needs only one signal for this to appear at the top:

```javascript
import { signal as _signal, computed as _computed } from "@preact/signals";
```

> The «compiles to» blocks below omit the repeated import line; `_signal` / `_computed` refer to those auto-injected helpers.

## Quick start

### Install

```bash
npm install signal-compiler
```

### Babel

```javascript
// babel.config.js
import { signalCompiler } from "signal-compiler";

export default {
  plugins: [
    [signalCompiler, { importSource: "@preact/signals" }],
  ],
};
```

### Vite

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

Run `vite dev` or `vite build` and your `$`-prefixed code is compiled automatically.

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `importSource` | `string` | `"j20"` | module to import `signal` / `computed` from |
| `autoImport` | `boolean` | `true` | auto-inject `signal` / `computed` (when off you must import them yourself, named `signal` / `computed`) |
| `identifierSignalDeclaration` | `boolean` | `true` | rewrite `let` / `const $x` identifier declarations |
| `patternSignalDeclaration` | `boolean` | `true` | rewrite destructuring declarations (`let/const { a: $a }`) |
| `identifierSignalRead` | `boolean` | `true` | append `.value` when a signal is read |
| `identifierSignalAssign` | `boolean` | `true` | redirect assignment to `.value` |
| `customHookSignal` | `boolean` | `true` | transform custom Hook (`$use*`) arguments and return values |

> Babel users pass these directly as plugin options; Vite/Rollup users put them under the `config` field.

## Compilation rules

### 1. Creating a signal

A `$`-prefixed `let` binding is wrapped with `signal()`:

```javascript
let $name = 1;
// compiles to:
let $name = _signal(1);
```

### 2. Reading a signal

Any reference to a signal automatically appends `.value`:

```javascript
let $name = 1;
console.log($name);
// compiles to:
let $name = _signal(1);
console.log($name.value);
```

### 3. Assigning a signal

Assigning to a signal redirects to `.value`:

```javascript
let $name = 1;
$name = 2;
console.log($name);
// compiles to:
let $name = _signal(1);
$name.value = 2;
console.log($name.value);
```

### 4. Deriving a signal

A `$`-prefixed `const` binding is wrapped with `computed()`, establishing the dependency automatically:

```javascript
let $name = 1;
const $displayName = $name + "a";
// compiles to:
let $name = _signal(1);
const $displayName = _computed(() => $name.value + "a");
```

**Exception**: when the initializer already yields a signal, the `computed` wrapping is skipped — this includes custom Hook calls (`$useX(...)`, whose return value is already a signal) and the pass-through call `$()` (below).

### 5. Signal pass-through `$()`

When a signal appears inside a call to a function **named `$`**, the compiler **skips** the `.value` rewrite on it. `$` means «I explicitly want the signal object itself». So `const $x = $($a)` is not wrapped in `computed`, and the argument `$a` does not get `.value` appended:

```javascript
let $a = 1;
const $b = $($a);
// compiles to:
let $a = _signal(1);
const $b = $($a);
```

Useful when interfacing with APIs that expect the signal object itself.

### 6. Custom Hooks

Functions whose name starts with `$use` are treated as custom Hooks. The compiler:

1. wraps the **return value** in `computed`;
2. wraps every **argument at the call site** in `computed` (to preserve reactivity).

```javascript
function $useName($age) {
  let $name = 1;
  return $name + $age;
}
let $age = 1;
const $name = $useName($age);
console.log($name);

// compiles to:
function $useName($age) {
  let $name = _signal(1);
  return _computed(() => $name.value + $age.value);   // return value → computed
}
let $age = _signal(1);
// the derived signal const $name is initialized by a Hook call, so computed is skipped;
// at the call site the argument $age is wrapped in computed.
const $name = $useName(_computed(() => $age.value));
console.log($name.value);
```

> **Every** `return` in the Hook body (including those nested in `if` / `for` / `try` blocks) is wrapped; returns belonging to inner nested functions are not.

### 7. Component functions

A function whose name starts with an uppercase letter (the React component convention) and whose parameters include a `$`-prefixed binding triggers parameter-destructuring rewriting.

- **Identifier parameter** (e.g. `($props)`): not destructured, not rewritten. If the framework passes a signal object, references to `$props` in the body still get `.value` appended as usual.
- **Destructured parameter**: replaced by a temporary variable; each `$`-prefixed target becomes a `computed`:

```javascript
const App = ({ msg: $msg = "hello" }) => {
  return $msg;
};
// compiles to:
const App = __$0 => {
  const $msg = _computed(() => __$0.value["msg"] ?? "hello");
  return $msg.value;
};
```

### 8. Destructuring assignment

Receiving destructured values through `$`-prefixed aliases preserves reactivity. The compiler wraps the entire right-hand side in `computed`, then emits a `computed` access for each `$` alias:

```javascript
function $useName({ name: $name }) {
  return { displayName: $name + "a" };
}
const { displayName: $displayName } = $useName({ name: 1 });
console.log($displayName);

// compiles to:
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

> `__$0`, `__$1`, … are compiler-generated temporaries (underscore-prefixed, globally incrementing) used to hold signal objects.

## Signal propagation

A signal can only be propagated to the next signal — every step of the chain must keep the `$` prefix, including function parameters. The moment it is assigned to a non-`$` variable, the reactive chain breaks and the UI stops updating.

```javascript
const $useMsg = ({ msg: $msg = "hello" }) => {
  return { msg: $msg };
};
let $hello2 = { msg: "hello2" };
const { msg: $msg } = $useMsg($hello2);
```

Chain: `$hello2 → $useMsg($hello2) → { msg: $msg }` — every step keeps the `$` prefix, so propagation succeeds.

## Limitations & caveats

- **Naming-convention based**: the compiler identifies signals purely by the `$` prefix and **does not distinguish scope or binding**. Any `$`-prefixed identifier (including third-party code, jQuery-style `$xxx`) is treated as a signal. Isolate such code when mixing.
- **The reactive chain must be maintained explicitly**: see above — losing the `$` prefix loses reactivity.
- **The `$` prefix is a strong convention**: `$use*` is a Hook, an uppercase name with a `$` parameter is a component, any other `$xxx` is a signal. Avoid naming collisions.

## TypeScript

Variables prefixed with `$` are ordinary variables in source, typed through normal inference, with no extra configuration:

```typescript
let $count = 0;              // TS infers number
const $double = $count * 2;  // TS infers number
```

Note: TypeScript still treats these as plain values (e.g. `number`); it does **not** know that at runtime they are signal objects. This is the trade-off — in exchange you get zero type configuration and native syntax. Compilation (signalization) happens only in the Babel / Rollup build phase and does not affect type-checking.

## License

[MIT](./LICENSE)
