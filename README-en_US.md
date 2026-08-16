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

The required `signal` / `computed` are **injected on demand** from the module you specify (`importSource`) — only when a file actually creates or derives a signal, and underscore-prefixed to avoid clashing with existing bindings. So a file that only *reads* or *assigns* signals (e.g. a cross-file consumer) gets no extra import at all; only files that declare signals get this at the top:

```javascript
import { signal as _signal, computed as _computed } from "@preact/signals";
```

> The «compiles to» blocks below omit the repeated import line; `_signal` / `_computed` refer to those on-demand-injected helpers.

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
| `autoImport` | `boolean` | `true` | (on-demand) auto-inject `signal` / `computed` (when off you must import them yourself, named `signal` / `computed`) |
| `diagnostics` | `boolean` | `true` | emit compile-time diagnostics (broken reactive chain, naming-contract violations — see [Diagnostics](#diagnostics)) |
| `identifierSignalDeclaration` | `boolean` | `true` | rewrite `let` / `const $x` identifier declarations |
| `patternSignalDeclaration` | `boolean` | `true` | rewrite destructuring declarations (`let/const { a: $a }`) |
| `identifierSignalRead` | `boolean` | `true` | append `.value` when a signal is read |
| `identifierSignalAssign` | `boolean` | `true` | redirect assignment to `.value` |
| `customHookSignal` | `boolean` | `true` | transform custom Hook (`$use*`) arguments and return values |
| `markerSignalComponent` | `boolean` | `true` | recognize inline components (render props) marked with a `@signal-component` comment (see [Inline components](#8-inline-components-signal-component-marker)) |

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

Assigning to a signal redirects to `.value` — including compound assignments and increment/decrement:

```javascript
let $name = 1;
$name = 2;
$name += 1;
$name++;
console.log($name);
// compiles to:
let $name = _signal(1);
$name.value = 2;
$name.value += 1;
$name.value++;
console.log($name.value);
```

**Destructuring assignment statements** (non-declaration `({ $a } = obj)` / `[$a] = arr`) likewise redirect every `$` target to `.value`:

```javascript
let $a, $b;
({ $a, k: $b } = obj);
[$a, $b] = arr;
// compiles to:
({ $a: $a.value, k: $b.value } = obj);
[$a.value, $b.value] = arr;
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

**Spread arguments are not supported (compiler limitation)**: for custom Hooks (`$use*`), components and `@signal-component`-marked functions, **spreading at the call site** (`$useQuery(...$params)`) or **using a rest parameter in the signature** (`(...args)`, `(...$args)`) is a compile error — the parameters of these three kinds of functions must be a **fixed list of named `$` signals**; spread/rest freezes or dynamizes the parameter list and breaks the signal contract:

```javascript
const $qs = $useQuery(...$params); // ⚠ error: spread arguments are not supported
const $useQuery = (...args) => ...; // ⚠ error: rest parameter "args" is not supported
// instead: pass the array signal
const $useQuery = ($params) => $params.value.map(a => a.value);
const $qs = $useQuery($params);
```

> Exception: rest inside a destructuring pattern (`({ a: $a, ...$rest })`) is an **object rest property**, not a parameter collection — it is compiled to a `$rest` computed as usual and is not affected.

### 7. Component functions

A function whose name starts with an uppercase letter (the React component convention) is treated as a component. **Every parameter of a component must be a `$` signal** (a unified contract for custom Hooks, components and `@signal-component`-marked functions) — an identifier parameter without `$` (`(props)`) or a destructuring alias without `$` (`({ a: b })`) is a compile error.

- **Identifier parameter** (e.g. `($props)`): not destructured, not rewritten. The framework passes a signal object, and references to `$props` in the body get `.value` appended as usual.
- **Destructured parameter**: replaced by a temporary variable; every `$`-prefixed target becomes a `computed` (including defaults and `...$rest`):

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

### 8. Inline components (`@signal-component` marker)

Inline components (render props, e.g. `<Comp Title={({ msg: $msg }) => ...} />`) are **anonymous functions** with no name to rely on. signal-compiler does not handle JSX itself, so the convention is: the JSX transform plugin (e.g. j20's jsx-transform) attaches a `@signal-component` comment to the function node, and the compiler treats any function carrying the marker as a component (destructured params → `computed`):

```javascript
// source (the JSX transform runs before signal-compiler and adds the marker):
const Comp = () => ({
  get Title() {
    return /* @signal-component */ ({ msg: $msg }) => {
      return $msg;
    };
  },
});
// compiles to:
const Comp = () => ({
  get Title() {
    return /* @signal-component */ __$0 => {
      const $msg = _computed(() => __$0.value["msg"]);
      return $msg.value;
    };
  },
});
```

Notes:

- The marker **must be a block comment** (`/* @signal-component */`, i.e. `t.addComment(node, "leading", "@signal-component")`) — not a line comment, because inline components usually sit in `return` expression position, where a line comment triggers ASI and breaks the code.
- The marker must exist **before** signal-compiler runs, so the JSX transform must execute first (in a separate Babel pass).
- Priority: `$use*` Hook > uppercase component > `@signal-component` marker.
- Import the constant to avoid drift: `import { SIGNAL_COMPONENT_MARKER } from "signal-compiler"`.
- Disable via `markerSignalComponent: false`.

### 9. Destructuring assignment

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

## Diagnostics

With `diagnostics` on (the default), the compiler emits code-framed warnings — without failing the build — for three classes of mistakes that would otherwise fail silently:

1. **Broken reactive chain** — a signal assigned to a non-`$` variable:
   ```javascript
   let $a = 1;
   const b = $a;   // ⚠ "$a" is a signal but is assigned to non-signal "b" — the reactive chain breaks here.
   ```
2. **Naming-contract violation** — a `$`-prefixed declaration that cannot become a signal:
   ```javascript
   let $a;              // ⚠ "$a" has a $ prefix but no initializer, so it will not become a signal.
   function $foo() {}   // ⚠ function "$foo" starts with $ but is neither a custom hook ($use*) nor a component.
   ```
3. **Destructuring snapshot break** — a plain alias destructured from a signal source becomes a one-time snapshot at declaration time:
   ```javascript
   const { a: $a, hello } = $some;  // ⚠ "hello" is destructured from signal "$some" without a $ prefix — the reactive chain breaks here.
   // rename to keep reactivity: const { a: $a, hello: $hello } = $some;
   ```

Warnings carry file position and source highlight for easy triage; turn them off with `diagnostics: false`.

## Limitations & caveats

- **Naming-convention based**: the compiler identifies signals purely by the `$` prefix and **does not distinguish scope or binding**. Any `$`-prefixed identifier (including third-party code, jQuery-style `$xxx`) is treated as a signal. Isolate such code when mixing.
- **The reactive chain must be maintained explicitly**: see [Signal propagation](#signal-propagation) — losing the `$` prefix loses reactivity; enabling [Diagnostics](#diagnostics) surfaces such breaks at compile time.
- **The `$` prefix is a strong convention**: `$use*` is a Hook, an uppercase name with a `$` parameter is a component, any other `$xxx` is a signal. Avoid naming collisions.
- **Inline components need the marker**: anonymous functions (render props) are not recognized as components automatically — the JSX transform plugin must add a `@signal-component` comment (see [Inline components](#8-inline-components-signal-component-marker)) and must run before signal-compiler.

## TypeScript

Variables prefixed with `$` are ordinary variables in source, typed through normal inference, with no extra configuration:

```typescript
let $count = 0;              // TS infers number
const $double = $count * 2;  // TS infers number
```

Note: TypeScript still treats these as plain values (e.g. `number`); it does **not** know that at runtime they are signal objects. This is the trade-off — in exchange you get zero type configuration and native syntax. Compilation (signalization) happens only in the Babel / Rollup build phase and does not affect type-checking.

## License

[MIT](./LICENSE)
