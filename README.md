# Signal Compiler

A revolutionary compile-time strategy for building signal-based reactive applications.

Make signal development almost imperceptible, greatly increase readability, while enjoying seamless TypeScript support and an excellent developer experience.

## ✨ Why Signal Compiler?

- **Zero Runtime Overhead**: Transform ordinary JavaScript into fine-grained reactive signals at build time.
- **Intuitive API**: Use familiar `$` prefixed variables—no need to learn new primitives.
- **Signal Propagation**: Enforce response chains through explicit passing, preventing accidental non-reactive leaks.
- **Framework Agnostic**: Compatible with tools like Babel and Vite. Works perfectly with signal libraries like [J20](https://example.com/j20).
- **Type Safe**: Complete TypeScript type inference out of the box.

Say goodbye to verbose signal wrappers and embrace declarative reactivity!

> An important point is that signals are distinguished from ordinary variables, so you won't get confused.

## 🚀 Quick Start

### Installation

```bash
npm install signal-compiler
```

### Babel Configuration

Add the plugin in `babel.config.js`:

```javascript
import { signalCompiler } from 'signal-compiler';

export default {
  plugins: [
    [
      signalCompiler,
      {
        importSource: 'j20', // Specify signal module (e.g. 'j20')
      },
    ],
  ],
};
```

### Vite Configuration

Integrate via Rollup plugin in `vite.config.js`:

```javascript
import { defineConfig } from 'vite';
import { signalCompilerRollup } from 'signal-compiler/rollup';

export default defineConfig({
  plugins: [
    signalCompilerRollup({
      include: 'src/**/*.{js,jsx,ts,tsx}', // Target files/directories
      config: {
        importSource: 'j20',
      },
    }),
  ],
});
```

Run your build (`npm run build` or `vite dev`) and your `$` prefixed code will magically become reactive!

## 📖 Core Compilation Strategies

This strategy uses **name-based label propagation** to make signals feel native. Developers write intuitive code; the compiler injects `signal()` and `computed()` from your specified module (e.g. J20).

### Core Concepts

1. **Signal Variables**: Variables prefixed with `$` (not `$use`) are actually signal objects, imperceptible to users, and used like ordinary variables.
2. **Signal Reading**: When all signal variables are read, they are automatically unpacked without manually adding `.value`, imperceptible to users, and used like ordinary variables.
4. **Signal Assignment**: When signal variables are assigned, `.value` is automatically added, imperceptible to users, and can be assigned like ordinary variables.
3. **Signal Propagation**: Signals must be passed through `$` prefixed variables (usually derived signals, i.e. `computed`) to maintain reactivity, otherwise the variable value is the original signal object, and `.value` needs to be manually added to get the value.

### Compilation Rules

1. **Signal Creation**  

   Use `let` with `$` prefix:

   ```javascript
   let $name = 1;
   // Compiled to:
   let $name = signal(1);
   ```

2. **Signal Reading**  

   Automatically append `.value`:

   ```javascript
   let $name = 1;
   console.log($name);
   // Compiled to:
   let $name = signal(1);
   console.log($name.value);
   ```

3. **Signal Assignment**  

   Redirect to `.value`:

   ```javascript
   let $name = 1;
   $name = 2;
   console.log($name);
   // Compiled to:
   let $name = signal(1);
   $name.value = 2;
   console.log($name.value);
   ```

4. **Signal Derivation**

   Use `const` with `$` prefix:

   ```javascript
   let $name = 1;
   const $displayName = $name + 'a';
   // Compiled to:
   let $name = signal(1);
   const $displayName = computed(() => $name.value + 'a');
   ```

5. **Custom Hook**  
   Function names with `$use` prefix to achieve reactivity:

   ```javascript
   function $useName($age) {
     let $name = 1;
     return $name + $age;
   }
   let $age = 1;
   const $name = $useName($age);
   console.log($name);

   // Compiled to:
   function $useName($age) {
     let $name = signal(1);
     // Return value wrapped in computed
     return computed(() => $name.value + $age.value);
   }
   let $age = signal(1);
   const $name = $useName(computed(() => $age.value)); // Parameters wrapped in computed
   console.log($name.value);
   ```

6. **Destructuring Assignment**  
   Propagate signals through aliases:

   ```javascript
   // Input parameters are signals, name variables need to use $ prefixed aliases to pass to retain reactivity (core propagation concept).
   function $useName({ name: $name }) {
     return {
       displayName: $name + 'a',
     };
   }

   // Pass through alias $displayName to retain reactivity (core propagation concept).
   const { displayName: $displayName } = $useName({ name: 1 });
   console.log($displayName);

   // Compiled to:
   function $useName($__0) {
     // $__0 is a temporary variable storing computed parameters.
     const $name = computed(() => $__0.value.name);
     return computed(() => ({
       displayName: $name.value + 'a',
     }));
   }

   const $__0 = $useName(computed(() => ({ name: 1 })));
   const $displayName = computed(() => $__0.value.displayName);
   console.log($displayName.value);
   ```

## 📄 License

MIT