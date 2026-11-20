# @u-gotcha/reactive

Fine-grained reactive primitives for TypeScript: signals, lazy computed values and effects with glitch-free updates.

## Install

```bash
npm install @u-gotcha/reactive
```

## Usage

```ts
import { Signal, Computed, createEffect } from "@u-gotcha/reactive";

const count = new Signal(1);
const doubled = Computed.create(() => count.get() * 2);

const dispose = createEffect(() => {
    console.log(`count: ${count.get()}, doubled: ${doubled.get()}`);
});
// -> count: 1, doubled: 2

count.set(2);
// -> count: 2, doubled: 4

dispose(); // stop the effect
```

## API

### `new Signal(initialValue)`

Holds a value.

- `get()` returns the value and tracks it as a dependency inside an effect or computed.
- `set(value)` updates the value and runs dependent effects. Setting the same value (`Object.is`) does nothing.

Pass `() => signal.get()` instead of `signal.get` when you hand it to another function.

### `Computed.create(fn)`

Creates a derived value.

- `get()` returns the cached value and recomputes only when a dependency has changed.
- `dispose()` stops tracking. After disposal, `get()` returns the last value.

### `createEffect(fn)`

Runs `fn` immediately and again whenever a dependency changes. Returns a function that disposes the effect.

### `ReactiveError` / `ReactiveAggregateError`

Errors thrown by this library. `ReactiveAggregateError.errors` contains all errors thrown by effects during one update.

## Behavior

- **Lazy**: a computed value is not calculated until it is read.
- **Cached**: a computed value is not recalculated while its dependencies are unchanged.
- **Glitch-free**: in a diamond-shaped dependency graph, an effect runs once per update and never sees a mix of old and new values.
- **Dynamic dependencies**: dependencies are re-collected on each run, so branches that are no longer read stop triggering updates.
- **Ownership**: effects and computed values created inside an effect, and computed values created inside a computed, are disposed when the parent re-runs or is disposed.
- **Errors**: if an effect throws during an update, the remaining effects still run, then all errors are thrown together as `ReactiveAggregateError`. A computed that throws rethrows the same error until its dependencies change.

## Limitations

- No `batch` yet. Every `set` runs dependent effects immediately.
- Effects re-run even when a recomputed value is equal to the previous one.
- `Signal.set` and `createEffect` cannot be called while a computed value is being calculated (`ReactiveError`).
- Async computations (returning a `Promise`) are not supported.

## License

MIT


## Note

This README was drafted with AI assistance.
The library code and tests were written by the author, with AI used as a code reviewer.