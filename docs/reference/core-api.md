# Core API Reference

This reference covers `@daltonr/pathwrite-core` — the framework-agnostic engine that all adapters wrap.

---

## PathSnapshot

`engine.snapshot()` returns `null` when no path is active, or a `PathSnapshot` object. The snapshot is a read-only, point-in-time description of the engine's full state.

```typescript
interface PathSnapshot<TData = PathData> { ... }
```

### Properties

| Property | Type | Description |
|---|---|---|
| `pathId` | `string` | ID of the active path. |
| `stepId` | `string` | ID of the current step. |
| `stepTitle` | `string \| undefined` | Value of `step.title`, if defined. |
| `stepMeta` | `Record<string, unknown> \| undefined` | Value of `step.meta`, if defined. |
| `stepIndex` | `number` | 0-based index of the current step among visible (non-skipped) steps. |
| `stepCount` | `number` | Total number of visible steps (excludes confirmed skips). |
| `progress` | `number` | Navigation progress as a fraction: `stepIndex / (stepCount - 1)`. Range `0.0` → `1.0`. `0` for a single-step path. |
| `steps` | `StepSummary[]` | Summary of every visible step with its status. Source of truth for progress indicators. |
| `isFirstStep` | `boolean` | `true` when `stepIndex === 0`. |
| `isLastStep` | `boolean` | `true` when on the final step. Always `false` when a sub-path is active. |
| `nestingLevel` | `number` | `0` for a top-level path; increments by 1 for each nested sub-path. |
| `rootProgress` | `RootProgress \| undefined` | Progress summary of the root (top-level) path. Present only when `nestingLevel > 0`. |
| `status` | `PathStatus` | Current engine activity. See the status table below. |
| `canMoveNext` | `boolean` | Synchronous evaluation of the current step's `canMoveNext` guard. `true` if no guard is defined or if the guard is async (optimistic default). |
| `canMovePrevious` | `boolean` | Synchronous evaluation of the current step's `canMovePrevious` guard. |
| `fieldErrors` | `Record<string, string>` | Map of field ID to error message for the current step. Empty object when no errors or no `fieldErrors` hook. |
| `fieldWarnings` | `Record<string, string>` | Map of field ID to warning message for the current step. Warnings are always shown and never block navigation. |
| `blockingError` | `string \| null` | The `reason` from the most recent `canMoveNext` or `canMovePrevious` returning `{ allowed: false, reason }`. Cleared on navigation or `restart()`. |
| `isDirty` | `boolean` | `true` if any data value has changed since entering the current step (shallow comparison). Resets to `false` on navigation, `resetStep()`, or `restart()`. |
| `hasAttemptedNext` | `boolean` | `true` after the user has called `next()` at least once on the current step. Use to gate error display until the first submission attempt. |
| `stepEnteredAt` | `number` | `Date.now()` timestamp when the current step was entered. |
| `hasPersistence` | `boolean` | `true` when a `PathStore` is attached via an observer. |
| `error` | `{ message: string; phase: string; retryCount: number } \| null` | Details of the most recent async error. Non-null when `status === "error"`. |
| `formId` | `string \| undefined` | When the current step is a `StepChoice`, this is the ID of the selected inner step variant. `undefined` for regular steps. Use to decide which form component to render. |
| `data` | `TData` | Copy of the current path data. Mutating this object has no effect on the engine. |

### `PathStatus` values

| Value | Meaning |
|---|---|
| `"idle"` | Nothing in progress — navigation buttons should be enabled. |
| `"entering"` | The `onEnter` hook is running on the new step. |
| `"leaving"` | The `onLeave` hook is running on the current step. |
| `"validating"` | A `canMoveNext` or `canMovePrevious` guard is running. |
| `"completing"` | The `onComplete` callback is running (last step). |
| `"error"` | An async operation threw — `snapshot.error` has details. |

### `StepSummary`

Each element of `snapshot.steps` is a `StepSummary`:

```typescript
interface StepSummary {
  id:     string;
  title?: string;
  meta?:  Record<string, unknown>;
  status: "completed" | "current" | "upcoming";
}
```

Steps before the current index are `"completed"`, the current step is `"current"`, and later steps are `"upcoming"`.

### `RootProgress`

```typescript
interface RootProgress {
  pathId:    string;
  stepIndex: number;
  stepCount: number;
  progress:  number;        // 0.0 → 1.0
  steps:     StepSummary[];
}
```

Available as `snapshot.rootProgress` when `nestingLevel > 0`. Always reflects the bottom of the sub-path stack (the root path), even when deeply nested.

---

## PathEvent

Subscribe with `engine.subscribe(listener)`. The listener receives a `PathEvent` on every meaningful engine state change.

```typescript
type PathEvent =
  | { type: "stateChanged"; cause: StateChangeCause; snapshot: PathSnapshot }
  | { type: "completed";    pathId: string; data: PathData }
  | { type: "cancelled";    pathId: string; data: PathData }
  | { type: "resumed";      resumedPathId: string; fromSubPathId: string; snapshot: PathSnapshot };
```

### `StateChangeCause`

```typescript
type StateChangeCause =
  | "start"
  | "next"
  | "previous"
  | "goToStep"
  | "goToStepChecked"
  | "setData"
  | "cancel"
  | "restart";
```

### Event reference

| Event type | When fired | Payload |
|---|---|---|
| `stateChanged` | After every navigation or `setData` call. May fire multiple times per operation as `snapshot.status` transitions through phases. | `cause: StateChangeCause`, `snapshot: PathSnapshot` |
| `completed` | When the top-level path finishes naturally (user advances past the last step). | `pathId: string`, `data: PathData` (final state) |
| `cancelled` | When the top-level path is cancelled via `cancel()`. | `pathId: string`, `data: PathData` |
| `resumed` | When a sub-path finishes or is cancelled and the parent path is restored. | `resumedPathId: string` (parent path ID), `fromSubPathId: string`, `snapshot: PathSnapshot` |

> Cancelling a sub-path emits `resumed` (not `cancelled`). The top-level `cancelled` event is only for the root path being cancelled.

---

## PathEngine

### Constructor

```typescript
const engine = new PathEngine(options?: PathEngineOptions);
```

```typescript
interface PathEngineOptions {
  observers?: PathObserver[];
}
```

Observers are wired at construction time and cannot be removed. They run for the engine's entire lifetime. Use `engine.subscribe()` for removable one-off listeners.

---

### Instance methods

#### `start(def, data?)`

```typescript
engine.start(def: PathDefinition, data?: PathData): Promise<void>
```

Start or restart a path. Throws if the definition has no steps. Emits `stateChanged` with cause `"start"` once `onEnter` completes on the first step.

If a path is already active, calling `start()` replaces it without firing any lifecycle hooks on the old path.

---

#### `restart()`

```typescript
engine.restart(): Promise<void>
```

Tear down any active path without firing lifecycle hooks (`onLeave`, `onCancel`, etc.) and restart from step 1 with the original `initialData` that was passed to the most recent `start()` call. Requires `start()` to have been called at least once. Emits `stateChanged` with cause `"restart"`.

Use for "Start over" and retry flows. Clears `blockingError`, `hasAttemptedNext`, and `isDirty`.

---

#### `next()`

```typescript
engine.next(): Promise<void>
```

Advance one step forward. Runs `canMoveNext` on the current step, then `onLeave` and `onEnter`. If called on the last step (and `canMoveNext` allows), the path completes and emits `completed`.

If `status !== "idle"` when called, the call is dropped immediately (concurrent navigation is debounced automatically).

---

#### `previous()`

```typescript
engine.previous(): Promise<void>
```

Go back one step. Runs `canMovePrevious`, then `onLeave` and `onEnter`. No-op (silently returns) when already on the first step of a top-level path. Cancels a sub-path when called on the sub-path's first step, restoring the parent.

---

#### `cancel()`

```typescript
engine.cancel(): Promise<void>
```

Cancel the active path or sub-path. For a top-level path, emits `cancelled`. For a sub-path, pops it silently and emits `stateChanged` on the restored parent. `onSubPathCancel` fires on the parent step if defined.

---

#### `goToStep(stepId)`

```typescript
engine.goToStep(stepId: string): Promise<void>
```

Jump directly to a step by ID. Calls `onLeave` on the current step and `onEnter` on the target step. Bypasses `canMoveNext`, `canMovePrevious`, and `shouldSkip`. Throws if the step ID is not found. Emits `stateChanged` with cause `"goToStep"`.

Use for non-linear transitions such as rejection flows or editorial navigation.

---

#### `goToStepChecked(stepId)`

```typescript
engine.goToStepChecked(stepId: string): Promise<void>
```

Jump to a step by ID while still enforcing the guard. Checks `canMoveNext` when the target step is ahead of the current step, or `canMovePrevious` when it is behind. Navigation is blocked (silently, without throwing) if the guard returns false. Emits `stateChanged` with cause `"goToStepChecked"`.

---

#### `setData(key, value)`

```typescript
engine.setData<K extends string & keyof TData>(key: K, value: TData[K]): Promise<void>
```

Update a single data value. Emits `stateChanged` with cause `"setData"`. Sets `isDirty` to `true` if the new value differs from the entry value (shallow comparison). Rebuilds `fieldErrors`, `fieldWarnings`, `canMoveNext`, and `canMovePrevious` synchronously on the new snapshot.

---

#### `resetStep()`

```typescript
engine.resetStep(): Promise<void>
```

Revert the current step's data to the values it had when the step was entered. Sets `isDirty` to `false`. Emits `stateChanged`. Useful for "Clear" or "Undo Changes" buttons.

---

#### `startSubPath(def, data?, meta?)`

```typescript
engine.startSubPath(
  def:   PathDefinition,
  data?: PathData,
  meta?: Record<string, unknown>
): Promise<void>
```

Push a sub-path on top of the current active path. The parent is paused and preserved on the stack. Throws if no path is active. The optional `meta` object is passed back unchanged to `onSubPathComplete` and `onSubPathCancel` on the parent step.

---

#### `suspend()`

```typescript
engine.suspend(): void
```

Temporarily prevent the engine from emitting events. Used by the shell to batch updates during mounting.

---

#### `retry()`

```typescript
engine.retry(): Promise<void>
```

Retry the last failed async operation when `snapshot.status === "error"`. Clears `snapshot.error` and re-runs the operation that failed.

---

#### `exportState()`

```typescript
engine.exportState(): SerializedPathState | null
```

Return the full current engine state as a plain JSON-serializable object, or `null` if no path is active. The serialized state includes the current step position, all path data, visited step tracking, and the full sub-path stack.

Pass the result to `PathEngine.fromState()` to restore the engine later.

---

#### `snapshot()`

```typescript
engine.snapshot(): PathSnapshot | null
```

Synchronous read of the current snapshot. Returns `null` when no path is active. The snapshot is rebuilt on every `stateChanged` event — calling this between events returns the same object.

---

#### `subscribe(listener)`

```typescript
engine.subscribe(listener: (event: PathEvent) => void): () => void
```

Subscribe to engine events. Returns an unsubscribe function. Call it to remove the listener:

```typescript
const unsubscribe = engine.subscribe((event) => {
  if (event.type === "completed") {
    console.log("Done:", event.data);
    unsubscribe();
  }
});
```

For permanent listeners that run for the engine's lifetime, use `observers` in the constructor instead.

---

### Static methods

#### `PathEngine.fromState(state, pathDefinitions, options?)`

```typescript
PathEngine.fromState(
  state:           SerializedPathState,
  pathDefinitions: Record<string, PathDefinition>,
  options?:        PathEngineOptions
): PathEngine
```

Reconstruct a working engine from serialized state. The engine is already positioned on the correct step — no `start()` call is needed. Pass the same `observers` you would use on a fresh engine:

```typescript
const saved = await store.load(key);
const engine = PathEngine.fromState(saved, { [path.id]: path }, {
  observers: [httpPersistence({ store, key })],
});
// engine is on the saved step, ready to navigate
```

---

## PathStore interface

`PathStore` is the interface that persistence backends must implement. Provide it to `httpPersistence()` or use it directly with `engine.exportState()` / `PathEngine.fromState()`.

```typescript
interface PathStore {
  save(key: string, state: SerializedPathState): Promise<void>;
  load(key: string): Promise<SerializedPathState | null>;
  delete(key: string): Promise<void>;
}
```

| Method | Description |
|---|---|
| `save(key, state)` | Persist the serialized engine state under the given key. |
| `load(key)` | Retrieve a previously saved state. Returns `null` if no state exists for the key. |
| `delete(key)` | Remove the stored state for the given key (e.g. after path completion). |

`@daltonr/pathwrite-store` provides two implementations:
- **`HttpStore`** — saves state to a REST API (`POST /baseUrl/:key`, `GET /baseUrl/:key`, `DELETE /baseUrl/:key`).
- **`LocalStorageStore`** — saves state to `window.localStorage` (browser only).

---

## PathObserver type

```typescript
type PathObserver = (event: PathEvent, engine: PathEngine) => void;
```

A `PathObserver` is a function registered at engine construction time. Observers cannot be removed and run for the engine's entire lifetime. The second argument is the engine itself, giving the observer access to `engine.exportState()`, `engine.snapshot()`, etc.

```typescript
const logger: PathObserver = (event) =>
  console.log(`[wizard] ${event.type}`, "cause" in event ? event.cause : "");

const engine = new PathEngine({ observers: [logger] });
```

Multiple observers compose freely — each receives the same events independently:

```typescript
const engine = new PathEngine({
  observers: [
    httpPersistence({ store, key: "user:123:onboarding" }),
    logger,
    analyticsObserver,
  ],
});
```

For removable one-off listeners, use `engine.subscribe()` instead.

---

## Utility functions

### `matchesStrategy(strategy, event)`

```typescript
function matchesStrategy(strategy: ObserverStrategy, event: PathEvent): boolean
```

Returns `true` if the given event should trigger work under the given `ObserverStrategy`. Use this when writing custom `PathObserver` implementations so your observer honours the same strategy semantics as the built-in persistence helpers:

```typescript
const observer: PathObserver = (event, engine) => {
  if (matchesStrategy("onNext", event)) {
    store.save(key, engine.exportState()!);
  }
};
```

The `ObserverStrategy` values and when `matchesStrategy` returns `true` for each:

| Strategy | Fires when |
|---|---|
| `"onEveryChange"` | A `stateChanged` event where `status` is `"idle"` or `"error"`, or a `"resumed"` event |
| `"onNext"` | A `stateChanged` event caused by `next` where `status` is `"idle"` or `"error"` |
| `"onSubPathComplete"` | A `"resumed"` event (sub-path finished or cancelled) |
| `"onComplete"` | A `"completed"` event |
| `"manual"` | Never — caller decides when to save |

---

### `errorPhaseMessage(phase)`

```typescript
function errorPhaseMessage(phase: string): string
```

Converts an `error.phase` string from `snapshot.error` into a human-readable fallback message. Used by `PathShell` to populate the error panel when no custom message is provided.

| Phase | Message |
|---|---|
| `"entering"` | `"Failed to load this step."` |
| `"validating"` | `"The check could not be completed."` |
| `"leaving"` | `"Failed to save your progress."` |
| `"completing"` | `"Your submission could not be sent."` |
| anything else | `"An unexpected error occurred."` |

Call it directly when building a custom shell or error display:

```typescript
const message = errorPhaseMessage(snapshot.error.phase);
```

---

© 2026 Devjoy Ltd. MIT License.
