# Pathwrite — Developer Guide

## Table of Contents

1. [What is Pathwrite?](#1-what-is-pathwrite)
2. [Repository Layout](#2-repository-layout)
3. [Core Concepts](#3-core-concepts)
4. [Defining a Path](#4-defining-a-path)
5. [Step Lifecycle](#5-step-lifecycle)
6. [Navigation Guards](#6-navigation-guards)
7. [The PathSnapshot](#7-the-pathsnapshot)
8. [Events](#8-events)
9. [Sub-Paths](#9-sub-paths)
10. [Angular Adapter](#10-angular-adapter)
11. [React Adapter](#11-react-adapter)
12. [Vue Adapter](#12-vue-adapter)
13. [Default UI Shell](#13-default-ui-shell)
14. [Using the Core Engine Directly](#14-using-the-core-engine-directly)
15. [TypeScript Generics](#15-typescript-generics)
16. [Backend Lifecycle Patterns](#16-backend-lifecycle-patterns)
17. [Testing](#17-testing)
18. [Design Decisions](#18-design-decisions)

---

## 1. What is Pathwrite?

Pathwrite is a **headless path engine**. It manages step navigation, data collection, navigation guards, and sub-path stacking — with no dependency on any UI framework.

UI frameworks are supported through thin adapters:

| Package | For |
|---|---|
| `@daltonr/pathwrite-core` | Framework-agnostic engine (zero deps) |
| `@daltonr/pathwrite-angular` | Angular — exposes state as RxJS observables |
| `@daltonr/pathwrite-react` | React — exposes state via `useSyncExternalStore` |
| `@daltonr/pathwrite-vue` | Vue 3 — exposes state as a reactive `shallowRef` |

**Headless** means Pathwrite owns no HTML. You write all the markup; Pathwrite tells you which step you're on, whether navigation is allowed, and what data the user has entered so far.

---

## 2. Repository Layout

```
pathwrite/
├── packages/
│   ├── core/                   # @daltonr/pathwrite-core
│   ├── angular-adapter/        # @daltonr/pathwrite-angular (+ shell entry point)
│   ├── react-adapter/          # @daltonr/pathwrite-react (+ PathShell / PathStep)
│   ├── vue-adapter/            # @daltonr/pathwrite-vue (+ PathShell / PathStep)
│   └── shell.css               # Optional shared stylesheet for shell components
├── apps/
│   ├── demo-angular-course/    # Angular demo (multi-step course path, manual UI)
│   ├── demo-angular-shell/     # Angular demo using <pw-shell> default UI
│   ├── demo-angular/           # Angular demo (simple)
│   ├── demo-console/           # Console demo
│   └── demo-lifecycle/         # Backend lifecycle state machine (no UI)
├── vitest.config.ts            # Root test config (runs all packages)
└── package.json                # npm workspaces root
```

To run the full test suite:

```bash
npm test
```

To run tests in watch mode:

```bash
npm run test:watch
```

---

## 3. Core Concepts

### PathData

A path carries a single plain object called **data** (typed as `PathData`) throughout its lifetime. It is the path's data store — equivalent to a form model.

```typescript
type PathData = Record<string, unknown>;
```

Data is passed in when a path starts, and every step hook and guard can read or update it. You never mutate it directly from outside — you call `setData(key, value)` or return a patch from a lifecycle hook.

### PathDefinition

A path is described by a `PathDefinition`: an ID, an optional title, and an ordered array of `PathStep` objects.

### PathSnapshot

At any moment the engine can produce a **snapshot** — a read-only, point-in-time description of the current state: which step you're on, the progress percentage, a summary of all steps with their statuses, whether navigation is in progress, and a copy of the current data.

### Events

The engine emits an event every time something meaningful happens (`stateChanged`, `completed`, `cancelled`, `resumed`). Adapters subscribe to these events and translate them into framework-native reactive primitives.

---

## 4. Defining a Path

```typescript
import { PathDefinition } from "@daltonr/pathwrite-core";

const myPath: PathDefinition = {
  id: "my-path",        // must be unique within your app
  title: "My Path",     // optional, for display
  steps: [
    { id: "step-one",   title: "Step One" },
    { id: "step-two",   title: "Step Two" },
    { id: "step-three", title: "Step Three" },
  ]
};
```

### Step fields

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | ✅ | Unique within the path. This is the key used to link steps to UI blocks. |
| `title` | `string` | — | Human-readable label. Exposed in the snapshot as `stepTitle` and in `steps[].title`. |
| `meta` | `Record<string, unknown>` | — | Arbitrary metadata (e.g. icon name, group). Exposed as `stepMeta` and `steps[].meta`. |
| `shouldSkip` | function | — | Return `true` to skip this step during navigation. |
| `canMoveNext` | function | — | Return `false` to block forward navigation. |
| `canMovePrevious` | function | — | Return `false` to block backward navigation. |
| `onEnter` | function | — | Called on arrival at a step. Can return a partial data patch. |
| `onLeave` | function | — | Called on departure (only when the guard allows). Can return a partial data patch. |
| `onSubPathComplete` | function | — | Called when a sub-path launched from this step finishes. Can return a partial data patch. |

---

## 5. Step Lifecycle

Every hook receives a **`PathStepContext`** object:

```typescript
interface PathStepContext<TData> {
  readonly pathId: string;   // ID of the currently active path
  readonly stepId: string;   // ID of the current step
  readonly data:   Readonly<TData>; // snapshot copy — mutating it has no effect
}
```

> **Important:** `ctx.data` is a **copy**. To update data, return a partial patch from the hook. The engine merges it automatically.

### Hook execution order (moving forward)

```
canMoveNext(current step)
  → false: stop, emit stateChanged (isNavigating: false)
  → true:
      onLeave(current step)         ← patch applied to data
      advance index
      shouldSkip(new step)?         ← repeat until a non-skipped step is found
      onEnter(new step)             ← patch applied to data
      emit stateChanged (isNavigating: false)
```

### Hook execution order (moving backward)

```
canMovePrevious(current step)
  → false: stop, emit stateChanged (isNavigating: false)
  → true:
      onLeave(current step)         ← patch applied to data
      decrement index
      shouldSkip(new step)?         ← repeat until a non-skipped step is found
      if index < 0: cancel path
      onEnter(new step)             ← patch applied to data
      emit stateChanged (isNavigating: false)
```

### Async hooks

All hooks and guards can be `async` or return a `Promise`. The engine `await`s them and sets `isNavigating: true` in the snapshot for the entire duration so you can disable navigation controls.

```typescript
{
  id: "validate",
  canMoveNext: async (ctx) => {
    const result = await myApi.validate(ctx.data.email);
    return result.ok;
  }
}
```

---

## 6. Navigation Guards

Guards (`canMoveNext`, `canMovePrevious`) block navigation without altering data. They receive the same `PathStepContext` as hooks.

```typescript
{
  id: "details",
  canMoveNext: (ctx) => {
    return typeof ctx.data.name === "string" && ctx.data.name.trim().length > 0;
  }
}
```

When a guard returns `false`, the engine stays on the current step. It emits two `stateChanged` events (one with `isNavigating: true` at the start, one with `isNavigating: false` at the end) so the UI can show and clear a loading state even on a synchronous block. Importantly, `onEnter` is **not** re-run on the current step when a guard blocks — the step's state is left undisturbed.

### Proactive guard feedback via the snapshot

The snapshot includes `canMoveNext` and `canMovePrevious` booleans, which are the **evaluated results** of the current step's guards at the time the snapshot was built. This lets the UI proactively disable navigation buttons *before* the user clicks, rather than silently blocking after the fact.

```typescript
// Disable the Next button when the guard would block
<button disabled={snapshot.isNavigating || !snapshot.canMoveNext}>Next</button>
```

The values update automatically whenever the snapshot is rebuilt (e.g. after `setData`), so a guard like `canMoveNext: (ctx) => ctx.data.name.length > 0` will flip from `false` to `true` as soon as the user types a name.

**Async guards**: If a guard returns a `Promise`, the snapshot defaults to `true` (optimistic). The engine still enforces the real result when navigation is attempted.

### `shouldSkip`

`shouldSkip` is evaluated **during navigation**, not as a guard. If it returns `true`, the step is silently passed over in the direction of travel. It is re-evaluated on every navigation, so a step can become skipped or unskipped dynamically based on data.

```typescript
{
  id: "payment",
  shouldSkip: (ctx) => ctx.data.isFreeAccount === true
}
```

If all remaining steps are skipped going forward, the path **completes**. If all preceding steps are skipped going backward, the path **cancels**.

---

## 7. The PathSnapshot

`engine.snapshot()` returns `null` when no path is active, or a `PathSnapshot` object:

```typescript
interface PathSnapshot<TData> {
  pathId:         string;               // ID of the active path
  stepId:         string;               // ID of the current step
  stepTitle?:     string;               // step.title, if defined
  stepMeta?:      Record<string, unknown>; // step.meta, if defined
  stepIndex:      number;               // 0-based index of the current step
  stepCount:      number;               // total number of steps
  progress:       number;               // 0.0 → 1.0 (stepIndex / (stepCount - 1))
  steps:          StepSummary[];        // summary of every step with its status
  isFirstStep:    boolean;
  isLastStep:     boolean;              // false if a sub-path is active
  nestingLevel:   number;               // 0 for top-level, +1 per nested sub-path
  isNavigating:   boolean;              // true while an async hook/guard is running
  canMoveNext:    boolean;              // result of the current step's canMoveNext guard
  canMovePrevious: boolean;             // result of the current step's canMovePrevious guard
  data:           TData;                // copy of current path data
}
```

### `steps` array — the progress bar source

Each element of `steps` is a `StepSummary`:

```typescript
interface StepSummary {
  id:      string;
  title?:  string;
  meta?:   Record<string, unknown>;
  status:  "completed" | "current" | "upcoming";
}
```

Steps before the current index are `"completed"`, the current step is `"current"`, and later steps are `"upcoming"`.

### `isNavigating` — disabling controls

While an async hook or guard is running, `isNavigating` is `true` in all `stateChanged` events emitted during that operation. The final event always has `isNavigating: false`. Bind your navigation button `disabled` state to this flag.

### `canMoveNext` / `canMovePrevious` — proactive guard feedback

The snapshot evaluates the current step's `canMoveNext` and `canMovePrevious` guards synchronously whenever it is built (on every `stateChanged`, `setData`, etc.). Use these to proactively disable buttons:

```typescript
<button disabled={snapshot.isNavigating || !snapshot.canMoveNext}>Next</button>
<button disabled={snapshot.isNavigating || !snapshot.canMovePrevious}>Back</button>
```

If no guard is defined, the value defaults to `true`. If the guard is async (returns a `Promise`), the snapshot defaults to `true` optimistically — the engine still enforces the real result on navigation.

---

## 8. Events

Subscribe with `engine.subscribe`. The callback receives a `PathEvent`:

```typescript
type PathEvent =
  | { type: "stateChanged"; snapshot: PathSnapshot }
  | { type: "completed";    pathId: string; data: PathData }
  | { type: "cancelled";    pathId: string; data: PathData }
  | { type: "resumed";      resumedPathId: string; fromSubPathId: string; snapshot: PathSnapshot };
```

`subscribe` returns an **unsubscribe function**:

```typescript
const unsubscribe = engine.subscribe((event) => { ... });
// later:
unsubscribe();
```

### Event reference

| Event | When fired | Key payload |
|---|---|---|
| `stateChanged` | After every navigation or `setData` call (possibly multiple times per operation — see `isNavigating`) | `snapshot` |
| `completed` | When the path finishes naturally (past the last step) | `pathId`, `data` (final state) |
| `cancelled` | When the top-level path is cancelled | `pathId`, `data` |
| `resumed` | When a sub-path finishes and the parent is restored | `resumedPathId`, `fromSubPathId`, `snapshot` |

> Cancelling a **sub-path** emits neither `cancelled` nor `resumed` — it silently restores the parent and emits `stateChanged`.

---

## 9. Sub-Paths

A sub-path is a full path pushed on top of an existing one. The parent is paused until the sub-path completes or is cancelled.

### Launching a sub-path

```typescript
engine.startSubPath(subPathDefinition, { subjectName: "", subjectTeacher: "" });
```

This requires an active path. The parent's current step is preserved on an internal stack.

### Receiving the result

Define `onSubPathComplete` on the parent step that launches the sub-path. It is called when the sub-path **completes** (not when cancelled):

```typescript
{
  id: "subjects-list",
  onSubPathComplete: (subPathId, subData, ctx) => {
    if (subPathId !== "subject-subpath") return;

    return {
      subjects: [
        ...ctx.data.subjects,
        { name: subData.subjectName, teacher: subData.subjectTeacher }
      ]
    };
  }
}
```

### Stack behaviour

```
engine.start(mainPath)              stack: []          active: main
engine.startSubPath(subPath)        stack: [main]      active: sub
  engine.next()  // sub completes
  onSubPathComplete fires on parent step
                                    stack: []          active: main (restored)
```

Nesting is unlimited. `nestingLevel` in the snapshot tells you how deep you are.

---

## 10. Angular Adapter

### Setup

Provide `PathFacade` at the **component level** so each component gets its own isolated engine instance, and Angular handles cleanup automatically.

```typescript
@Component({
  providers: [PathFacade]
})
export class MyComponent {
  protected readonly facade = inject(PathFacade);
}
```

### Reactive state with signals (recommended)

```typescript
public readonly snapshot = toSignal(this.facade.state$, { initialValue: null });

public readonly isActive    = computed(() => this.snapshot() !== null);
public readonly currentStep = computed(() => this.snapshot()?.stepId ?? null);
```

### Reactive state with the async pipe

```html
<ng-container *ngIf="facade.state$ | async as s">
  <h2>{{ s.stepTitle ?? s.stepId }}</h2>
  <progress [value]="s.progress"></progress>
</ng-container>
```

### Listening to events

```typescript
public constructor() {
  this.facade.events$.pipe(takeUntilDestroyed()).subscribe((event) => {
    if (event.type === "completed") {
      this.router.navigate(["/done"], { state: { data: event.data } });
    }
  });
}
```

### PathFacade API

| Member | Description |
|---|---|
| `state$` | `Observable<PathSnapshot \| null>` — backed by a `BehaviorSubject` |
| `events$` | `Observable<PathEvent>` — all engine events |
| `start(def, data?)` | Start or restart a path |
| `startSubPath(def, data?)` | Push a sub-path |
| `next()` | Advance one step |
| `previous()` | Go back one step |
| `cancel()` | Cancel the active path or sub-path |
| `setData(key, value)` | Update a single data value |
| `goToStep(stepId)` | Jump directly to a step by ID |
| `snapshot()` | Synchronous read of the current snapshot |

### Linking steps to UI

```html
<section *ngIf="snapshot() as s; else emptyState">

  <div *ngIf="s.pathId === 'my-path' && s.stepId === 'details'">
    <!-- step content -->
  </div>

  <div *ngIf="s.pathId === 'my-path' && s.stepId === 'review'">
    <!-- step content -->
  </div>

</section>
<ng-template #emptyState>No path running.</ng-template>
```

Both `pathId` and `stepId` are checked to unambiguously distinguish sub-path steps from parent steps with the same ID.

---

## 11. React Adapter

### Option A — `usePath` (component-scoped)

```tsx
import { usePath } from "@daltonr/pathwrite-react";

function CoursePathHost() {
  const { snapshot, start, next, previous, cancel, setData } = usePath({
    onEvent(event) {
      if (event.type === "completed") console.log("Done!", event.data);
    }
  });

  if (!snapshot) {
    return <button onClick={() => start(myPath, { name: "" })}>Start</button>;
  }

  return (
    <div>
      <h2>{snapshot.stepTitle ?? snapshot.stepId}</h2>
      <p>Step {snapshot.stepIndex + 1} of {snapshot.stepCount}</p>

      {snapshot.stepId === "details" && (
        <input
          value={String(snapshot.data.name ?? "")}
          onChange={(e) => setData("name", e.target.value)}
        />
      )}

      <button onClick={previous} disabled={snapshot.isNavigating || !snapshot.canMovePrevious}>Back</button>
      <button onClick={next}     disabled={snapshot.isNavigating || !snapshot.canMoveNext}>
        {snapshot.isLastStep ? "Finish" : "Next"}
      </button>
    </div>
  );
}
```

### Option B — `PathProvider` + `usePathContext` (shared across components)

```tsx
import { PathProvider, usePathContext } from "@daltonr/pathwrite-react";

function App() {
  return (
    <PathProvider>
      <StepContent />
      <NavBar />
    </PathProvider>
  );
}

function StepContent() {
  const { snapshot } = usePathContext();
  if (!snapshot) return <p>No path running.</p>;
  return <h2>{snapshot.stepTitle ?? snapshot.stepId}</h2>;
}

function NavBar() {
  const { snapshot, next, previous, start } = usePathContext();
  if (!snapshot) return <button onClick={() => start(myPath)}>Start</button>;
  return (
    <>
      <button onClick={previous} disabled={snapshot.isNavigating || !snapshot.canMovePrevious}>Back</button>
      <button onClick={next}     disabled={snapshot.isNavigating || !snapshot.canMoveNext}>Next</button>
    </>
  );
}
```

`usePathContext()` throws if called outside a `<PathProvider>`.

> **Tip:** `<PathShell>` (see [§13](#13-default-ui-shell)) also provides context automatically — step children rendered inside `<PathShell>` can call `usePathContext()` to access the same engine instance without a separate `<PathProvider>`.

### `usePath` return value

| Property | Type | Description |
|---|---|---|
| `snapshot` | `PathSnapshot \| null` | Triggers a React re-render on every change |
| `start` | `(def, data?) => void` | Start or restart a path |
| `startSubPath` | `(def, data?) => void` | Push a sub-path |
| `next` | `() => void` | Advance one step |
| `previous` | `() => void` | Go back one step |
| `cancel` | `() => void` | Cancel the active path or sub-path |
| `goToStep` | `(stepId) => void` | Jump to a step by ID |
| `setData` | `(key, value) => void` | Update a single data value |

All action functions are **referentially stable** — safe in dependency arrays and as props.

---

## 12. Vue Adapter

### Setup

Call the `usePath` composable inside `<script setup>` or any Vue 3 `setup()` function. Each call creates an isolated engine instance. Cleanup is automatic via `onScopeDispose`.

```vue
<script setup lang="ts">
import { usePath } from "@daltonr/pathwrite-vue";
import { computed } from "vue";

const { snapshot, start, next, previous, cancel, setData } = usePath({
  onEvent(event) {
    if (event.type === "completed") console.log("Done!", event.data);
  }
});

const currentStep = computed(() => snapshot.value?.stepId ?? null);
</script>
```

### Reactive state in templates

`snapshot` is a `DeepReadonly<Ref<PathSnapshot | null>>`. Vue automatically unwraps refs in templates:

```html
<template>
  <div v-if="snapshot">
    <h2>{{ snapshot.stepTitle ?? snapshot.stepId }}</h2>
    <p>Step {{ snapshot.stepIndex + 1 }} of {{ snapshot.stepCount }}</p>

    <div v-if="snapshot.stepId === 'details'">
      <input :value="snapshot.data.name" @input="setData('name', ($event.target as HTMLInputElement).value)" />
    </div>

    <button @click="previous" :disabled="snapshot.isNavigating || !snapshot.canMovePrevious">Back</button>
    <button @click="next"     :disabled="snapshot.isNavigating || !snapshot.canMoveNext">
      {{ snapshot.isLastStep ? "Finish" : "Next" }}
    </button>
    <button @click="cancel">Cancel</button>
  </div>
  <div v-else>
    <button @click="start(myPath, { name: '' })">Start Path</button>
  </div>
</template>
```

### Computed values

Derive computed properties from the snapshot ref as needed:

```typescript
const isActive    = computed(() => snapshot.value !== null);
const subjects    = computed(() => (snapshot.value?.data.subjects as any[]) ?? []);
const progress    = computed(() => snapshot.value?.progress ?? 0);
```

### `usePath` return value

| Property | Type | Description |
|---|---|---|
| `snapshot` | `DeepReadonly<Ref<PathSnapshot \| null>>` | Reactive ref. Triggers re-renders on change. |
| `start` | `(def, data?) => Promise<void>` | Start or restart a path |
| `startSubPath` | `(def, data?) => Promise<void>` | Push a sub-path |
| `next` | `() => Promise<void>` | Advance one step |
| `previous` | `() => Promise<void>` | Go back one step |
| `cancel` | `() => Promise<void>` | Cancel the active path or sub-path |
| `goToStep` | `(stepId) => Promise<void>` | Jump to a step by ID |
| `setData` | `(key, value) => Promise<void>` | Update a single data value |

### Design notes

- **`shallowRef`** — the engine produces a new snapshot object on every change, so shallow reactivity is sufficient and avoids deep-watching overhead.
- **`readonly`** — the returned ref is wrapped with `readonly()` to prevent accidental external mutation of the snapshot.
- **`onScopeDispose`** — the composable unsubscribes from the engine when the component's effect scope is disposed (on unmount). No manual cleanup needed.
- **No RxJS, no `useSyncExternalStore`** — the adapter is pure Vue 3 reactivity.

### `usePathContext` — accessing the engine from child components

When using `<PathShell>` (see [§13](#13-default-ui-shell)), step child components can call `usePathContext()` to access the same engine instance. This is powered by Vue's `provide` / `inject`:

```vue
<script setup>
import { usePathContext } from "@daltonr/pathwrite-vue";

const { snapshot, setData, next } = usePathContext();
</script>
```

`usePathContext()` throws if called outside a `<PathShell>`.

---

## 13. Default UI Shell

Every adapter ships an optional **shell component** that renders a complete wizard UI — progress indicator, step content area, and navigation buttons — out of the box. You define only the per-step content; the shell handles the chrome.

The shell is a convenience layer on top of the headless API. It uses the same `usePath` / `PathFacade` internally, so you can start with the shell and switch to fully custom UI at any time.

### Context sharing

All shell components automatically provide their engine instance to child components:

- **React**: `PathShell` wraps its children in a `PathContext.Provider`. Step children can call `usePathContext()`.
- **Vue**: `PathShell` calls `provide()` internally. Step children can call `usePathContext()`.
- **Angular**: `PathShellComponent` provides `PathFacade` at the component level. Step children can `inject(PathFacade)`.

This means step content components can read `snapshot.data`, call `setData()`, or trigger navigation without prop drilling.

### Architecture

```
┌─────────────────────────────────────┐
│  ● Step 1  ─── ○ Step 2  ─── ○ Step 3  │  ← progress header
│  ████████░░░░░░░░░░░░░░░░░░░░░░░░░░│  ← progress bar
├─────────────────────────────────────┤
│                                     │
│  [your step content goes here]      │  ← body (from <PathStep> / pwStep)
│                                     │
├─────────────────────────────────────┤
│  ‹ Back          Cancel    Next ›   │  ← navigation footer
└─────────────────────────────────────┘
```

### React — `<PathShell>` + `<PathStep>`

```tsx
import { PathShell, PathStep } from "@daltonr/pathwrite-react";

function CoursePath() {
  return (
    <PathShell
      path={coursePath}
      initialData={{ name: "" }}
      onComplete={(data) => console.log("Done!", data)}
    >
      <PathStep id="details"><DetailsForm /></PathStep>
      <PathStep id="review"><ReviewPanel /></PathStep>
    </PathShell>
  );
}
```

#### `PathShellProps`

| Prop | Type | Default | Description |
|---|---|---|---|
| `path` | `PathDefinition` | *required* | The path definition to drive. |
| `initialData` | `PathData` | `{}` | Initial data passed to `engine.start()`. |
| `autoStart` | `boolean` | `true` | If true, the path starts on mount. |
| `onComplete` | `(data) => void` | — | Called when the path completes. |
| `onCancel` | `(data) => void` | — | Called when the path is cancelled. |
| `onEvent` | `(event) => void` | — | Called for every engine event. |
| `backLabel` | `string` | `"Back"` | Back button label. |
| `nextLabel` | `string` | `"Next"` | Next button label. |
| `finishLabel` | `string` | `"Finish"` | Finish button label (last step). |
| `cancelLabel` | `string` | `"Cancel"` | Cancel button label. |
| `hideCancel` | `boolean` | `false` | Hide the cancel button. |
| `hideProgress` | `boolean` | `false` | Hide the progress indicator. |
| `className` | `string` | — | Extra CSS class on the root element. |
| `renderHeader` | `(snapshot) => ReactNode` | — | Replace the default progress header. |
| `renderFooter` | `(snapshot, actions) => ReactNode` | — | Replace the default navigation footer. |

#### Replacing the header or footer

Use `renderHeader` or `renderFooter` to override just one section while keeping the rest:

```tsx
<PathShell
  path={myPath}
  renderFooter={(snap, { next, previous }) => (
    <div className="my-nav">
      <button onClick={previous}>← Back</button>
      <span>{snap.stepIndex + 1} / {snap.stepCount}</span>
      <button onClick={next}>{snap.isLastStep ? "Done" : "→ Next"}</button>
    </div>
  )}
>
  <PathStep id="a">...</PathStep>
</PathShell>
```

### Vue — `<PathShell>` + `<PathStep>`

```vue
<script setup>
import { PathShell, PathStep } from "@daltonr/pathwrite-vue";
import { coursePath } from "./paths";
</script>

<template>
  <PathShell :path="coursePath" :initial-data="{ name: '' }" @complete="onDone">
    <PathStep id="details"><DetailsForm /></PathStep>
    <PathStep id="review"><ReviewPanel /></PathStep>
  </PathShell>
</template>
```

#### Vue props

| Prop | Type | Default | Description |
|---|---|---|---|
| `path` | `PathDefinition` | *required* | The path definition. |
| `initialData` | `PathData` | `{}` | Initial data. |
| `autoStart` | `boolean` | `true` | Auto-start on mount. |
| `backLabel` | `string` | `"Back"` | Back button label. |
| `nextLabel` | `string` | `"Next"` | Next button label. |
| `finishLabel` | `string` | `"Finish"` | Finish label (last step). |
| `cancelLabel` | `string` | `"Cancel"` | Cancel button label. |
| `hideCancel` | `boolean` | `false` | Hide the cancel button. |
| `hideProgress` | `boolean` | `false` | Hide the progress indicator. |

#### Vue events

| Event | Payload | Description |
|---|---|---|
| `@complete` | `PathData` | Path completed. |
| `@cancel` | `PathData` | Path cancelled. |
| `@event` | `PathEvent` | Every engine event. |

#### Vue slots

The Vue shell also supports named `header` and `footer` scoped slots for customisation:

```vue
<PathShell :path="myPath">
  <template #header="{ snapshot }">
    <MyCustomProgress :steps="snapshot.steps" />
  </template>

  <PathStep id="a"><StepA /></PathStep>
  <PathStep id="b"><StepB /></PathStep>

  <template #footer="{ snapshot, actions }">
    <button @click="actions.previous">Back</button>
    <button @click="actions.next">{{ snapshot.isLastStep ? 'Done' : 'Next' }}</button>
  </template>
</PathShell>
```

### Angular — `<pw-shell>` + `pwStep`

The Angular shell is in a separate entry point to avoid pulling the Angular compiler into headless-only usage:

```typescript
import { PathShellComponent, PathStepDirective } from "@daltonr/pathwrite-angular/shell";

@Component({
  imports: [PathShellComponent, PathStepDirective],
  template: `
    <pw-shell [path]="myPath" [initialData]="{ name: '' }" (completed)="onDone($event)">
      <ng-template pwStep="details"><app-details-form /></ng-template>
      <ng-template pwStep="review"><app-review-panel /></ng-template>
    </pw-shell>
  `
})
export class MyComponent { ... }
```

#### Angular inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `path` | `PathDefinition` | *required* | The path definition. |
| `initialData` | `PathData` | `{}` | Initial data. |
| `autoStart` | `boolean` | `true` | Auto-start on init. |
| `backLabel` | `string` | `"Back"` | Back button label. |
| `nextLabel` | `string` | `"Next"` | Next button label. |
| `finishLabel` | `string` | `"Finish"` | Finish label (last step). |
| `cancelLabel` | `string` | `"Cancel"` | Cancel button label. |
| `hideCancel` | `boolean` | `false` | Hide the cancel button. |
| `hideProgress` | `boolean` | `false` | Hide the progress indicator. |

#### Angular outputs

| Output | Payload | Description |
|---|---|---|
| `(completed)` | `PathData` | Path completed. |
| `(cancelled)` | `PathData` | Path cancelled. |
| `(pathEvent)` | `PathEvent` | Every engine event. |

### Styling with CSS custom properties

Import the optional stylesheet `packages/shell.css` for sensible defaults. Every visual value is a CSS custom property, so you can theme without overriding selectors:

```css
@import "@daltonr/pathwrite-shell.css";

:root {
  --pw-color-primary: #8b5cf6;       /* purple instead of blue */
  --pw-shell-radius: 12px;           /* rounder corners */
  --pw-dot-size: 28px;               /* smaller step dots */
}
```

#### Full list of CSS custom properties

| Variable | Default | Description |
|---|---|---|
| `--pw-shell-max-width` | `720px` | Max width of the shell. |
| `--pw-shell-padding` | `24px` | Inner padding. |
| `--pw-shell-gap` | `20px` | Gap between header, body, footer. |
| `--pw-shell-radius` | `10px` | Border radius of panels. |
| `--pw-color-bg` | `#ffffff` | Background colour. |
| `--pw-color-border` | `#dbe4f0` | Border colour. |
| `--pw-color-text` | `#1f2937` | Text colour. |
| `--pw-color-muted` | `#5b677a` | Muted / secondary text. |
| `--pw-color-primary` | `#2563eb` | Primary accent colour. |
| `--pw-color-primary-light` | `rgba(37,99,235,0.12)` | Light primary for hover states. |
| `--pw-color-btn-bg` | `#f8fbff` | Button background. |
| `--pw-color-btn-border` | `#c2d0e5` | Button border. |
| `--pw-dot-size` | `32px` | Step indicator dot size. |
| `--pw-dot-font-size` | `13px` | Step indicator dot font size. |
| `--pw-track-height` | `4px` | Progress track height. |
| `--pw-btn-padding` | `8px 16px` | Button padding. |
| `--pw-btn-radius` | `6px` | Button border radius. |

### CSS classes reference

All shell components use BEM-style `pw-shell__*` classes:

| Class | Element |
|---|---|
| `.pw-shell` | Root container. |
| `.pw-shell__empty` | Empty state (no active path). |
| `.pw-shell__start-btn` | Start button (when `autoStart` is false). |
| `.pw-shell__header` | Progress indicator wrapper. |
| `.pw-shell__steps` | Step dot container. |
| `.pw-shell__step` | Individual step wrapper. |
| `.pw-shell__step--current` | Current step modifier. |
| `.pw-shell__step--completed` | Completed step modifier. |
| `.pw-shell__step--upcoming` | Upcoming step modifier. |
| `.pw-shell__step-dot` | Step dot circle. |
| `.pw-shell__step-label` | Step label text. |
| `.pw-shell__track` | Progress bar track. |
| `.pw-shell__track-fill` | Progress bar fill. |
| `.pw-shell__body` | Step content area. |
| `.pw-shell__footer` | Navigation button bar. |
| `.pw-shell__footer-left` | Left side of footer (Back). |
| `.pw-shell__footer-right` | Right side of footer (Cancel, Next). |
| `.pw-shell__btn` | Base button class. |
| `.pw-shell__btn--back` | Back button. |
| `.pw-shell__btn--next` | Next / Finish button. |
| `.pw-shell__btn--cancel` | Cancel button. |

### When to use the shell vs. going headless

| Scenario | Use |
|---|---|
| Quick prototype, internal tool, standard wizard layout | Default shell — define steps and go. |
| Custom design system, non-linear layout, complex animations | Headless API — build your own UI from the snapshot. |
| Need to override just the header or footer | Shell with `renderHeader` / `renderFooter` (React) or scoped slots (Vue). |

The shell and the headless API are not mutually exclusive. You can start with `<PathShell>` and migrate individual sections (or the entire component) to custom markup whenever you need more control.

---

## 14. Using the Core Engine Directly

```typescript
import { PathEngine, PathDefinition } from "@daltonr/pathwrite-core";

const engine = new PathEngine();

const path: PathDefinition = {
  id: "setup",
  steps: [
    { id: "welcome" },
    { id: "configure", canMoveNext: (ctx) => !!ctx.data.apiKey },
    { id: "done" }
  ]
};

const unsubscribe = engine.subscribe((event) => {
  if (event.type === "stateChanged") {
    render(event.snapshot);
  }
  if (event.type === "completed") {
    console.log("Path done with data:", event.data);
    unsubscribe();
  }
});

await engine.start(path, { apiKey: "" });
```

### Full PathEngine API

| Method | Returns | Description |
|---|---|---|
| `start(def, data?)` | `Promise<void>` | Start or restart. Throws if definition has no steps. |
| `startSubPath(def, data?)` | `Promise<void>` | Push sub-path. Throws if no path is active. |
| `next()` | `Promise<void>` | Advance. Completes path past the last step. |
| `previous()` | `Promise<void>` | Go back. Cancels path before the first step. |
| `cancel()` | `Promise<void>` | Cancel. Pops sub-path silently; completes top-level with `cancelled` event. |
| `setData(key, value)` | `Promise<void>` | Update one data value. Emits `stateChanged`. |
| `goToStep(stepId)` | `Promise<void>` | Jump to step by ID. Calls `onLeave`/`onEnter`; bypasses guards and `shouldSkip`. |
| `snapshot()` | `PathSnapshot \| null` | Synchronous snapshot read. |
| `subscribe(listener)` | `() => void` | Subscribe to events. Returns the unsubscribe function. |

All navigation methods return a `Promise`. If `isNavigating` is `true` when a navigation method is called, it returns immediately (concurrent navigation is debounced automatically).

---

## 15. TypeScript Generics

All core types accept an optional generic `TData` for full type safety in hooks and guards:

```typescript
interface CourseData extends PathData {
  courseName: string;
  subjects: Array<{ name: string; teacher: string }>;
}

const path: PathDefinition<CourseData> = {
  id: "course",
  steps: [
    {
      id: "details",
      canMoveNext: (ctx) => ctx.data.courseName.length > 0,
      onLeave: (ctx) => ({
        courseName: ctx.data.courseName.trim()
      })
    }
  ]
};
```

Without the generic, `TData` defaults to `PathData` (`Record<string, unknown>`), which still works but requires manual type assertions for individual values.

---

## 16. Backend Lifecycle Patterns

`@daltonr/pathwrite-core` is not limited to UI wizards. Because the engine is headless, it can model any ordered state transition — document lifecycles, approval workflows, onboarding pipelines — with no UI at all.

### Mapping concepts

| Path concept | Lifecycle equivalent |
|---|---|
| Steps | States (Draft, Review, Approved, Published) |
| `canMoveNext` | Business rules ("document must have a title and body") |
| `shouldSkip` | Conditional routing (memos skip review) |
| Sub-paths | Side processes (multi-step review with assign → feedback → decision) |
| `goToStep` | Non-linear transitions (rejection sends back to Draft) |
| `onEnter` / `onLeave` | State entry/exit actions (record timestamps, log audit entries) |
| `meta` | Per-state metadata (allowed roles, SLA durations) |
| `subscribe` | Audit logging, notifications, external integrations |

### Example — document lifecycle

```typescript
import { PathData, PathDefinition, PathEngine } from "@daltonr/pathwrite-core";

interface DocData extends PathData {
  title: string;
  body: string;
  docType: "standard" | "memo";
  reviewOutcome: "pending" | "approved" | "rejected";
  auditLog: string[];
}

const lifecycle: PathDefinition<DocData> = {
  id: "doc-lifecycle",
  steps: [
    {
      id: "draft",
      meta: { allowedRoles: ["author"] },
      canMoveNext: (ctx) => ctx.data.title.length > 0 && ctx.data.body.length > 0,
      onLeave: (ctx) => ({
        auditLog: [...ctx.data.auditLog, `Submitted: "${ctx.data.title}"`],
      }),
    },
    {
      id: "review",
      meta: { allowedRoles: ["reviewer"], slaHours: 48 },
      shouldSkip: (ctx) => ctx.data.docType === "memo",
      canMoveNext: (ctx) => ctx.data.reviewOutcome === "approved",
      onEnter: (ctx) => ({
        auditLog: [...ctx.data.auditLog, "Entered review"],
      }),
    },
    {
      id: "approved",
      meta: { allowedRoles: ["approver"] },
      onEnter: (ctx) => ({
        auditLog: [...ctx.data.auditLog, "Approved"],
      }),
    },
    {
      id: "published",
      meta: { allowedRoles: ["publisher"] },
      onEnter: (ctx) => ({
        auditLog: [...ctx.data.auditLog, `Published at ${new Date().toISOString()}`],
      }),
    },
  ],
};
```

### Driving the lifecycle

```typescript
const engine = new PathEngine();

// Audit trail via subscribe — no UI needed
engine.subscribe((event) => {
  if (event.type === "completed") {
    console.log("Document published:", event.data);
  }
});

// Start in Draft
await engine.start(lifecycle, {
  title: "Q3 Report",
  body: "Revenue up 15%",
  docType: "standard",
  reviewOutcome: "pending",
  auditLog: [],
});

// Simulate external approval
await engine.setData("reviewOutcome", "approved");

// Advance through the lifecycle
await engine.next(); // draft → review
await engine.next(); // review → approved
await engine.next(); // approved → published
await engine.next(); // published → complete
```

### Modelling rejection with `goToStep`

```typescript
// Reviewer rejects — jump back to Draft for revision
await engine.goToStep("draft");

// Author revises, then re-submits
await engine.setData("body", "Revised content v2");
await engine.setData("reviewOutcome", "pending");
await engine.next(); // draft → review
```

### Review sub-path

A review can itself be a multi-step process. Push it as a sub-path from the `review` step:

```typescript
const reviewProcess: PathDefinition = {
  id: "review-process",
  steps: [
    { id: "assign-reviewer", onEnter: () => ({ assignedReviewer: "alice" }) },
    { id: "collect-feedback" },
    { id: "record-decision" },
  ],
};

// On the review step:
{
  id: "review",
  onSubPathComplete: (subPathId, subData, ctx) => ({
    reviewOutcome: subData.decision,
    auditLog: [...ctx.data.auditLog, `Review: ${subData.decision}`],
  }),
}
```

The `demo-lifecycle` app demonstrates all three patterns (happy path, rejection, and auto-skip) in a runnable Node script:

```bash
npm run demo:lifecycle
```

---

## 17. Testing

```bash
npm test            # run all tests once
npm run test:watch  # run in watch mode
```

### Testing a path definition

```typescript
import { PathEngine } from "@daltonr/pathwrite-core";

it("skips payment step for free accounts", async () => {
  const engine = new PathEngine();
  await engine.start(myPath, { isFreeAccount: true });
  await engine.next();
  expect(engine.snapshot()?.stepId).toBe("confirmation");
});
```

### Testing with the React adapter

```tsx
import { renderHook, act } from "@testing-library/react";
import { usePath } from "@daltonr/pathwrite-react";

it("advances to the next step", async () => {
  const { result } = renderHook(() => usePath());
  await act(() => result.current.start(myPath));
  await act(() => result.current.next());
  expect(result.current.snapshot?.stepId).toBe("step-two");
});
```

### Testing with the Angular adapter

```typescript
it("emits completed after the last step", async () => {
  TestBed.configureTestingModule({ providers: [PathFacade] });
  const facade = TestBed.inject(PathFacade);
  const events: PathEvent[] = [];
  facade.events$.subscribe((e) => events.push(e));

  await facade.start(myPath);
  await facade.next();
  await facade.next();

  expect(events.some((e) => e.type === "completed")).toBe(true);
});
```

### Testing with the Vue adapter

```typescript
import { effectScope } from "vue";
import { usePath } from "@daltonr/pathwrite-vue";

it("advances to the next step", async () => {
  const scope = effectScope();
  const { snapshot, start, next } = scope.run(() => usePath())!;

  await start(myPath);
  await next();
  expect(snapshot.value?.stepId).toBe("step-two");

  scope.stop();
});
```

The Vue adapter tests use `effectScope()` to provide the disposal context that `onScopeDispose` requires. Call `scope.stop()` at the end of each test to simulate component unmount.

### Testing lifecycle patterns

The same `PathEngine` can test backend workflows. No UI framework or adapter is needed:

```typescript
import { PathEngine } from "@daltonr/pathwrite-core";

it("skips review for memos", async () => {
  const engine = new PathEngine();
  await engine.start(docLifecycle, {
    title: "Memo", body: "Lunch at noon", docType: "memo",
    reviewOutcome: "pending", auditLog: [],
  });
  await engine.next(); // draft → approved (review skipped)
  expect(engine.snapshot()?.stepId).toBe("approved");
});

it("blocks leaving draft when required fields are missing", async () => {
  const engine = new PathEngine();
  await engine.start(docLifecycle, {
    title: "", body: "", docType: "standard",
    reviewOutcome: "pending", auditLog: [],
  });
  await engine.next(); // blocked by guard
  expect(engine.snapshot()?.stepId).toBe("draft");
});
```

### Testing the React shell

```tsx
import { createElement } from "react";
import { render, screen, act, cleanup } from "@testing-library/react";
import { PathShell, PathStep } from "@daltonr/pathwrite-react";

afterEach(() => cleanup());

it("renders step content and navigates", async () => {
  const path = { id: "test", steps: [{ id: "a", title: "A" }, { id: "b", title: "B" }] };
  await act(async () =>
    render(createElement(PathShell, { path }, [
      createElement(PathStep, { id: "a", key: "a" }, createElement("div", null, "Content A")),
      createElement(PathStep, { id: "b", key: "b" }, createElement("div", null, "Content B")),
    ]))
  );
  expect(screen.getByText("Content A")).toBeTruthy();
  await act(async () => screen.getByText("Next").click());
  expect(screen.getByText("Content B")).toBeTruthy();
});
```

### Testing the Vue shell

```typescript
import { defineComponent, h, nextTick } from "vue";
import { mount, flushPromises } from "@vue/test-utils";
import { PathShell, PathStep } from "@daltonr/pathwrite-vue";

it("renders step content and navigates", async () => {
  const path = { id: "test", steps: [{ id: "a", title: "A" }, { id: "b", title: "B" }] };
  const Host = defineComponent({
    setup: () => () =>
      h(PathShell, { path }, {
        default: () => [
          h(PathStep, { id: "a" }, { default: () => h("div", "Content A") }),
          h(PathStep, { id: "b" }, { default: () => h("div", "Content B") }),
        ]
      })
  });
  const wrapper = mount(Host, { attachTo: document.body });
  await flushPromises(); await nextTick(); await flushPromises(); await nextTick();
  expect(wrapper.text()).toContain("Content A");
  await wrapper.find(".pw-shell__btn--next").trigger("click");
  await flushPromises(); await nextTick(); await flushPromises(); await nextTick();
  expect(wrapper.text()).toContain("Content B");
  wrapper.unmount();
});
```

---

## 18. Design Decisions

### Headless first, shells optional
Pathwrite owns no HTML or CSS at its core. The snapshot gives you everything you need to render a path; how you render it is entirely up to you. The engine works equally well driving a UI wizard, a backend document lifecycle, or any ordered state transition with constraints. The optional shell components are a convenience layer — they use the same public API you would use to build custom UI.

### Steps are states
A "step" is just an ordered state with optional guards and hooks. This abstraction maps naturally to UI wizard steps, but also to lifecycle states (Draft → Review → Approved → Published), pipeline stages, or onboarding phases. `goToStep` enables non-linear transitions (e.g. rejection), and `shouldSkip` handles conditional routing.

### Data is the source of truth
All path data lives in `data`. There is no separate "form model" — `data` is the form model. Guards and hooks read from `data` and return patches to update it. Data flow is unidirectional and auditable.

### Hooks return patches, not mutations
`ctx.data` is a read-only copy. Hooks return a `Partial<TData>` patch; the engine applies it. This prevents accidental mutations and makes hook behaviour easy to test in isolation.

### Async-first API
All navigation methods return `Promise<void>` even when synchronous. Concurrent calls while `isNavigating` is `true` are silently dropped.

### Sub-paths are full paths
There is no special "sub-path" type. `startSubPath` pushes the current path onto a stack and starts the provided definition as the new active path. The stack can be arbitrarily deep.

### No RxJS in core
`@daltonr/pathwrite-core` has zero dependencies. The Angular adapter introduces RxJS because Angular apps already depend on it. The React adapter uses only React's built-in `useSyncExternalStore`. The Vue adapter uses only Vue's built-in `shallowRef` and `onScopeDispose`. Each adapter is a thin translation layer from `subscribe` + `snapshot()` into the framework's native reactivity model.

### Shell as an optional layer, not a core feature
The default UI shell components (`<PathShell>` / `<pw-shell>`) are an optional convenience layer exported alongside the headless adapter API. They use the exact same `usePath` / `PathFacade` that you would use to build custom UI. This ensures there is no hidden API — everything the shell does, you can do yourself. The Angular shell is in a separate entry point (`@daltonr/pathwrite-angular/shell`) to avoid pulling the Angular compiler into headless-only imports.

### Unstyled by default, themeable by convention
Shell components render structural HTML with BEM-style `pw-shell__*` CSS classes but include no embedded styles. The optional `shell.css` stylesheet provides sensible defaults using CSS custom properties (`--pw-*`). This means the shell works in any design system — override a few variables to re-theme, or ignore the stylesheet entirely and write your own CSS targeting the same classes.

