# @u-gotcha/eventbus

Type-safe event bus for TypeScript. Topics and payloads are checked at compile time, and listener errors never escape `publish`.

## Install

```bash
npm install @u-gotcha/eventbus
```

## Usage

Define a map from topic names to payload types, then create a bus with it.

```ts
import { EventBus } from "@u-gotcha/eventbus";

interface Events {
    "user:login": { id: string };
    "config:loaded": { theme: "dark" | "light" };
}

const bus = new EventBus<Events>();

const unsubscribe = bus.subscribe("user:login", (message) => {
    console.log(message.payload.id); // typed as string
});

bus.publish({ topic: "user:login", payload: { id: "u1" } });
// -> u1

unsubscribe();
```

### Wait for several topics: `whenAll`

`whenAll` calls the listener once every listed topic has been published at least once, then resets and waits again.

```ts
bus.whenAll(["user:login", "config:loaded"], ([login, config]) => {
    console.log(login.payload.id, config.payload.theme);
});

bus.publish({ topic: "config:loaded", payload: { theme: "dark" } });
bus.publish({ topic: "user:login", payload: { id: "u2" } });
// -> u2 dark
```

## API

### `new EventBus<M>(onError?)`

Creates a bus. `M` maps each topic name to its payload type.
`onError` handles errors thrown by listeners. Defaults to `console.error`.

### `subscribe(topic, listener)`

Registers a listener for one topic. Returns a function that unsubscribes it.

### `publish(message, onError?)`

Calls every listener of `message.topic`. An `onError` passed here is used instead of the bus-wide one for this call.

### `whenAll(topics, listener)`

Registers a listener for several topics. Returns a function that unsubscribes from all of them.

- The listener is called when every topic has been published at least once since the last call.
- After the listener is called, it waits for every topic again.
- If a topic is published more than once while waiting, the latest message is used.
- Messages are passed in the order of `topics`, not in the order they were published.
- Messages published before `whenAll` was called are not counted.
- Passing the same topic twice is a type error.

### `Publisher<M>` / `Subscriber<M>`

Interfaces that expose only `publish`, or only `subscribe` and `whenAll`. Use them to limit what each part of your app can do with the bus.

```ts
import type { Publisher, Subscriber } from "@u-gotcha/eventbus";

const publisher: Publisher<Events> = bus;
const subscriber: Subscriber<Events> = bus;
```

## Behavior

- **Errors never escape `publish`**: errors thrown by listeners, including rejected promises from async listeners, are passed to `onError`. Other listeners still run.
- **Errors in `onError`** are logged with `console.error` and do not escape either.
- **Stable during publish**: listeners added or removed while a `publish` is running do not affect that `publish`. They take effect from the next one.

## Changes in 0.2.0

- Added `whenAll`.
- The function returned by `subscribe` now returns `void` instead of `boolean`.

## License

MIT

## Note

This README was drafted with AI assistance.
The library code and tests were written by the author, with AI used as a code reviewer.