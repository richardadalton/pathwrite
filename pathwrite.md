# Pathwrite — headless multi-step path engine for TypeScript

> Pathwrite is a headless, framework-agnostic engine for multi-step flows (wizards, steppers, onboarding, checkout). A flow is a plain TypeScript object (`PathDefinition`) that the zero-dependency engine (`PathEngine`) executes — navigation, guards, validation, skip logic, lifecycle hooks, stack-based sub-paths, and persistence. Framework adapters for React, Vue, Angular, Svelte, SolidJS, and React Native subscribe to the engine and expose its state through each framework's own reactivity; each also ships an optional `PathShell` UI component you can replace at any time.

- npm: `@daltonr/pathwrite-core` (engine) + one adapter per framework + `@daltonr/pathwrite-store` (persistence)
- Repo: https://github.com/richardadalton/pathwrite — full docs in `docs/` (getting started, 11-chapter developer guide, complete core API reference at `docs/reference/core-api.md`)
- License: MIT. Zero runtime dependencies in the core.

## Install

```bash
npm install @daltonr/pathwrite-core @daltonr/pathwrite-react          # React
npm install @daltonr/pathwrite-core @daltonr/pathwrite-vue           # Vue 3
npm install @daltonr/pathwrite-core @daltonr/pathwrite-angular       # Angular
npm install @daltonr/pathwrite-core @daltonr/pathwrite-svelte        # Svelte 5
npm install @daltonr/pathwrite-core @daltonr/pathwrite-solid         # SolidJS
npm install @daltonr/pathwrite-core @daltonr/pathwrite-react-native  # React Native
npm install @daltonr/pathwrite-core                                  # framework-agnostic / Node
npm install @daltonr/pathwrite-store                                 # optional persistence backends
```

## The model

Your components read state and call actions — they never own the flow logic:

```tsx
import { PathShell } from "@daltonr/pathwrite-react";
import "@daltonr/pathwrite-react/styles.css";

const signupPath = {
  id: "signup",
  steps: [
    {
      id: "details",
      fieldErrors: ({ data }) => ({
        name:  !data.name  ? "Name is required."  : undefined,
        email: !data.email ? "Email is required." : undefined,
      }),
    },
    { id: "review" },
  ],
  onComplete: async (data) => { await api.createAccount(data); },
};

function App() {
  return (
    <PathShell
      path={signupPath}
      initialData={{ name: "", email: "" }}
      onComplete={() => navigate("/welcome")}
      steps={{ details: <DetailsForm />, review: <ReviewPanel /> }}
    />
  );
}
```

`PathShell` renders a progress indicator, step content, and navigation buttons. Swap it for your own UI whenever you need full control — `usePath()` (or the framework equivalent) gives you the raw snapshot and action functions.

## PathDefinition

```ts
interface PathDefinition<TData> {
  id: string;                       // required; appears in events, serialized state, sub-path callbacks
  steps: PathStep<TData>[];         // required, ordered
  onComplete?: (data: TData) => void | Promise<void>;  // engine status is "completing" while it runs
  onCancel?: (data: TData) => void;
  completionBehaviour?: "stayOnFinal" | "dismiss" | "reset";  // default "stayOnFinal"
}
```

`completionBehaviour`: `"stayOnFinal"` (default) keeps the engine active with `status === "completed"` until `restart()`; `"dismiss"` clears state so `snapshot()` returns `null`; `"reset"` immediately restarts from step 1 with the original `initialData` (kiosk flows).

### PathStep

```ts
interface PathStep<TData> {
  id: string;
  title?: string;
  meta?: Record<string, unknown>;
  shouldSkip?: (ctx) => boolean | Promise<boolean>;
  canMoveNext?: (ctx) => GuardResult | Promise<GuardResult>;      // guard forward navigation
  canMovePrevious?: (ctx) => GuardResult | Promise<GuardResult>;  // guard backward navigation
  // Map of field ID → error message (undefined = no error). When fieldErrors is
  // provided and canMoveNext is NOT, the engine derives canMoveNext as "all
  // values undefined". Evaluated synchronously on every snapshot.
  fieldErrors?: (ctx) => Record<string, string | undefined>;
  // Same shape, but never blocks navigation — purely advisory.
  fieldWarnings?: (ctx) => Record<string, string | undefined>;
  onEnter?: (ctx) => Partial<TData> | void | Promise<Partial<TData> | void>;
  onLeave?: (ctx) => Partial<TData> | void | Promise<Partial<TData> | void>;
  // Fired on the parent step when a sub-path completes / is cancelled; can
  // return a Partial<TData> to merge into the parent's data. `meta` is the
  // object passed to startSubPath() for correlation.
  onSubPathComplete?: (subPathId, subPathData, ctx, meta?) => Partial<TData> | void | Promise<...>;
  onSubPathCancel?: (subPathId, subPathData, ctx, meta?) => Partial<TData> | void | Promise<...>;
}
```

Guards return a `GuardResult`: `true`/`false` or `{ allowed: false, reason: string }` — the reason surfaces on the snapshot as `blockingError`. Hook callbacks receive a `PathStepContext<TData>` containing the current `data` and step info; returning a `Partial<TData>` from `onEnter`/`onLeave` merges it into the path data.

## PathEngine

```ts
import { PathEngine } from "@daltonr/pathwrite-core";
const engine = new PathEngine({ observers?: PathObserver[] });  // observers are permanent, wired at construction
```

| Method | Notes |
|---|---|
| `start(def, data?)` | Start (or replace) a path. Throws if the definition has no steps. |
| `restart()` | Tear down without firing lifecycle hooks and restart from step 1 with the original `initialData`. Clears `blockingError`, `hasAttemptedNext`, `isDirty`. |
| `next()` | Advance: runs `canMoveNext`, `onLeave`, `onEnter`. On the last step, completes the path. Dropped silently if `status !== "idle"` (concurrent navigation is debounced). |
| `previous()` | Go back: runs `canMovePrevious`, `onLeave`, `onEnter`. No-op on the first step of a top-level path; cancels a sub-path when called on the sub-path's first step. |
| `cancel()` | Cancel the active path (emits `cancelled`) or sub-path (pops it, emits `stateChanged` + `resumed` on the parent; fires `onSubPathCancel`). |
| `goToStep(stepId)` | Jump by ID, bypassing guards and `shouldSkip`. Throws on unknown ID. |
| `goToStepChecked(stepId)` | Jump by ID while enforcing the appropriate guard (`canMoveNext` when jumping forward, `canMovePrevious` backward); blocked silently if the guard refuses. |
| `setData(key, value)` | Update one data value; rebuilds `fieldErrors`/`fieldWarnings`/guard results synchronously; sets `isDirty` on real change. |
| `resetStep()` | Revert the current step's data to its values at step entry; clears `isDirty`. |
| `startSubPath(def, data?, meta?)` | Push a sub-path; the parent is paused on a stack. `meta` is passed back to `onSubPathComplete`/`onSubPathCancel`. |
| `retry()` | Re-run the last failed async operation when `status === "error"`. |
| `exportState()` | Full engine state as a JSON-serializable `SerializedPathState` (step position, data, visited tracking, sub-path stack), or `null` when inactive. |
| `snapshot()` | Current `PathSnapshot`, or `null` when no path is active. Stable between events. |
| `subscribe(listener)` | Removable listener receiving `PathEvent`s; returns unsubscribe. |
| `PathEngine.fromState(state, pathDefinitions, options?)` | *(static)* Reconstruct an engine from serialized state, already positioned on the saved step — no `start()` needed. `pathDefinitions` is a `Record<pathId, PathDefinition>`. |

## PathSnapshot (what your UI reads)

Key properties (all read-only):

- **Position**: `pathId`, `stepId`, `stepTitle`, `stepMeta`, `stepIndex` (0-based among visible steps), `stepCount`, `progress` (0.0–1.0), `steps: StepSummary[]` (`{ id, title?, meta?, status: "completed" | "current" | "upcoming" }`), `isFirstStep`, `isLastStep`.
- **Sub-paths**: `nestingLevel` (0 = top level), `rootProgress` (progress of the root path; present only when nested).
- **Activity**: `status: "idle" | "entering" | "leaving" | "validating" | "completing" | "completed" | "error"`; `error: { message, phase, retryCount } | null`.
- **Validation & guards**: `canMoveNext`, `canMovePrevious` (synchronous evaluation; async guards default optimistic `true`), `fieldErrors`, `fieldWarnings` (maps of field ID → message), `blockingError` (reason from the last refusing guard).
- **Form UX**: `isDirty` (data changed since entering the step), `hasAttemptedNext` (user pressed Next at least once on this step — gate error display on it), `stepEnteredAt` (timestamp), `hasPersistence`, `formId` (selected variant when the step is a StepChoice).
- **Data**: `data: TData` — a copy; mutating it does nothing.

## Events

```ts
type PathEvent =
  | { type: "stateChanged"; cause: "start" | "next" | "complete" | "previous" | "goToStep"
                                  | "goToStepChecked" | "setData" | "cancel" | "restart";
      snapshot: PathSnapshot }
  | { type: "completed"; pathId: string; data: PathData }
  | { type: "cancelled"; pathId: string; data: PathData }   // top-level path only
  | { type: "resumed"; resumedPathId: string; fromSubPathId: string; snapshot: PathSnapshot }
```

Cancelling a **sub-path** emits `resumed`, not `cancelled`.

## Persistence (`@daltonr/pathwrite-store`)

`PathStore` is the backend interface: `save(key, state)`, `load(key)` (returns `null` when absent), `delete(key)`. Implementations shipped: **`HttpStore`** (REST: POST/GET/DELETE `baseUrl/:key`), **`LocalStorageStore`** (browser), **`AsyncStorageStore`** (React Native).

Persistence is wired as an observer with a strategy: `"onEveryChange"`, `"onNext"`, `"onSubPathComplete"`, `"onComplete"`, or `"manual"`.

```ts
// Save as the user navigates
const engine = new PathEngine({
  observers: [httpPersistence({ store, key: "user:123:onboarding" })],
});

// Restore later
const saved = await store.load(key);
const engine2 = saved
  ? PathEngine.fromState(saved, { [path.id]: path }, { observers: [httpPersistence({ store, key })] })
  : startFresh();
```

`PathObserver` is `(event: PathEvent, engine: PathEngine) => void`, registered at construction, never removable — use it for persistence, logging, analytics. The helper `matchesStrategy(strategy, event)` lets custom observers honour the same strategy semantics. `errorPhaseMessage(phase)` maps `snapshot.error.phase` to a human-readable fallback message.

## Framework adapters

| Framework | Package | State API | Shell |
|---|---|---|---|
| React | `@daltonr/pathwrite-react` | `usePath()` hook (`useSyncExternalStore`) | `<PathShell>` |
| Vue 3 | `@daltonr/pathwrite-vue` | `usePath()` composable (`shallowRef` + `onScopeDispose`) | `<PathShell>` |
| Angular | `@daltonr/pathwrite-angular` | `PathFacade` injectable (RxJS `Observable` + `Signal`) | `<pw-shell>` |
| Svelte 5 | `@daltonr/pathwrite-svelte` | `usePath()` (runes-based store) | `PathShell` with a `steps` record + header/footer/completion snippets |
| SolidJS | `@daltonr/pathwrite-solid` | `usePath()` (`createSignal` accessor, `onCleanup`) | `<PathShell>` |
| React Native | `@daltonr/pathwrite-react-native` | `usePath()` hook | `PathShell` (Expo / bare RN) |

All shells share themable CSS (`styles.css` export; CSS custom properties documented in the repo's `docs/reference/shell-css.md`).

## Design principles

- **Workflows as artifacts** — a `PathDefinition` is a plain object: package it, version it with semver, test it without mounting anything, share it across web, mobile, and backend simultaneously.
- **Immutable snapshots** — every action produces a new `PathSnapshot`; nothing mutates in place.
- **Type-safe throughout** — `PathDefinition<TData>`, `PathStepContext<TData>`, `PathSnapshot<TData>` are generic over your data shape.
- **Stack-based sub-paths** — `startSubPath()` suspends the current path; completion or cancellation restores the parent with merged data.
- **Batteries included, removable** — `PathShell` for prototyping; drop to `usePath()` for full control.

## Testing

The engine runs headless — drive a whole flow in a unit test:

```ts
const engine = new PathEngine();
await engine.start(signupPath, { name: "", email: "" });
await engine.setData("name", "Ada");
await engine.next();
expect(engine.snapshot()!.stepId).toBe("review");
```

For the complete API (including StepChoice steps, `suspend()`, and serialized-state details), see `docs/reference/core-api.md` in the repo.
