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
| `progress` | `number` | Navigation progress as a fraction: `stepIndex / (stepCount - 1)`. Range `0.0` → `1.0`. `1` for a single-step path, and `1` whenever `status === "completed"`. |
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
| `blockingError` | `string \| null` | The `reason` from the most recent `canMoveNext` or `canMovePrevious` returning `{ allowed: false, reason }`. Cleared when a step is entered, and on `start()` / `restart()`. |
| `isDirty` | `boolean` | `true` if any data value has changed since entering the current step (shallow comparison). Resets to `false` on navigation, `resetStep()`, or `restart()`. |
| `hasAttemptedNext` | `boolean` | `true` once `next()` — or `goToStep` / `goToStepChecked` with `{ validateOnLeave: true }` — has been called on the current step. Tracked **per step id and persistent**: leaving the step and returning later still reports `true`. Scoped to the path instance (a freshly launched sub-path starts clean) and cleared for every step only by `start()` / `restart()`. Use to gate error display until the first submission attempt. |
| `hasValidated` | `boolean` | `true` after `validate()` has been called on this engine. Unlike `hasAttemptedNext` it is global — it does not vary by step. Cleared by `start()` / `restart()`. Use `hasAttemptedNext \|\| hasValidated` to gate errors in tabbed shells where every step must reveal its errors at once. |
| `stepEnteredAt` | `number` | `Date.now()` timestamp when the current step was entered. |
| `hasPersistence` | `boolean` | `true` when the engine was constructed with `PathEngineOptions.hasPersistence: true` (`restoreOrStart` from `@daltonr/pathwrite-store` sets it for you). Shells use it to decide whether to promise the user that progress is saved. |
| `error` | `{ message: string; phase: ErrorPhase; retryCount: number } \| null` | Details of the most recent async error. Non-null when `status === "error"`. `retryCount` starts at `0` and increments on each `retry()`. |
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
| `"completed"` | The path has finished and `completionBehaviour` is `"stayOnFinal"` (the default). The engine remains active: `snapshot()` returns a non-null snapshot with all steps marked completed, `progress === 1`, and `canMoveNext === false`. `PathShell` renders the completion panel. Call `engine.restart()` to start a new run. |
| `"error"` | An async operation threw — `snapshot.error` has details. |

### `ErrorPhase`

```typescript
type ErrorPhase = Exclude<PathStatus, "idle" | "error">;
// "entering" | "validating" | "leaving" | "completing" | "completed"
```

The type of `snapshot.error.phase` — the status the engine was in when the operation threw. Pass it to [`errorPhaseMessage()`](#errorphasemessagephase) for a fallback message.

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

## PathDefinition

`PathDefinition<TData>` describes the shape and behaviour of a path.

### Top-level options

| Option | Type | Default | Description |
|---|---|---|---|
| `id` | `string` | required | Unique identifier for this path. Appears in events, serialized state, and sub-path callbacks. |
| `title` | `string` | — | Optional display title for the path. Not read by the engine; available to shells and your own UI. |
| `steps` | `(PathStep<TData> \| StepChoice<TData>)[]` | required | Ordered array of step definitions. A [`StepChoice`](#stepchoice) slot picks one of several inner steps at entry time. |
| `onComplete` | `(data: TData) => void \| Promise<void>` | — | Called when the top-level path completes (user advances past the last step). Can be async — the engine sets `status` to `"completing"` while it runs. Not called for sub-paths; see `onSubPathComplete` on the parent step. |
| `onCancel` | `(data: TData) => void \| Promise<void>` | — | Called when the top-level path is cancelled via `cancel()`. Not called for sub-paths; see `onSubPathCancel` on the parent step. |
| `completionBehaviour` | `"stayOnFinal" \| "dismiss" \| "reset"` | `"stayOnFinal"` | Controls engine state after completion. See below. |

### `completionBehaviour`

| Value | Behaviour |
|---|---|
| `"stayOnFinal"` | **(default)** Engine stays active with `status === "completed"`. `snapshot()` returns a non-null snapshot; `PathShell` renders the completion panel. Call `restart()` to begin a new run. |
| `"dismiss"` | Engine clears its state after `onComplete` resolves. `snapshot()` returns `null`. |
| `"reset"` | Engine immediately restarts from step 1 with the original `initialData` after `onComplete` resolves. Useful for kiosk or repeating flows. |

---

## PathStep

`PathStep<TData>` describes one step. Every hook and guard receives a [`PathStepContext`](#pathstepcontext).

| Option | Type | Description |
|---|---|---|
| `id` | `string` | required. Unique within the path. Surfaces as `snapshot.stepId` and is the target of `goToStep()`. |
| `title` | `string` | Optional display title. Surfaces as `snapshot.stepTitle` and `StepSummary.title`. |
| `meta` | `Record<string, unknown>` | Arbitrary data for your UI (icons, section labels, …). Surfaces as `snapshot.stepMeta` and `StepSummary.meta`. Not read by the engine. |
| `shouldSkip` | `(ctx) => boolean \| Promise<boolean>` | Evaluated as the engine passes over the step during `start()`, `next()`, and `previous()`. Return `true` to skip it. Confirmed skips are removed from `snapshot.steps` / `stepCount`. Not evaluated by `goToStep()` / `goToStepChecked()`. An async `shouldSkip` works but logs a one-time warning: `stepCount` and `progress` are approximate until the first navigation. |
| `canMoveNext` | `(ctx) => GuardResult \| Promise<GuardResult>` | Guard run by `next()` (and by `goToStepChecked()` when moving forward). If omitted and `fieldErrors` is defined, the engine derives `canMoveNext` as "no error messages". |
| `canMovePrevious` | `(ctx) => GuardResult \| Promise<GuardResult>` | Guard run by `previous()` (and by `goToStepChecked()` when moving backward). Defaults to allowed. |
| `fieldErrors` | `(ctx) => FieldErrors` | Returns field ID → error message for the step. Evaluated synchronously on every snapshot (an async function is treated as `{}`). Surfaces as `snapshot.fieldErrors` with `undefined` values dropped. Use the key `"_"` for form-level messages. |
| `fieldWarnings` | `(ctx) => FieldErrors` | Same shape as `fieldErrors`, but purely advisory — never affects `canMoveNext`. Surfaces as `snapshot.fieldWarnings`. |
| `onEnter` | `(ctx) => Partial<TData> \| void \| Promise<…>` | Runs when the step is entered (`status === "entering"`). Return a patch to merge into the data. Use `ctx.isFirstEntry` to avoid overwriting data on re-entry. |
| `onLeave` | `(ctx) => Partial<TData> \| void \| Promise<…>` | Runs after the guard passes and before the next step is entered (`status === "leaving"`). Return a patch to merge into the data. |
| `onSubPathComplete` | `(subPathId, subPathData, ctx, meta?) => Partial<TData> \| void \| Promise<…>` | Runs on the parent step when a sub-path launched from it completes. Receives the sub-path's ID and final data, the parent's context, and the `meta` passed to `startSubPath()`. Return a patch for the parent's data. |
| `onSubPathCancel` | `(subPathId, subPathData, ctx, meta?) => Partial<TData> \| void \| Promise<…>` | Runs on the parent step when a sub-path launched from it is cancelled (`cancel()`, or `previous()` on its first step). Same arguments as `onSubPathComplete`, with the sub-path's data at the time of cancellation. |

Hooks and guards that throw put the engine into `status === "error"` with `snapshot.error.phase` set to the phase that was running; see [`retry()`](#retry).

### `PathStepContext`

```typescript
interface PathStepContext<TData = PathData> {
  readonly pathId: string;
  readonly stepId: string;
  readonly data: Readonly<TData>;   // a copy — mutate nothing, return a patch instead
  readonly isFirstEntry: boolean;
}
```

`isFirstEntry` is `true` the first time a step is entered within the current path instance and `false` on every re-entry (for example after navigating back and forward again). It is reset by `start()` / `restart()` and is always fresh for a newly launched sub-path.

### `GuardResult`

```typescript
type GuardResult = boolean | { allowed: boolean; reason?: string | null };
```

The return type of `canMoveNext` and `canMovePrevious`. `true` allows; `false` blocks silently; `{ allowed: false, reason: "…" }` blocks and surfaces `reason` as `snapshot.blockingError`. `reason` is ignored when `allowed` is `true`.

### `FieldErrors`

```typescript
type FieldErrors = Record<string, string | undefined>;
```

The return type of `fieldErrors` and `fieldWarnings`. A value of `undefined` (or an omitted key) means "no message for this field". On the snapshot these become `Record<string, string>` with the `undefined`, `null`, and empty-string entries removed.

### `StepChoice`

A `StepChoice` is placed in `steps` in place of a single `PathStep`. On entry the engine calls `select` to decide which of the bundled `steps` to activate; the chosen step's hooks, guards, and validation then apply as normal.

```typescript
interface StepChoice<TData = PathData> {
  id: string;                                    // used for progress and goToStep()
  title?: string;
  meta?: Record<string, unknown>;
  select: (ctx: PathStepContext<TData>) => string;  // return the id of one of `steps`
  steps: PathStep<TData>[];
  shouldSkip?: (ctx: PathStepContext<TData>) => boolean | Promise<boolean>;
}
```

`snapshot.stepId` is the choice's own `id`; `snapshot.formId` is the `id` of the selected inner step, so the UI can render the right component. `select` throws if it returns an id that is not in `steps`. The selection is re-evaluated each time the slot is entered (and on `fromState()` restore), not serialized.

---

## PathEvent

Subscribe with `engine.subscribe(listener)`. The listener receives a `PathEvent` on every meaningful engine state change.

```typescript
type PathEvent =
  | { type: "stateChanged"; cause: StateChangeCause; snapshot: PathSnapshot }
  | { type: "completed";    pathId: string; data: PathData }
  | { type: "cancelled";    pathId: string; data: PathData }
  | { type: "suspended";    pathId: string; data: PathData }
  | { type: "resumed";      resumedPathId: string; fromSubPathId: string; snapshot: PathSnapshot };
```

### `StateChangeCause`

```typescript
type StateChangeCause =
  | "start"
  | "next"
  | "previous"
  | "complete"
  | "goToStep"
  | "goToStepChecked"
  | "setData"
  | "resetStep"
  | "cancel"
  | "restart"
  | "retry"
  | "suspend"
  | "validate";
```

Each value names the public method that triggered the `stateChanged` event. `"complete"` is emitted when the path transitions to `status === "completed"` (i.e. `completionBehaviour: "stayOnFinal"`). It fires before the `completed` event so observers can distinguish the "engine is now in completed state" snapshot from subsequent navigation. `"cancel"` is the cause when a sub-path is cancelled and the parent becomes active again. `"retry"` is the cause of every event emitted by a navigation re-run via `retry()`.

### Event reference

| Event type | When fired | Payload |
|---|---|---|
| `stateChanged` | After every navigation, `setData`, `resetStep`, or `validate` call. May fire multiple times per operation as `snapshot.status` transitions through phases. | `cause: StateChangeCause`, `snapshot: PathSnapshot` |
| `completed` | When the top-level path finishes naturally (user advances past the last step). | `pathId: string`, `data: PathData` (final state) |
| `cancelled` | When the top-level path is cancelled via `cancel()`. | `pathId: string`, `data: PathData` |
| `suspended` | When `suspend()` is called on a settled engine. Signals the app to dismiss the UI; the engine's state is left intact. | `pathId: string`, `data: PathData` |
| `resumed` | When a sub-path **completes** and the parent path is restored. Not emitted for a sub-path cancel. | `resumedPathId: string` (parent path ID), `fromSubPathId: string`, `snapshot: PathSnapshot` |

> Cancelling a sub-path emits neither `cancelled` nor `resumed`: the parent is restored and `stateChanged` fires with cause `"cancel"` (once with `status: "leaving"` while `onSubPathCancel` runs, then with `status: "idle"`). The top-level `cancelled` event is only for the root path being cancelled.

---

## PathEngine

### Constructor

```typescript
const engine = new PathEngine<TData>(options?: PathEngineOptions<TData>);
```

`TData` (default `PathData`) is the shape of the path data. It types `start`'s definition and initial data, `setData`, `snapshot().data`, the events passed to `subscribe` and the observers. Prefer a `type` alias for it: an `interface` that extends `PathData` carries a string index signature, which makes every key legal for `setData` (values for known keys are still checked).

```typescript
interface PathEngineOptions<TData = PathData> {
  observers?:      PathObserver<TData>[];
  hasPersistence?: boolean;
}
```

Observers are wired at construction time and cannot be removed. They run for the engine's entire lifetime. Use `engine.subscribe()` for removable one-off listeners.

Set `hasPersistence: true` when a `PathStore` is attached and will save progress. It is exposed as `snapshot.hasPersistence` so shells can honestly tell the user their progress is saved in the "come back later" escalation. `restoreOrStart()` from `@daltonr/pathwrite-store` sets it automatically.

---

### Instance methods

#### `start(def, data?)`

```typescript
engine.start(def: PathDefinition<TData>, data?: Partial<TData>): Promise<void>
```

Start or restart a path. Throws if the definition has no steps. Emits `stateChanged` with cause `"start"` once `onEnter` completes on the first step.

If a path is already active (or completed), calling `start()` replaces it — sub-path stack included — without firing any lifecycle hooks on the old path. It never nests; use `startSubPath()` for that. Safe to call while a hook or guard of the old path is still running: the abandoned navigation never touches the new path. Clears `blockingError`, `hasAttemptedNext`, `hasValidated`, and any pending error / retry.

---

#### `restart()`

```typescript
engine.restart(): Promise<void>
```

Tear down any active path without firing lifecycle hooks (`onLeave`, `onCancel`, etc.) and restart from step 1 with the original `initialData` that was passed to the most recent `start()` call. Requires `start()` to have been called at least once. Emits `stateChanged` with cause `"restart"`.

Use for "Start over" and retry flows. Clears `blockingError`, `hasAttemptedNext`, `hasValidated`, `isDirty`, and any pending error / retry. Like `start()`, it is safe to call while a navigation is in flight.

---

#### `next()`

```typescript
engine.next(): Promise<void>
```

Advance one step forward. Marks the current step as attempted (`hasAttemptedNext`), runs `canMoveNext` on the current step, then `onLeave` and `onEnter`. If called on the last step (and `canMoveNext` allows), the path completes and emits `completed`.

If `status !== "idle"` when called, the call is dropped immediately (concurrent navigation is debounced automatically). Calling it while `status === "error"` clears the error and starts a fresh navigation.

If a guard or hook throws, the promise still resolves: the engine sets `snapshot.error`, moves to `status === "error"`, and stores the failed phase so [`retry()`](#retry) can re-run it. `previous()`, `goToStep()`, `goToStepChecked()`, and a sub-path `cancel()` all follow this same error / retry model.

---

#### `previous()`

```typescript
engine.previous(): Promise<void>
```

Go back one step. Runs `canMovePrevious` under `status === "validating"`, then `onLeave` (`"leaving"`) and `onEnter` (`"entering"`) — the same phase contract as `next()`. A guard returning `{ allowed: false, reason }` sets `blockingError` and leaves the engine idle on the current step. No-op (silently returns) when already on the first step of a top-level path. Cancels a sub-path when called on the sub-path's first step, restoring the parent (see `cancel()`).

---

#### `cancel()`

```typescript
engine.cancel(): Promise<void>
```

Cancel the active path or sub-path. Only acts when the engine is settled (`"idle"` or `"error"`); otherwise the call is dropped.

For a top-level path: clears the engine (`snapshot()` becomes `null`), emits `cancelled`, then awaits `onCancel` if defined.

For a sub-path: pops it and restores the parent, emitting `stateChanged` with cause `"cancel"` — first with `status: "leaving"` while the parent step's `onSubPathCancel` runs, then with `status: "idle"`. No `cancelled` or `resumed` event is emitted. If `onSubPathCancel` throws, the engine enters `status === "error"` on the parent step and `retry()` re-runs the hook.

---

#### `goToStep(stepId, options?)`

```typescript
engine.goToStep(stepId: string, options?: { validateOnLeave?: boolean }): Promise<void>
```

Jump directly to a step by ID. Calls `onLeave` on the current step and `onEnter` on the target step. Bypasses `canMoveNext`, `canMovePrevious`, and `shouldSkip` — jumping to a step that an earlier navigation skipped makes it visible again (it is removed from the skip cache and counted in `steps` / `stepCount`). Throws synchronously if the step ID is not found. Emits `stateChanged` with cause `"goToStep"`.

Pass `{ validateOnLeave: true }` to mark the **departing** step as attempted before navigating, so `hasAttemptedNext` is `true` when the user returns to it — ideal for tab-style navigation where Next is never clicked.

Targeting the step the path is already on does not navigate: no `onLeave` / `onEnter`, and the step's entry data (for `resetStep()`) is kept. With `validateOnLeave` the step is still marked attempted and `stateChanged` is emitted.

Use for non-linear transitions such as rejection flows or editorial navigation.

---

#### `goToStepChecked(stepId, options?)`

```typescript
engine.goToStepChecked(stepId: string, options?: { validateOnLeave?: boolean }): Promise<void>
```

Jump to a step by ID while still enforcing the guard. Checks `canMoveNext` when the target step is ahead of the current step, or `canMovePrevious` when it is behind. If the guard blocks, navigation does not occur, `blockingError` is set from the guard's `reason`, and `stateChanged` is still emitted so the UI can react. `shouldSkip` is not evaluated. Returns a rejected promise if the step ID is not found. Emits `stateChanged` with cause `"goToStepChecked"`.

Accepts the same `{ validateOnLeave }` option as `goToStep()`, and targeting the current step behaves the same way (no guard, no hooks, `validateOnLeave` still marks the step attempted).

---

#### `setData(key, value)`

```typescript
engine.setData<K extends string & keyof TData>(key: K, value: TData[K]): Promise<void>
```

Update a single data value. Emits `stateChanged` with cause `"setData"`. Sets `isDirty` to `true` if the new value differs from the entry value (shallow comparison). Rebuilds `fieldErrors`, `fieldWarnings`, `canMoveNext`, and `canMovePrevious` synchronously on the new snapshot. No-op once the path has `completed`.

---

#### `resetStep()`

```typescript
engine.resetStep(): Promise<void>
```

Revert the current step's data to the values it had when the step was entered. Sets `isDirty` to `false`. Emits `stateChanged` with cause `"resetStep"`. Does not re-run `onEnter`. No-op once the path has `completed`. Useful for "Clear" or "Undo Changes" buttons.

---

#### `startSubPath(def, data?, meta?)`

```typescript
engine.startSubPath(
  def:   PathDefinition,
  data?: PathData,
  meta?: Record<string, unknown>
): Promise<void>
```

Push a sub-path on top of the current active path. The parent is paused and preserved on the stack. Throws if no path is active; dropped (like any navigation) unless `status === "idle"`, so it cannot be launched from inside a hook such as `onEnter`. The optional `meta` object is passed back unchanged to `onSubPathComplete` and `onSubPathCancel` on the parent step.

---

#### `suspend()`

```typescript
engine.suspend(): Promise<void>
```

Pause the path with the intent to return later. Only acts when the engine is settled (`status` is `"idle"` or `"error"`); otherwise it resolves without doing anything. It clears `snapshot.error` and any pending retry, sets `status` to `"idle"`, and emits a `suspended` event (`{ type: "suspended", pathId, data }`). All state and data are left intact — nothing is torn down.

Use it in the "Come back later" escalation once `snapshot.error.retryCount` has crossed your threshold. Listen for `suspended` to dismiss the UI (close the modal, navigate away); a persistence observer keeps the saved state, and `restoreOrStart()` from `@daltonr/pathwrite-store` resumes it when the user returns.

---

#### `retry()`

```typescript
engine.retry(): Promise<void>
```

Retry the last failed async operation when `snapshot.status === "error"`. Clears `snapshot.error`, increments `retryCount`, and re-runs only the phase that failed (the entry hook, the guard, the leave hook, `onComplete`, or `onSubPathCancel`). Events emitted by the re-run carry cause `"retry"`. No-op when there is no pending error.

---

#### `validate()`

```typescript
engine.validate(): void
```

Mark the engine as validation-attempted without navigating. Sets `snapshot.hasValidated` to `true` and emits `stateChanged` with cause `"validate"`. Only acts when a path is active and the engine is settled (`"idle"` or `"error"`). Intended for an outer shell to reveal every inner step's errors at once (for example when the outer Next is clicked over a tabbed inner shell). Cleared by `start()` / `restart()`.

---

#### `exportState()`

```typescript
engine.exportState(): SerializedPathState | null
```

Return the full current engine state as a plain JSON-serializable object, or `null` if no path is active. The serialized state includes the current step position, all path data, visited / attempted / skipped step tracking, the current step's entry data, `hasValidated`, `blockingError`, the root path's `initialData`, and the full sub-path stack. See [`SerializedPathState`](#serializedpathstate) for the shape.

Pass the result to `PathEngine.fromState()` to restore the engine later.

---

#### `snapshot()`

```typescript
engine.snapshot(): PathSnapshot<TData> | null
```

Synchronous read of the current snapshot. Returns `null` when no path is active (before `start()` is called, after cancellation, or after completion with `completionBehaviour: "dismiss"`).

With the default `completionBehaviour: "stayOnFinal"`, `snapshot()` returns a non-null snapshot with `status === "completed"` after the path finishes — the engine remains active and `restart()` can be called to begin a new run.

Every call builds and returns a **new** object (snapshots are value objects; `data` is a fresh copy each time), so two calls between events are equal by value but not by reference. Adapters that need a stable reference for change detection (for example React's `useSyncExternalStore`) cache the snapshot delivered with each event rather than calling `snapshot()` on every render. Synchronous guards and `fieldErrors` / `fieldWarnings` hooks are evaluated on each call.

---

#### `subscribe(listener)`

```typescript
engine.subscribe(listener: (event: PathEvent<TData>) => void): () => void
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
PathEngine.fromState<TData>(
  state:           SerializedPathState,
  pathDefinitions: Record<string, PathDefinition>,
  options?:        PathEngineOptions<TData>
): PathEngine<TData>
```

Reconstruct a working engine from serialized state. The engine is already positioned on the correct step — no `start()` call is needed. Throws if `state.version` is unsupported or if a path ID in the state (active path or any stack entry) is missing from `pathDefinitions`. Only settled statuses survive a restore: a state exported mid-navigation comes back as `"idle"`, `"completed"` is kept, and `"error"` is dropped (the retry closure is not serializable). Pass the same `observers` you would use on a fresh engine:

```typescript
import { persistence } from "@daltonr/pathwrite-store";

const saved = await store.load(key);
const engine = PathEngine.fromState(saved, { [path.id]: path }, {
  observers: [persistence({ store, key })],
  hasPersistence: true,
});
// engine is on the saved step, ready to navigate
```

`restoreOrStart()` from `@daltonr/pathwrite-store` wraps this load / restore-or-start pattern in one call.

---

## SerializedPathState

The plain-object shape produced by `exportState()` and consumed by `PathEngine.fromState()`. Only state is serialized — never the path definition, which must be supplied again on restore.

```typescript
interface SerializedPathState {
  version: 1;
  pathId: string;
  currentStepIndex: number;
  data: PathData;
  visitedStepIds: string[];
  attemptedStepIds?: string[];       // drives hasAttemptedNext
  skippedStepIds?: string[];         // drives stepCount / progress until the next navigation
  subPathMeta?: Record<string, unknown>;
  stepEntryData?: PathData;          // drives resetStep() and isDirty
  stepEnteredAt?: number;
  pathStack: Array<{
    pathId: string;
    currentStepIndex: number;
    data: PathData;
    visitedStepIds: string[];
    attemptedStepIds?: string[];
    skippedStepIds?: string[];
    subPathMeta?: Record<string, unknown>;
    stepEntryData?: PathData;
    stepEnteredAt?: number;
  }>;
  _status: PathStatus;
  hasValidated?: boolean;
  blockingError?: string | null;
  initialData?: PathData;            // what restart() resets to after a restore
}
```

Every optional field is written by the current engine but may be absent from states saved by older versions; `fromState()` falls back to an empty value (no attempted or skipped steps, `hasValidated: false`, `blockingError: null`, `initialData: {}`, `stepEntryData` = `data`). Out-of-range step indexes are clamped into the definition, and `StepChoice` selections are re-derived from the data rather than stored.

---

## PathStore interface

`PathStore` is the interface that persistence backends must implement. Provide it to `persistence()` / `restoreOrStart()` from `@daltonr/pathwrite-store`, or use it directly with `engine.exportState()` / `PathEngine.fromState()`.

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

`@daltonr/pathwrite-store` provides three implementations:
- **`HttpStore`** — saves state to a REST API (`POST /baseUrl/:key`, `GET /baseUrl/:key`, `DELETE /baseUrl/:key`).
- **`LocalStorageStore`** — saves state to `window.localStorage` (browser only).
- **`AsyncStorageStore`** — saves state through an `AsyncStorage`-style adapter (React Native).

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
    persistence({ store, key: "user:123:onboarding" }),
    logger,
    analyticsObserver,
  ],
});
```

For removable one-off listeners, use `engine.subscribe()` instead.

A listener or observer that throws is isolated: the engine logs the error with `console.error`, carries on notifying the remaining listeners, and the navigation that emitted the event is unaffected.

---

## ProgressLayout

```typescript
type ProgressLayout = "merged" | "split" | "rootOnly" | "activeOnly";
```

Shared by every adapter's `PathShell` as its `progressLayout` prop. Controls how progress bars are rendered while a sub-path is active (`nestingLevel > 0`), using `snapshot.rootProgress` for the root bar:

| Value | Behaviour |
|---|---|
| `"merged"` | **(default)** Root and sub-path bars in one card |
| `"split"` | Root and sub-path bars as separate cards |
| `"rootOnly"` | Only the root bar — the sub-path bar is hidden |
| `"activeOnly"` | Only the active (sub-path) bar — the root bar is hidden |

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
| `"onNext"` | A `stateChanged` event caused by `next` (or by a sub-path `cancel`) where `status` is `"idle"` or `"error"`, and every `resumed` event — so the return from a sub-path is always covered |
| `"onSubPathComplete"` | A `"resumed"` event (a sub-path finished and the parent resumed — not a cancel) |
| `"onComplete"` | A `"completed"` event |
| `"manual"` | Never — caller decides when to save |

---

### `errorPhaseMessage(phase)`

```typescript
function errorPhaseMessage(phase: string): string
```

Converts an `error.phase` value (`ErrorPhase`) from `snapshot.error` into a human-readable fallback message. Used by `PathShell` to populate the error panel when no custom message is provided.

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

### `formatFieldKey(key)`

```typescript
function formatFieldKey(key: string): string
```

Converts a camelCase or lowercase field key into a display label: `"firstName"` → `"First Name"`, `"email"` → `"Email"`. Used by the shells to label entries in the automatic `fieldErrors` / `fieldWarnings` summary; call it when building your own.

---

## Services

`@daltonr/pathwrite-core` also exports a small helper for the async service calls that guards and hooks tend to make.

### `defineServices(config, options?)`

```typescript
function defineServices<T extends Record<string, (...args: any[]) => Promise<any>>>(
  config:   { [K in keyof T]: { fn: T[K]; cache: "auto" | "none"; retry?: number } },
  options?: { storage?: SyncServiceStorage | AsyncServiceStorage; keyPrefix?: string }
): T & { prefetch(manifest?): Promise<void> }
```

Wraps a set of async functions with caching (`cache: "auto"` memoises the first result per argument list and deduplicates concurrent calls; `"none"` always calls through), optional retry with exponential back-off, and an optional persistent cache (`localStorage`, React Native `AsyncStorage`, or anything with the same `getItem` / `setItem` / `removeItem` shape). `keyPrefix` defaults to `"pw-svc:"`. `services.prefetch()` warms every zero-argument `"auto"` method; pass a manifest to warm specific argument lists.

### `ServiceUnavailableError`

```typescript
class ServiceUnavailableError extends Error {
  readonly method:   string;   // the service method name
  readonly attempts: number;   // retry + 1
  readonly cause:    unknown;  // the last underlying error
}
```

Thrown by a service method once its `retry` budget is exhausted. Catch it in a guard to return `{ allowed: false, reason }` instead of letting the engine enter `status === "error"`.

See [Services](../developer-guide/08-services.md) in the developer guide for the full model and worked examples.

---

© 2026 Devjoy Ltd. MIT License.
