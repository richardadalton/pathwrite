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
13. [Using the Core Engine Directly](#13-using-the-core-engine-directly)
14. [TypeScript Generics](#14-typescript-generics)
15. [Testing](#15-testing)
16. [Design Decisions](#16-design-decisions)

---

## 1. What is Pathwrite?

Pathwrite is a **headless path engine**. It manages step navigation, data collection, navigation guards, and sub-path stacking — with no dependency on any UI framework.

UI frameworks are supported through thin adapters:

| Package | For |
|---|---|
| `@pathwrite/core` | Framework-agnostic engine (zero deps) |
| `@pathwrite/angular-adapter` | Angular — exposes state as RxJS observables |
| `@pathwrite/react-adapter` | React — exposes state via `useSyncExternalStore` |
| `@pathwrite/vue-adapter` | Vue 3 — exposes state as a reactive `shallowRef` |

**Headless** means Pathwrite owns no HTML. You write all the markup; Pathwrite tells you which step you're on, whether navigation is allowed, and what data the user has entered so far.

---

## 2. Repository Layout

```
pathwrite/
├── packages/
│   ├── core/                   # @pathwrite/core
│   ├── angular-adapter/        # @pathwrite/angular-adapter
│   ├── react-adapter/          # @pathwrite/react-adapter
│   └── vue-adapter/            # @pathwrite/vue-adapter
├── apps/
│   ├── demo-angular-course/    # Angular demo (multi-step course path)
│   ├── demo-angular/           # Angular demo (simple)
│   └── demo-console/           # Console demo
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
import { PathDefinition } from "@pathwrite/core";

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

When a guard returns `false`, the engine still emits two `stateChanged` events (one with `isNavigating: true` at the start, one with `isNavigating: false` at the end) so the UI can show and clear a loading state even on a synchronous block.

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
  pathId:       string;               // ID of the active path
  stepId:       string;               // ID of the current step
  stepTitle?:   string;               // step.title, if defined
  stepMeta?:    Record<string, unknown>; // step.meta, if defined
  stepIndex:    number;               // 0-based index of the current step
  stepCount:    number;               // total number of steps
  progress:     number;               // 0.0 → 1.0 (stepIndex / (stepCount - 1))
  steps:        StepSummary[];        // summary of every step with its status
  isFirstStep:  boolean;
  isLastStep:   boolean;              // false if a sub-path is active
  nestingLevel: number;               // 0 for top-level, +1 per nested sub-path
  isNavigating: boolean;              // true while an async hook/guard is running
  data:         TData;                // copy of current path data
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
import { usePath } from "@pathwrite/react-adapter";

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

      <button onClick={previous} disabled={snapshot.isNavigating}>Back</button>
      <button onClick={next}     disabled={snapshot.isNavigating}>
        {snapshot.isLastStep ? "Finish" : "Next"}
      </button>
    </div>
  );
}
```

### Option B — `PathProvider` + `usePathContext` (shared across components)

```tsx
import { PathProvider, usePathContext } from "@pathwrite/react-adapter";

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
      <button onClick={previous} disabled={snapshot.isNavigating}>Back</button>
      <button onClick={next}     disabled={snapshot.isNavigating}>Next</button>
    </>
  );
}
```

`usePathContext()` throws if called outside a `<PathProvider>`.

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
import { usePath } from "@pathwrite/vue-adapter";
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

    <button @click="previous" :disabled="snapshot.isNavigating">Back</button>
    <button @click="next"     :disabled="snapshot.isNavigating">
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

---

## 13. Using the Core Engine Directly

```typescript
import { PathEngine, PathDefinition } from "@pathwrite/core";

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

## 14. TypeScript Generics

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

## 15. Testing

```bash
npm test            # run all tests once
npm run test:watch  # run in watch mode
```

### Testing a path definition

```typescript
import { PathEngine } from "@pathwrite/core";

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
import { usePath } from "@pathwrite/react-adapter";

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
import { usePath } from "@pathwrite/vue-adapter";

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

---

## 16. Design Decisions

### Headless by design
Pathwrite owns no HTML or CSS. The snapshot gives you everything you need to render a path; how you render it is entirely up to you.

### Data is the source of truth
All path data lives in `data`. There is no separate "form model" — `data` is the form model. Guards and hooks read from `data` and return patches to update it. Data flow is unidirectional and auditable.

### Hooks return patches, not mutations
`ctx.data` is a read-only copy. Hooks return a `Partial<TData>` patch; the engine applies it. This prevents accidental mutations and makes hook behaviour easy to test in isolation.

### Async-first API
All navigation methods return `Promise<void>` even when synchronous. Concurrent calls while `isNavigating` is `true` are silently dropped.

### Sub-paths are full paths
There is no special "sub-path" type. `startSubPath` pushes the current path onto a stack and starts the provided definition as the new active path. The stack can be arbitrarily deep.

### No RxJS in core
`@pathwrite/core` has zero dependencies. The Angular adapter introduces RxJS because Angular apps already depend on it. The React adapter uses only React's built-in `useSyncExternalStore`. The Vue adapter uses only Vue's built-in `shallowRef` and `onScopeDispose`. Each adapter is a thin translation layer from `subscribe` + `snapshot()` into the framework's native reactivity model.

