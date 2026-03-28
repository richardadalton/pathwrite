# Pathwrite — Developer Guide

## Table of Contents

1. [What is Pathwrite?](#1-what-is-pathwrite)
2. [Repository Layout](#2-repository-layout)
3. [Core Concepts](#3-core-concepts)
4. [Defining a Path](#4-defining-a-path)
5. [Step Lifecycle](#5-step-lifecycle)
6. [Navigation Guards](#6-navigation-guards)
   - [`fieldErrors` — per-field validation and auto-derived `canMoveNext`](#fieldmessages--per-field-validation-and-auto-derived-canmovenext)
7. [The PathSnapshot](#7-the-pathsnapshot)
8. [Events](#8-events)
9. [Sub-Paths](#9-sub-paths)
10. [Angular Adapter](#10-angular-adapter)
    - [Reading and updating step data](#reading-and-updating-step-data)
11. [React Adapter](#11-react-adapter)
    - [Eager JSX evaluation in `<PathShell>`](#eager-jsx-evaluation-in-pathshell)
12. [Vue Adapter](#12-vue-adapter)
13. [Svelte Adapter](#13-svelte-adapter)
14. [Default UI Shell](#14-default-ui-shell)
    - [Cross-adapter API equivalence](#cross-adapter-api-equivalence)
15. [Using the Core Engine Directly](#15-using-the-core-engine-directly)
16. [TypeScript Generics](#16-typescript-generics)
    - [Accessing typed data in step components](#accessing-typed-data-in-step-components)
17. [Backend Lifecycle Patterns](#17-backend-lifecycle-patterns)
18. [Testing](#18-testing)
19. [Design Decisions](#19-design-decisions)
20. [Observers & Persistence](#20-observers--persistence)
21. [Forms with Pathwrite](#21-forms-with-pathwrite)

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
│   ├── react-adapter/          # @daltonr/pathwrite-react (+ PathShell)
│   ├── vue-adapter/            # @daltonr/pathwrite-vue (+ PathShell)
│   ├── svelte-adapter/         # @daltonr/pathwrite-svelte (+ PathShell)
│   ├── store-http/             # @daltonr/pathwrite-store-http (HTTP persistence)
│   └── shell.css               # Optional shared stylesheet for shell components
├── apps/
│   ├── ad-hoc/
│   │   ├── demo-angular/           # Angular demo (simple)
│   │   ├── demo-angular-course/    # Angular demo (multi-step course path, manual UI)
│   │   ├── demo-angular-shell/     # Angular demo using <pw-shell> default UI
│   │   ├── demo-api-server/        # Express API server for persistence demos
│   │   ├── demo-console/           # Console demo
│   │   ├── demo-lifecycle/         # Backend lifecycle state machine (no UI)
│   │   ├── demo-svelte-onboarding/ # Svelte onboarding wizard demo
│   │   └── demo-vue-wizard/        # Vue wizard demo
│   ├── angular-demos/
│   │   ├── demo-angular-form/      # Angular form demo
│   │   └── demo-angular-wizard/    # Angular wizard demo
│   ├── react-demos/
│   │   ├── demo-react-form/        # React form demo
│   │   └── demo-react-wizard/      # React wizard demo
│   ├── svelte-demos/
│   │   ├── demo-svelte-form/       # Svelte form demo
│   │   └── demo-svelte-wizard/     # Svelte wizard demo
│   └── vue-demos/
│       ├── demo-vue-form/          # Vue form demo
│       └── demo-vue-wizard/        # Vue wizard demo
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
  ],
  onComplete: (data) => {
    // Called when the path completes (user reaches the end)
    console.log("Path completed with data:", data);
  },
  onCancel: (data) => {
    // Called when the path is cancelled
    console.log("Path cancelled with data:", data);
  }
};
```

### Path-level callbacks

| Field | Type | Description |
|---|---|---|
| `onComplete` | `(data: TData) => void \| Promise<void>` | Called when a **top-level** path completes (i.e. the user reaches the end of the last step). Receives the final path data. Not called for sub-paths — sub-path completion is handled by the parent step's `onSubPathComplete` hook. |
| `onCancel` | `(data: TData) => void \| Promise<void>` | Called when a **top-level** path is cancelled. Receives the path data at the time of cancellation. Not called for sub-paths — sub-path cancellation is handled by the parent step's `onSubPathCancel` hook. |

> **Why on the path definition?** Before this feature, developers subscribed to events and filtered for `type === "completed"` or `type === "cancelled"`. This was boilerplate every app needed. Now you can define completion and cancellation handlers right where you define the path — no subscription management required.

### Step fields

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | ✅ | Unique within the path. This is the key used to link steps to UI blocks. |
| `title` | `string` | — | Human-readable label. Exposed in the snapshot as `stepTitle` and in `steps[].title`. |
| `meta` | `Record<string, unknown>` | — | Arbitrary metadata (e.g. icon name, group). Exposed as `stepMeta` and `steps[].meta`. |
| `shouldSkip` | function | — | Return `true` to skip this step during navigation. |
| `canMoveNext` | function | — | Return `false` to block forward navigation. **If omitted and `fieldErrors` is defined, auto-derived as `true` when all field messages are `undefined`.** Only add an explicit guard when the condition differs from "all fields valid". |
| `canMovePrevious` | function | — | Return `false` to block backward navigation. |
| `validationMessages` | function | — | Returns a `string[]` explaining why the step is not yet valid. Evaluated synchronously on every snapshot; displayed by the default shell below the step body. Async functions default to `[]`. |
| `onEnter` | function | — | Called on arrival at a step. Can return a partial data patch. Receives `ctx.isFirstEntry` — use it to guard one-time initialisation so that navigating Back and re-entering the step does not reset data. |
| `onLeave` | function | — | Called on departure (only when the guard allows). Can return a partial data patch. |
| `onSubPathComplete` | function | — | Called on the parent step when a sub-path completes naturally. Receives `(subPathId, subPathData, ctx, meta?)`. Can return a partial data patch. |
| `onSubPathCancel` | function | — | Called on the parent step when a sub-path is cancelled (explicit `cancel()` or Back on first step). Receives `(subPathId, subPathData, ctx, meta?)`. Can return a partial data patch. |

> **`validationMessages` must be synchronous.** The snapshot is built synchronously, so
> async `validationMessages` functions are called but their result is ignored — the
> messages will always appear as an empty array. If your validation depends on async
> data (e.g. a server response), load it beforehand, store it in `data`, and reference
> it from a synchronous `validationMessages` function.

---

## 5. Step Lifecycle

Every hook receives a **`PathStepContext`** object:

```typescript
interface PathStepContext<TData> {
  readonly pathId:      string;         // ID of the currently active path
  readonly stepId:      string;         // ID of the current step
  readonly data:        Readonly<TData>; // snapshot copy — mutating it has no effect
  readonly isFirstEntry: boolean;       // true only on the very first visit to this step
}
```

> **Important:** `ctx.data` is a **copy**. To update data, return a partial patch from the hook. The engine merges it automatically.

> **`ctx.isFirstEntry`** is `true` the first time a step is entered within the current path instance and `false` on every subsequent re-entry (e.g. after navigating Back then Forward). Use it inside `onEnter` to guard one-time initialisation:
>
> ```typescript
> onEnter: (ctx) => {
>   if (!ctx.isFirstEntry) return; // don't reset data on Back/re-entry
>   return { approvals: [], currentIndex: 0 };
> }
> ```

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
      if index < 0 on top-level path: no-op (stay on step 0, no event emitted)
      if index < 0 on sub-path: pop back to parent, emit stateChanged
      onEnter(new step)             ← patch applied to data
      emit stateChanged (isNavigating: false)
```

> **`onEnter` fires on every entry, including Back navigation.**
> Use it for side effects that should always run (resetting a sub-form, refreshing an
> externally-loaded value). Do **not** use it to initialise data — it will silently
> overwrite any changes the user made if they navigate back to the step.
>
> For one-time data initialisation, pass values in `initialData` when calling `start()`:
>
> ```typescript
> // ❌ Resets data every time the user navigates back to this step
> { id: 'items', onEnter: () => ({ items: [], currentIndex: 0 }) }
>
> // ✅ Initialised once when the path starts — survives Back navigation
> await facade.start(myPath, { items: [], currentIndex: 0 });
> ```

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

> **Guards run before `onEnter` on first entry.** The engine emits a snapshot to signal
> that navigation has started *before* calling `onEnter` on the arriving step. At that
> moment `data` still reflects the `initialData` passed to `start()` — fields your
> `onEnter` would set are not yet present. Write guards defensively so they do not
> throw when optional fields are absent:
>
> ```typescript
> // ❌ Crashes on first snapshot if initialData = {}
> canMoveNext: (ctx) => ctx.data.name.trim().length > 0
>
> // ✅ Safe — handles undefined gracefully
> canMoveNext: (ctx) => (ctx.data.name as string ?? "").trim().length > 0
> ```
>
> If a guard or `validationMessages` hook throws during snapshot evaluation, Pathwrite
> catches the error, logs a `console.warn` with the step ID and the thrown value, and
> returns the safe default (`true` / `[]`) so the UI remains operable. The warning
> points to this timing as the likely cause.

**Async guards**: If a guard returns a `Promise`, the snapshot defaults to `true` (optimistic). The engine still enforces the real result when navigation is attempted.

> **Async guard UX pattern:** Because async `canMoveNext` guards default to `true` in
> the snapshot, the Next button will appear enabled until the user clicks it. Once
> clicked, `isNavigating` becomes `true` (button is disabled), the guard runs, and if
> it returns `false` the navigation is blocked and the button re-enables. This is the
> intended behaviour — the guard is only evaluated on navigation, not before.
>
> If you need to pre-disable the button based on async state (e.g. a server check),
> load the result ahead of time, store it in `data`, and use a synchronous guard:
>
> ```typescript
> // Load async data → store in data → guard reads it synchronously
> await facade.setData("emailAvailable", await api.checkEmail(email));
>
> // Guard is synchronous — snapshot reflects it immediately
> { canMoveNext: (ctx) => ctx.data.emailAvailable === true }
> ```

### `shouldSkip`

`shouldSkip` is evaluated **during navigation**, not as a guard. If it returns `true`, the step is silently passed over in the direction of travel. It is re-evaluated on every navigation, so a step can become skipped or unskipped dynamically based on data.

```typescript
{
  id: "payment",
  shouldSkip: (ctx) => ctx.data.isFreeAccount === true
}
```

If all remaining steps are skipped going forward, the path **completes**. If all preceding steps are skipped going backward, the path **cancels**.

### `fieldErrors` — per-field validation and auto-derived `canMoveNext`

`fieldErrors` is a synchronous hook that returns a map of field ID → error string (or `undefined` for no error). The shell displays these messages with human-readable labels below the step body, and the snapshot exposes them as `snapshot.fieldErrors` so step templates can render inline per-field errors.

```typescript
{
  id: "details",
  fieldErrors: ({ data }) => ({
    firstName: !data.firstName?.trim() ? "First name is required." : undefined,
    email:     !String(data.email ?? "").includes("@") ? "Valid email required." : undefined,
  })
}
```

> **Auto-derived guard:** When `fieldErrors` is defined and `canMoveNext` is **not**, the
> engine automatically derives `canMoveNext` as `true` when every field message is `undefined`,
> and `false` when any message is non-empty.
>
> You only need an explicit `canMoveNext` if your guard logic differs from "all fields valid":
>
> ```typescript
> // ✅ No canMoveNext needed — auto-derived from fieldErrors
> { id: "details", fieldErrors: ({ data }) => ({ name: !data.name ? "Required." : undefined }) }
>
> // ✅ Explicit canMoveNext when the guard is more than "all fields valid"
> { id: "terms", fieldErrors: ..., canMoveNext: (ctx) => ctx.data.agreed === true }
> ```

`fieldErrors` **must be synchronous**. Async functions are called but their result is discarded (the snapshot defaults to `{}`). If validation depends on async state, load it beforehand, store the result in `data`, and reference it from a synchronous `fieldErrors`.

Use `"_"` as the field key for form-level errors that don't belong to a specific field:

```typescript
fieldErrors: ({ data }) => ({
  _: data.password !== data.confirmPassword ? "Passwords do not match." : undefined,
})
```

The shell renders `"_"` errors without a label.

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
  validationMessages: string[];         // messages from the current step's validationMessages hook
  isDirty:        boolean;              // true if any data changed since entering this step
  hasAttemptedNext: boolean;            // true after the user has called next() at least once on this step
  stepEnteredAt:  number;               // Date.now() timestamp when this step was entered
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

### `isDirty` — automatic unsaved changes tracking

The snapshot automatically tracks whether any data has changed since entering the current step. `isDirty` is `false` on step entry and becomes `true` after the first `setData()` that changes a value. It resets to `false` when:
- Navigating to a new step (forward or backward)
- Calling `resetStep()` to revert changes
- Calling `restart()` to start over

The comparison is **shallow** — only top-level keys are checked. Nested objects are compared by reference, not deep equality. This is a deliberate trade-off for performance and simplicity, as most form data is flat (strings, numbers, booleans).

**Common use cases:**
```typescript
// Show "unsaved changes" warning
{snapshot.isDirty && <span className="warning">You have unsaved changes</span>}

// Disable Save button until user makes changes
<button disabled={!snapshot.isDirty} onClick={handleSave}>Save</button>

// Prompt before navigation
if (snapshot.isDirty && !confirm("Discard changes?")) {
  return;
}

// Revert changes
<button onClick={() => engine.resetStep()}>Undo Changes</button>
```

---

## 8. Events

Subscribe with `engine.subscribe`. The callback receives a `PathEvent`:

```typescript
type StateChangeCause =
  | "start" | "next" | "previous" | "goToStep"
  | "goToStepChecked" | "setData" | "cancel" | "restart";

type PathEvent =
  | { type: "stateChanged"; cause: StateChangeCause; snapshot: PathSnapshot }
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
| `stateChanged` | After every navigation or `setData` call (possibly multiple times per operation — see `isNavigating`) | `cause`, `snapshot` |
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

Define `onSubPathComplete` on the parent step that launches the sub-path. It is called when the sub-path **completes** (not when cancelled). The hook receives:

| Argument | Description |
|----------|-------------|
| `subPathId` | ID of the sub-path that just finished. |
| `subPathData` | Final data of the sub-path. |
| `ctx` | Parent step context (includes `isFirstEntry`). |
| `meta?` | The correlation object passed to `startSubPath()` — see below. |

```typescript
{
  id: "subjects-list",
  onSubPathComplete: (subPathId, subData, ctx, meta) => {
    return {
      subjects: [
        ...ctx.data.subjects,
        { name: subData.subjectName, teacher: subData.subjectTeacher }
      ]
    };
  }
}
```

### Reacting to a cancelled sub-path

Define `onSubPathCancel` on the parent step to react when a sub-path is cancelled (either via `cancel()` or when the user presses Back on the sub-path's first step). It receives the same four arguments as `onSubPathComplete`. Use it to record a "skipped" or "declined" outcome:

```typescript
{
  id: "run-approvals",
  onSubPathComplete: (subPathId, subData, ctx, meta) => ({
    approvals: [...ctx.data.approvals, { index: meta?.index, result: subData.decision }]
  }),
  onSubPathCancel: (subPathId, subData, ctx, meta) => ({
    approvals: [...ctx.data.approvals, { index: meta?.index, result: "skipped" }]
  })
}
```

If `onSubPathCancel` is not defined, cancelling a sub-path simply restores the parent's state unchanged.

### Stack behaviour

```
engine.start(mainPath)              stack: []          active: main
engine.startSubPath(subPath)        stack: [main]      active: sub
  engine.next()  // sub completes
  onSubPathComplete fires on parent step
                                    stack: []          active: main (restored)
```

```
engine.startSubPath(subPath)        stack: [main]      active: sub
  engine.cancel()  // sub cancelled
  onSubPathCancel fires on parent step (if defined)
                                    stack: []          active: main (restored)
```

Nesting is unlimited. `nestingLevel` in the snapshot tells you how deep you are.

### What the shell shows while a sub-path is active

When a sub-path is running, the snapshot reflects the **sub-path's** steps — the
main progress bar switches to show the sub-path's step list and `nestingLevel`
increments.

The **root (top-level) progress bar** remains visible above the sub-path's own
progress bar so users never lose sight of where they are in the overall flow.
This compact, muted bar is rendered automatically by all four shells (React, Vue,
Angular, Svelte) whenever `nestingLevel > 0`.

The snapshot exposes this via the `rootProgress` field:

```typescript
interface RootProgress {
  pathId: string;
  stepIndex: number;
  stepCount: number;
  progress: number;
  steps: StepSummary[];
}

// Available when nestingLevel > 0
snapshot.rootProgress   // RootProgress | undefined
```

`rootProgress` always reflects the **root** path (bottom of the stack), even when
deeply nested (e.g. a sub-path inside a sub-path). It is `undefined` at the top
level. If you write a custom header via `renderHeader` / `#header` / `pwShellHeader`,
you can use `snapshot.rootProgress` to render your own persistent top-level
indicator.

### Controlling progress bar layout with `progressLayout`

All shells accept a `progressLayout` prop to control how the two bars are
arranged when a sub-path is active:

| Value          | Behaviour                                                              |
|----------------|------------------------------------------------------------------------|
| `"merged"`     | Root and sub-path bars in one card (default)                           |
| `"split"`      | Root and sub-path bars as separate cards                               |
| `"rootOnly"`   | Only the root bar — sub-path bar hidden                                |
| `"activeOnly"` | Only the active (sub-path) bar — root bar hidden (pre-v0.7 behaviour) |

```tsx
// React
<PathShell path={myPath} progressLayout="split" steps={...} />

// Vue
<PathShell :path="myPath" progress-layout="rootOnly" />

// Angular
<pw-shell [path]="myPath" progressLayout="activeOnly">...</pw-shell>

// Svelte
<PathShell path={myPath} progressLayout="split" />
```

### Back on the first step of a sub-path

Calling `previous()` (or clicking Back in the shell) when on the **first step of a sub-path** cancels the sub-path and returns to the parent. `onSubPathCancel` is
called if defined; `onSubPathComplete` is **not** called.

### Correlating sub-paths to collection items

Pass a `meta` object as the third argument to `startSubPath()`. It is returned
unchanged as the fourth argument of both `onSubPathComplete` and `onSubPathCancel`.
Use it to identify which collection item triggered the sub-path without cluttering
the sub-path's own data:

```typescript
// Launch one sub-path per approver, carrying the index as meta
for (let i = 0; i < approvers.length; i++) {
  engine.startSubPath(approvalSubPath, { approverName: approvers[i].name }, { index: i });
}

// In the parent step — no index in subData needed:
onSubPathComplete: (subPathId, subData, ctx, meta) => {
  const approvals = [...(ctx.data.approvals as unknown[])];
  approvals[meta!.index as number] = subData.decision;
  return { approvals };
},
onSubPathCancel: (subPathId, subData, ctx, meta) => {
  const approvals = [...(ctx.data.approvals as unknown[])];
  approvals[meta!.index as number] = "skipped";
  return { approvals };
}
```

### Step ID collisions

There is no automatic namespacing of step IDs across a main path and its sub-paths.
If a main path step and a sub-path step share the same ID (e.g. both have a `summary`
step), the shell will match both templates and may render both simultaneously.

Avoid this by:
- Using path-qualified IDs (`main-summary`, `approval-summary`), or
- Always checking **both** `pathId` and `stepId` when conditionally rendering in
  custom (headless) UI:

```typescript
// Unambiguous match — safe even when sub-paths share step IDs with the parent
if (snapshot.pathId === "main-path" && snapshot.stepId === "summary") { ... }
```

The default shell components use `stepId` alone to match templates, so unique step
IDs across all paths used within a single shell are required.

### Angular — sub-path step templates

Because `<pw-shell>` owns a single `PathFacade` instance and renders by matching
`stepId` to `pwStep` directives, **all step templates — for both the main path and
any sub-paths — must be declared inside the same `<pw-shell>`**:

```html
<pw-shell [path]="mainPath">
  <!-- main path steps -->
  <ng-template pwStep="add-approvers">...</ng-template>
  <ng-template pwStep="summary">...</ng-template>

  <!-- sub-path steps — must also live here -->
  <ng-template pwStep="review-document">...</ng-template>
  <ng-template pwStep="make-decision">...</ng-template>
  <ng-template pwStep="approval-comments">...</ng-template>
</pw-shell>
```

This means the parent component's template must include the step templates for every
sub-path it can launch. Use unique step IDs across all paths to avoid silent
rendering conflicts.

---

## 10. Angular Adapter

> **Build note:** The Angular adapter is compiled with **`ngc`** (Angular's own
> compiler) rather than plain `tsc`. This produces partial-compilation Ivy
> artefacts (`ɵngDeclareComponent`, `ɵngDeclareDirective`, `ɵngDeclareInjectable`)
> that are compatible with the Angular linker for any Angular 14+ consumer. If
> you are building the monorepo from source, `npm run build` handles this
> automatically — it runs `tsc -b` for core/React/Vue first, then invokes `ngc`
> for the Angular adapter via `npm run build -w packages/angular-adapter`.

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

### `injectPath()` — Recommended for Components (Angular 16+)

**New in v0.6.0** — `injectPath()` provides an ergonomic, signal-based API for accessing the path engine inside Angular components. This is the **recommended approach** for step components and forms.

```typescript
import { Component } from "@angular/core";
import { PathFacade, injectPath } from "@daltonr/pathwrite-angular";

@Component({
  selector: "app-contact-step",
  standalone: true,
  providers: [PathFacade],  // ← Required at this component or a parent
  template: `
    @if (path.snapshot(); as s) {
      <input (input)="updateName($any($event.target).value)" />
      <button (click)="path.next()">Next</button>
    }
  `
})
export class ContactStepComponent {
  protected readonly path = injectPath<ContactData>();

  protected updateName(value: string): void {
    this.path.setData("name", value);  // ← No template ref needed
  }
}
```

**Returns:**
- `snapshot: Signal<PathSnapshot | null>` — reactive signal for current state
- All navigation actions: `next()`, `previous()`, `setData()`, `cancel()`, etc.
- Full TypeScript type safety when generic is specified

This mirrors React's `usePathContext()` and Vue's `usePath()` for consistency across frameworks, while feeling Angular-native (uses `inject()`, returns signals, no RxJS required).

**Compared to manual facade injection:**
- ✅ No template references (`#shell`)
- ✅ Signal-native — `path.snapshot()` is the reactive signal directly
- ✅ Type-safe — generic parameter flows through to all methods
- ✅ Framework-consistent — less Angular-specific knowledge required

See the [Angular adapter README](../../packages/angular-adapter/README.md) for complete documentation.

### Reading and updating step data

The recommended pattern for step components is a typed `data` getter that reads directly from the snapshot signal. This eliminates local state variables, `ngOnInit` restore logic, and dual-update event handlers — the engine is the single source of truth.

**Key insight:** `snapshot()` is always non-null while a step component is mounted — `PathShell` only renders step content when the path is active. The non-null assertion (`!`) is therefore safe and eliminates the need for casts or fallbacks.

```typescript
export class PersonalInfoStepComponent {
  protected readonly path = injectPath<OnboardingData>();

  // snapshot()! is safe — PathShell guarantees a non-null snapshot while
  // this component is rendered. The generic on injectPath<OnboardingData>()
  // means data is already typed; no cast needed.
  protected get data(): OnboardingData {
    return this.path.snapshot()!.data;
  }
}
```

In the template, read from `data` and write directly to the engine:

```html
<input [value]="data.firstName ?? ''"
       (input)="path.setData('firstName', $any($event.target).value.trim())" />
```

#### TypeScript: typing `setData` key parameters

`setData` is typed as `setData<K extends string & keyof TData>(key: K, value: TData[K])`.
The `string &` intersection is necessary because `keyof TData` includes `number` and `symbol`
(all valid JavaScript property key types), but `setData` only accepts string keys.

If you write a reusable update method that passes a field name as a parameter, use
`string & keyof TData` — not just `keyof TData` — to match the `setData` signature:

```typescript
// ❌ Type error: keyof OnboardingData is string | number | symbol
protected update(field: keyof OnboardingData, value: string): void {
  this.path.setData(field, value); // ← TS error
}

// ✅ Correct: string & keyof ensures the type matches setData's constraint
protected update(field: string & keyof OnboardingData, value: string): void {
  this.path.setData(field, value); // ← OK
}
```

This pattern only matters when passing a key as a variable. Inline string literals
(`path.setData("firstName", ...)`) are always fine because TypeScript infers the
literal type directly.

### Reactive state with signals (recommended)

`PathFacade` ships a pre-wired `stateSignal` — no `toSignal()` call required:

```typescript
@Component({ providers: [PathFacade] })
export class MyComponent {
  protected readonly facade = inject(PathFacade);

  // Ready to use — updated synchronously alongside state$
  protected readonly snapshot = this.facade.stateSignal;

  public readonly isActive    = computed(() => this.snapshot() !== null);
  public readonly currentStep = computed(() => this.snapshot()?.stepId ?? null);
  public readonly canAdvance  = computed(() => this.snapshot()?.canMoveNext ?? false);
}
```

`toSignal()` still works if you prefer the Observable approach:

```typescript
public readonly snapshot = toSignal(this.facade.state$, { initialValue: null });
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
| `stateSignal` | `Signal<PathSnapshot \| null>` — pre-wired signal, updated in sync with `state$` |
| `events$` | `Observable<PathEvent>` — all engine events |
| `start(def, data?)` | Start or restart a path |
| `restart(def, data?)` | Tear down any active path (without firing hooks) and start fresh. Safe at any time. Use for "Start over" / retry flows. |
| `startSubPath(def, data?, meta?)` | Push a sub-path. The optional `meta` object is passed back to `onSubPathComplete` / `onSubPathCancel` unchanged — use it for collection correlation. |
| `next()` | Advance one step |
| `previous()` | Go back one step |
| `cancel()` | Cancel the active path or sub-path |
| `setData(key, value)` | Update a single data value |
| `resetStep()` | Revert the current step's data to what it was when the step was entered. Useful for "Clear" or "Reset" buttons. |
| `goToStep(stepId)` | Jump directly to a step by ID. Calls `onLeave`/`onEnter`; bypasses guards and `shouldSkip`. |
| `goToStepChecked(stepId)` | Jump to a step by ID, checking the current step's `canMoveNext` (forward) or `canMovePrevious` (backward) guard first. Navigation is blocked if the guard returns false. |
| `snapshot()` | Synchronous read of the current snapshot |

### Angular Forms integration — `syncFormGroup`

`syncFormGroup` eliminates the boilerplate of manually wiring an Angular
`FormGroup` to the engine. Call it once and every form value change is
automatically propagated via `setData`, keeping `canMoveNext` guards reactive
without any manual event binding in the template.

```typescript
import { PathFacade, syncFormGroup } from "@daltonr/pathwrite-angular";

@Component({ providers: [PathFacade] })
export class DetailsStepComponent implements OnInit {
  protected readonly facade   = inject(PathFacade);
  protected readonly snapshot = toSignal(this.facade.state$, { initialValue: null });

  protected readonly form = new FormGroup({
    name:  new FormControl('', Validators.required),
    email: new FormControl('', [Validators.required, Validators.email]),
  });

  async ngOnInit() {
    await this.facade.start(myPath, { name: '', email: '' });
    // All current and future form values flow to the engine automatically.
    syncFormGroup(this.facade, this.form, inject(DestroyRef));
  }
}
```

The path definition's guard is now pure — no sync logic in the template:

```typescript
{
  id: 'details',
  canMoveNext: (ctx) =>
    (ctx.data.name  as string).trim().length > 0 &&
    (ctx.data.email as string).includes('@'),
}
```

**`syncFormGroup` signature:**

```typescript
function syncFormGroup(
  facade:      PathFacade,
  formGroup:   FormGroupLike,  // satisfies Angular's FormGroup automatically
  destroyRef?: DestroyRef      // pass inject(DestroyRef) for auto-cleanup
): () => void                  // or call the returned function to clean up manually
```

Key behaviours:
- **Immediate sync** — writes current `getRawValue()` on first call so guards are correct from the start.
- **Disabled controls included** — uses `getRawValue()`, not `formGroup.value`.
- **Safe before `start()`** — silently no-ops if no path is active when a change fires.
- **Duck-typed** — `@angular/forms` is an optional peer dep; any object with `getRawValue()` and `valueChanges` satisfies `FormGroupLike`.

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

> **Tip:** `<PathShell>` (see [§14](#14-default-ui-shell)) also provides context automatically — step children rendered inside `<PathShell>` can call `usePathContext()` to access the same engine instance without a separate `<PathProvider>`.

### `usePath` return value

| Property | Type | Description |
|---|---|---|
| `snapshot` | `PathSnapshot \| null` | Triggers a React re-render on every change |
| `start` | `(def, data?) => void` | Start or restart a path |
| `startSubPath` | `(def, data?, meta?) => void` | Push a sub-path. The optional `meta` object is passed back to `onSubPathComplete` / `onSubPathCancel`. |
| `next` | `() => void` | Advance one step |
| `previous` | `() => void` | Go back one step. No-op when already on the first step of a top-level path. |
| `cancel` | `() => void` | Cancel the active path or sub-path |
| `goToStep` | `(stepId) => void` | Jump to a step by ID. Calls `onLeave`/`onEnter`; bypasses guards and `shouldSkip`. |
| `goToStepChecked` | `(stepId) => void` | Jump to a step by ID, checking the current step's guard first. |
| `setData` | `(key, value) => void` | Update a single data value. When `TData` is provided, `key` and `value` are type-checked against your data shape (see [§16](#16-typescript-generics)). |
| `restart` | `(def, data?) => void` | Tear down any active path (without firing hooks) and start the given path fresh. Safe at any time. Use for "Start over" / retry flows. |

All action functions are **referentially stable** — safe in dependency arrays and as props.

### Eager JSX evaluation in `<PathShell>`

The `steps` prop is a plain `Record<string, ReactNode>`. React evaluates every JSX
expression in the map when the `<PathShell>` component renders — all step content is
instantiated up-front, even though only one step is visible at a time.

For most step components this is negligible: the components are not mounted (they are
not inserted into the DOM) until the shell renders them into the live tree, so no
`useEffect` or lifecycle code runs for off-screen steps. The cost is JSX evaluation
only, not a full component lifecycle.

If a step's JSX expression itself is expensive (e.g. it creates large inline data
structures or calls a function on every render), move that work inside the component
so it only runs when the component mounts:

```tsx
// ❌ Evaluated on every PathShell render, even when "review" is not the current step
<PathShell steps={{ review: <ReviewStep items={buildExpensiveList()} /> }} />

// ✅ buildExpensiveList() only runs when ReviewStep mounts
<PathShell steps={{ review: <ReviewStep /> }} />
// (ReviewStep calls buildExpensiveList() inside itself)
```

> **This is different from lazy mounting.** Steps are not conditionally rendered with
> `React.lazy` or `Suspense` — the entire `steps` map is evaluated synchronously on
> every render of the shell. If you need to defer a component's module load (code
> splitting), wrap it with `React.lazy` and a `<Suspense>` boundary inside the step
> component itself.

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
| `startSubPath` | `(def, data?, meta?) => Promise<void>` | Push a sub-path. The optional `meta` object is passed back to `onSubPathComplete` / `onSubPathCancel`. |
| `next` | `() => Promise<void>` | Advance one step |
| `previous` | `() => Promise<void>` | Go back one step. No-op when already on the first step of a top-level path. |
| `cancel` | `() => Promise<void>` | Cancel the active path or sub-path |
| `goToStep` | `(stepId) => Promise<void>` | Jump to a step by ID. Calls `onLeave`/`onEnter`; bypasses guards and `shouldSkip`. |
| `goToStepChecked` | `(stepId) => Promise<void>` | Jump to a step by ID, checking the current step's guard first. |
| `setData` | `(key, value) => Promise<void>` | Update a single data value. When `TData` is provided, `key` and `value` are type-checked against your data shape (see [§16](#16-typescript-generics)). |
| `restart` | `(def, data?) => Promise<void>` | Tear down any active path (without firing hooks) and start the given path fresh. Safe at any time. Use for "Start over" / retry flows. |

### Design notes

- **`shallowRef`** — the engine produces a new snapshot object on every change, so shallow reactivity is sufficient and avoids deep-watching overhead.
- **`readonly`** — the returned ref is wrapped with `readonly()` to prevent accidental external mutation of the snapshot.
- **`onScopeDispose`** — the composable unsubscribes from the engine when the component's effect scope is disposed (on unmount). No manual cleanup needed.
- **No RxJS, no `useSyncExternalStore`** — the adapter is pure Vue 3 reactivity.

### `usePathContext` — accessing the engine from child components

When using `<PathShell>` (see [§14](#14-default-ui-shell)), step child components can call `usePathContext()` to access the same engine instance. This is powered by Vue's `provide` / `inject`:

```vue
<script setup>
import { usePathContext } from "@daltonr/pathwrite-vue";

const { snapshot, setData, next } = usePathContext();
</script>
```

`usePathContext()` throws if called outside a `<PathShell>`.

---

## 13. Svelte Adapter

> **Requires Svelte 5.** The adapter uses runes (`$state`, `$derived`, `$props`) and snippets (`{#snippet}`, `{@render}`).

### Setup

Call `usePath()` inside a Svelte component's `<script>` block. Each call creates an isolated engine instance. Cleanup is automatic via `onDestroy`.

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { usePath } from '@daltonr/pathwrite-svelte';

  const path = usePath({
    onEvent(event) {
      if (event.type === 'completed') console.log('Done!', event.data);
    }
  });

  onMount(() => {
    path.start(myPath, { name: '' });
  });
</script>
```

> **Do not destructure `snapshot`.** The `snapshot` property is a reactive getter backed by a `$state` rune. Destructuring it captures the current value and loses reactivity. Always access it via the returned object:
>
> ```svelte
> <!-- ✅ Reactive — re-evaluates on every state change -->
> {#if path.snapshot}
>   <h2>{path.snapshot.stepId}</h2>
> {/if}
>
> <!-- ❌ Not reactive — captured once, never updates -->
> <script>
>   const { snapshot } = usePath();  // snapshot is frozen at the initial value
> </script>
> ```

### Reactive state in templates

`path.snapshot` is reactive via Svelte 5's `$state` rune. Use it directly in templates:

```svelte
{#if path.snapshot}
  <h2>{path.snapshot.stepTitle ?? path.snapshot.stepId}</h2>
  <p>Step {path.snapshot.stepIndex + 1} of {path.snapshot.stepCount}</p>

  {#if path.snapshot.stepId === 'details'}
    <input
      value={path.snapshot.data.name ?? ''}
      oninput={(e) => path.setData('name', e.currentTarget.value)}
    />
  {/if}

  <button onclick={path.previous}
          disabled={path.snapshot.isNavigating || !path.snapshot.canMovePrevious}>
    Back
  </button>
  <button onclick={path.next}
          disabled={path.snapshot.isNavigating || !path.snapshot.canMoveNext}>
    {path.snapshot.isLastStep ? 'Finish' : 'Next'}
  </button>
  <button onclick={path.cancel}>Cancel</button>
{:else}
  <button onclick={() => path.start(myPath, { name: '' })}>Start Path</button>
{/if}
```

### Derived values

Use `$derived` to create computed values from the snapshot:

```svelte
<script lang="ts">
  const path = usePath();

  let isActive   = $derived(path.snapshot !== null);
  let subjects   = $derived((path.snapshot?.data.subjects as any[]) ?? []);
  let progress   = $derived(path.snapshot?.progress ?? 0);
</script>
```

### `usePath` return value

| Property | Type | Description |
|---|---|---|
| `snapshot` | `PathSnapshot \| null` | Reactive getter backed by `$state`. Re-evaluates on every change. |
| `start` | `(def, data?) => Promise<void>` | Start or restart a path |
| `startSubPath` | `(def, data?, meta?) => Promise<void>` | Push a sub-path. The optional `meta` object is passed back to `onSubPathComplete` / `onSubPathCancel`. |
| `next` | `() => Promise<void>` | Advance one step |
| `previous` | `() => Promise<void>` | Go back one step. No-op when already on the first step of a top-level path. |
| `cancel` | `() => Promise<void>` | Cancel the active path or sub-path |
| `goToStep` | `(stepId) => Promise<void>` | Jump to a step by ID. Calls `onLeave`/`onEnter`; bypasses guards and `shouldSkip`. |
| `goToStepChecked` | `(stepId) => Promise<void>` | Jump to a step by ID, checking the current step's guard first. |
| `setData` | `(key, value) => Promise<void>` | Update a single data value. When `TData` is provided, `key` and `value` are type-checked against your data shape (see [§16](#16-typescript-generics)). |
| `restart` | `(def, data?) => Promise<void>` | Tear down any active path (without firing hooks) and start the given path fresh. Safe at any time. Use for "Start over" / retry flows. |

### Design notes

- **`$state` rune** — the engine produces a new snapshot object on every change. The adapter stores it in a `$state` variable and exposes it as a getter so Svelte's fine-grained reactivity tracks reads automatically.
- **`onDestroy`** — the adapter unsubscribes from the engine when the component is destroyed. No manual cleanup needed.
- **No stores, no RxJS** — the adapter is pure Svelte 5 runes. There are no Svelte stores (`writable`, `readable`) — the `$state` rune replaces them entirely.

### `getPathContext` — accessing the engine from step components

When using `<PathShell>` (see [§14](#14-default-ui-shell)), step child components can call `getPathContext()` to access the same engine instance. This is powered by Svelte's `setContext` / `getContext` with a `Symbol` key:

```svelte
<script lang="ts">
  import { getPathContext } from '@daltonr/pathwrite-svelte';

  const ctx = getPathContext();
</script>

{#if ctx.snapshot}
  <input value={ctx.snapshot.data.name ?? ''}
         oninput={(e) => ctx.setData('name', e.currentTarget.value)} />
  <button onclick={ctx.next}>Next</button>
{/if}
```

`getPathContext()` throws if called outside a `<PathShell>`.

> **Use `getPathContext()`, not raw `getContext()`.** The context key is a private `Symbol`, so calling Svelte's `getContext()` with a string key will silently return `undefined`. Always import and use `getPathContext()` from `@daltonr/pathwrite-svelte`.

### `bindData` — two-way binding helper

`bindData` creates a lightweight binding object for form inputs. It reads from the snapshot and writes via `setData`:

```svelte
<script lang="ts">
  import { usePath, bindData } from '@daltonr/pathwrite-svelte';

  const path = usePath();
  const name = bindData(() => path.snapshot, path.setData, 'name');
</script>

<!-- Read with name.value, write with name.set() -->
<input value={name.value} oninput={(e) => name.set(e.currentTarget.value)} />
```

---

## 14. Default UI Shell

Every adapter ships an optional **shell component** that renders a complete wizard UI — progress indicator, step content area, and navigation buttons — out of the box. You define only the per-step content; the shell handles the chrome.

The shell is a convenience layer on top of the headless API. It uses the same `usePath` / `PathFacade` internally, so you can start with the shell and switch to fully custom UI at any time.

### Context sharing

All shell components automatically provide their engine instance to child components:

- **React**: `PathShell` wraps its children in a `PathContext.Provider`. Step children can call `usePathContext()`.
- **Vue**: `PathShell` calls `provide()` internally. Step children can call `usePathContext()`.
- **Angular**: `PathShellComponent` provides `PathFacade` in its own `providers` array
  and passes its component-level `Injector` to every step template via
  `ngTemplateOutletInjector`. Step components can therefore call
  `inject(PathFacade)` directly and receive the same instance the shell uses —
  no additional provider setup needed.
- **Svelte**: `PathShell` calls `setContext()` with a private `Symbol` key. Step children can call `getPathContext()`.

This means step content components can read `snapshot.data`, call `setData()`, or trigger navigation without prop drilling.

### Architecture

```
┌─────────────────────────────────────┐
│  ● Step 1  ─── ○ Step 2  ─── ○ Step 3  │  ← progress header
│  ████████░░░░░░░░░░░░░░░░░░░░░░░░░░│  ← progress bar
├─────────────────────────────────────┤
│                                     │
│  [your step content goes here]      │  ← body (from steps map / named slots / pwStep)
│                                     │
├─────────────────────────────────────┤
│  • Name is required                 │  ← validation messages (hidden when empty)
│  • Email must be valid              │
├─────────────────────────────────────┤
│  ‹ Back          Cancel    Next ›   │  ← navigation footer
└─────────────────────────────────────┘
```

### React — `<PathShell>`

```tsx
import { PathShell } from "@daltonr/pathwrite-react";

function CoursePath() {
  return (
    <PathShell
      path={coursePath}
      initialData={{ name: "" }}
      onComplete={(data) => console.log("Done!", data)}
      steps={{
        details: <DetailsForm />,
        review: <ReviewPanel />,
      }}
    />
  );
}
```

#### `PathShellProps`

| Prop | Type | Default | Description |
|---|---|---|---|
| `path` | `PathDefinition` | *required* | The path definition to drive. |
| `steps` | `Record<string, ReactNode>` | *required* | Map of step ID → content. The shell renders `steps[snapshot.stepId]` for the current step. |
| `initialData` | `PathData` | `{}` | Initial data passed to `engine.start()`. |
| `autoStart` | `boolean` | `true` | If true, the path starts on mount. |
| `onComplete` | `(data) => void` | — | Called when the path completes. |
| `onCancel` | `(data) => void` | — | Called when the path is cancelled. |
| `onEvent` | `(event) => void` | — | Called for every engine event. |
| `backLabel` | `string` | `"Previous"` | Previous button label. |
| `nextLabel` | `string` | `"Next"` | Next button label. |
| `finishLabel` | `string` | `"Finish"` | Finish button label (last step). |
| `cancelLabel` | `string` | `"Cancel"` | Cancel button label. |
| `hideCancel` | `boolean` | `false` | Hide the cancel button. |
| `hideProgress` | `boolean` | `false` | Hide the progress indicator. Also hidden automatically for single-step top-level paths. |
| `footerLayout` | `"wizard" \| "form" \| "auto"` | `"auto"` | Footer button layout. `"auto"` uses `"form"` for single-step top-level paths, `"wizard"` otherwise. |
| `className` | `string` | — | Extra CSS class on the root element. |
| `renderHeader` | `(snapshot) => ReactNode` | — | Replace the default progress header. |
| `renderFooter` | `(snapshot, actions) => ReactNode` | — | Replace the default navigation footer. |

#### Replacing the header or footer

Use `renderHeader` or `renderFooter` to override just one section while keeping the rest:

```tsx
<PathShell
  path={myPath}
  steps={{ a: <StepA />, b: <StepB /> }}
  renderFooter={(snap, { next, previous }) => (
    <div className="my-nav">
      <button onClick={previous}>← Previous</button>
      <span>{snap.stepIndex + 1} / {snap.stepCount}</span>
      <button onClick={next}>{snap.isLastStep ? "Done" : "→ Next"}</button>
    </div>
  )}
/>
```

### Vue — `<PathShell>`

```vue
<script setup>
import { PathShell } from "@daltonr/pathwrite-vue";
import { coursePath } from "./paths";
</script>

<template>
  <PathShell :path="coursePath" :initial-data="{ name: '' }" @complete="onDone">
    <template #details><DetailsForm /></template>
    <template #review><ReviewPanel /></template>
  </PathShell>
</template>
```

Step content is provided via **named slots** matching each step's `id`.

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
| `hideProgress` | `boolean` | `false` | Hide the progress indicator. Also hidden automatically for single-step top-level paths. |
| `footerLayout` | `"wizard" \| "form" \| "auto"` | `"auto"` | Footer button layout. `"auto"` uses `"form"` for single-step top-level paths, `"wizard"` otherwise. |

#### Vue events

| Event | Payload | Description |
|---|---|---|
| `@complete` | `PathData` | Path completed. |
| `@cancel` | `PathData` | Path cancelled. |
| `@event` | `PathEvent` | Every engine event. |

#### Vue slots

Step content slots are named after the step `id`. The shell also supports `header` and `footer` scoped slots for customisation:

```vue
<PathShell :path="myPath">
  <template #header="{ snapshot }">
    <MyCustomProgress :steps="snapshot.steps" />
  </template>

  <template #a><StepA /></template>
  <template #b><StepB /></template>

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
| `backLabel` | `string` | `"Previous"` | Previous button label. |
| `nextLabel` | `string` | `"Next"` | Next button label. |
| `completeLabel` | `string` | `"Complete"` | Complete label (last step). |
| `cancelLabel` | `string` | `"Cancel"` | Cancel button label. |
| `hideCancel` | `boolean` | `false` | Hide the cancel button. |
| `hideProgress` | `boolean` | `false` | Hide the progress indicator. Also hidden automatically for single-step top-level paths. |
| `footerLayout` | `"wizard" \| "form" \| "auto"` | `"auto"` | Footer button layout. `"auto"` uses `"form"` for single-step top-level paths, `"wizard"` otherwise. |

#### Angular outputs

| Output | Payload | Description |
|---|---|---|
| `(completed)` | `PathData` | Path completed. |
| `(cancelled)` | `PathData` | Path cancelled. |
| `(pathEvent)` | `PathEvent` | Every engine event. |

#### Angular footer customisation (`pwShellFooter`)

Use the `pwShellFooter` directive to replace the default navigation buttons. The template receives the snapshot as the implicit variable and an `actions` object with all navigation callbacks:

```html
<pw-shell [path]="myPath">
  <ng-template pwShellFooter let-s let-actions="actions">
    <button (click)="actions.previous()" [disabled]="s.isFirstStep">Back</button>
    <button (click)="actions.next()"     [disabled]="!s.canMoveNext">
      {{ s.isLastStep ? 'Finish' : 'Next' }}
    </button>
    <button (click)="actions.restart()">Start over</button>
  </ng-template>
  <ng-template pwStep="details"><app-details-form /></ng-template>
</pw-shell>
```

`actions` contains: `next`, `previous`, `cancel`, `goToStep`, `goToStepChecked`, `setData`, `resetStep`, `restart`. All return `Promise<void>`.

### Svelte — `<PathShell>`

```svelte
<script lang="ts">
  import { PathShell } from '@daltonr/pathwrite-svelte';
  import '@daltonr/pathwrite-svelte/styles.css';
  import DetailsForm from './DetailsForm.svelte';
  import ReviewPanel from './ReviewPanel.svelte';

  const signupPath = {
    id: 'signup',
    steps: [
      { id: 'details', title: 'Your Details' },
      { id: 'review', title: 'Review' }
    ]
  };
</script>

<PathShell
  path={signupPath}
  initialData={{ name: '', email: '' }}
  oncomplete={(data) => console.log('Done!', data)}
>
  {#snippet details()}
    <DetailsForm />
  {/snippet}
  {#snippet review()}
    <ReviewPanel />
  {/snippet}
</PathShell>
```

Step content is provided as **Svelte 5 snippets** whose names match the step `id`. The shell collects all snippets via `...rest` props and renders the active one with `{@render}`.

#### Svelte props

| Prop | Type | Default | Description |
|---|---|---|---|
| `path` | `PathDefinition` | — | Path definition (for self-managed engine). |
| `engine` | `PathEngine` | — | External engine (for persistence — mutually exclusive with `path`). |
| `initialData` | `PathData` | `{}` | Initial data. |
| `autoStart` | `boolean` | `true` | Auto-start on mount. |
| `backLabel` | `string` | `"Previous"` | Previous button label. |
| `nextLabel` | `string` | `"Next"` | Next button label. |
| `completeLabel` | `string` | `"Complete"` | Complete label (last step). |
| `cancelLabel` | `string` | `"Cancel"` | Cancel button label. |
| `hideCancel` | `boolean` | `false` | Hide the cancel button. |
| `hideProgress` | `boolean` | `false` | Hide the progress indicator. Also hidden automatically for single-step top-level paths. |
| `footerLayout` | `"wizard" \| "form" \| "auto"` | `"auto"` | Footer button layout. `"auto"` uses `"form"` for single-step top-level paths, `"wizard"` otherwise. |
| `validationDisplay` | `"summary" \| "inline" \| "both"` | `"inline"` | Controls field-error rendering. `"summary"`: shell renders error list. `"inline"`: suppress summary, handle in template. `"both"`: render both. |

#### Svelte callbacks

| Callback | Type | Description |
|---|---|---|
| `oncomplete` | `(data: PathData) => void` | Called when the path completes. |
| `oncancel` | `(data: PathData) => void` | Called when the path is cancelled. |
| `onevent` | `(event: PathEvent) => void` | Called for every engine event. |

#### Svelte snippets

Step content snippets are named after the step `id`. The shell also supports `header` and `footer` snippets for customisation:

```svelte
<PathShell path={myPath}>
  {#snippet header(snap)}
    <h2>Step {snap.stepIndex + 1} of {snap.stepCount}</h2>
  {/snippet}

  {#snippet details()}
    <DetailsStep />
  {/snippet}

  {#snippet footer(snap, actions)}
    <button onclick={actions.previous} disabled={snap.isFirstStep}>
      ← Back
    </button>
    <button onclick={actions.next} disabled={!snap.canMoveNext}>
      {snap.isLastStep ? 'Finish' : 'Continue →'}
    </button>
  {/snippet}
</PathShell>
```

### Resetting the path

There are two ways to reset a `<PathShell>` back to step 1.

---

**Option 1 — Toggle mount** (all frameworks, always works)

Destroy and recreate the shell using a conditional flag. Everything resets — the path engine, all child component state, scroll position within the shell — because the component is unmounted and remounted from scratch.

**React** — use the built-in `key` prop. Changing `key` forces a fresh mount without needing a separate boolean flag:

```tsx
const [formKey, setFormKey] = useState(0);

<PathShell key={formKey} path={myPath} steps={{ ... }} />

<button onClick={() => setFormKey(k => k + 1)}>Try Again</button>
```

**Vue:**
```vue
<PathShell v-if="isActive" :path="myPath" @complete="isActive = false" />
<button v-else @click="isActive = true">Try Again</button>
```

**Svelte:**
```svelte
{#if isActive}
  <PathShell path={myPath} oncomplete={() => (isActive = false)} />
{:else}
  <button onclick={() => (isActive = true)}>Try Again</button>
{/if}
```

**Angular:**
```html
@if (isActive) {
  <pw-shell [path]="myPath" (completed)="isActive = false"></pw-shell>
} @else {
  <button (click)="isActive = true">Try Again</button>
}
```

Use this pattern when you want the entire component tree to start fresh. For most form and wizard reset flows this is the right choice.

---

**Option 2 — Call `restart()` on the shell ref** (Angular, Vue, Svelte)

Call `restart()` on a shell component reference to reset the path engine in-place, without unmounting the component. The path restarts from step 1 with the original `initialData`. Child component state and DOM scroll position are preserved.

**Angular** — `#shell` already gives a component reference:

```html
<pw-shell #shell [path]="myPath" (completed)="onDone($event)">
  <ng-template pwStep="details"><app-details-form /></ng-template>
</pw-shell>

<button (click)="shell.restart()">Try Again</button>
```

**Vue:**
```vue
<script setup>
import { ref } from 'vue';
const shellRef = ref();
</script>

<template>
  <PathShell ref="shellRef" :path="myPath" @complete="onDone">
    <template #details><DetailsForm /></template>
  </PathShell>

  <button @click="shellRef.restart()">Try Again</button>
</template>
```

**Svelte:**
```svelte
<script>
  let shellRef;
</script>

<PathShell bind:this={shellRef} path={myPath} oncomplete={onDone}>
  {#snippet details()}<DetailsForm />{/snippet}
</PathShell>

<button onclick={() => shellRef.restart()}>Try Again</button>
```

**React** does not expose `restart()` on a ref because function components have no instance. Use the `key` prop pattern above — it is equally clean and achieves the same result.

Use this pattern when you need to keep the shell mounted (e.g. to preserve a parent scroll position, or to drive a CSS transition on the shell element itself).

---

**Restarting from inside a step component**

`restart()` is also available through the context API from within any step component:

```tsx
// React — requires the path definition
const { restart } = usePathContext();
restart(myPath, initialData);
```

```ts
// Vue — requires the path definition
const { restart } = usePathContext();
restart(myPath, initialData);
```

```ts
// Svelte — no-arg, already bound to the shell's current path and initialData
const { restart } = getPathContext();
restart();
```

```ts
// Angular
const facade = inject(PathFacade);
facade.restart(myPath, initialData);
```

### Styling with CSS custom properties

Import the optional stylesheet from your adapter package for sensible defaults. Every visual value is a CSS custom property, so you can theme without overriding selectors:

**React / Vue / Svelte** — import in your entry file or global stylesheet:
```css
@import "@daltonr/pathwrite-react/styles.css";
/* or */
@import "@daltonr/pathwrite-vue/styles.css";
/* or */
@import "@daltonr/pathwrite-svelte/styles.css";
```

**Angular** — add to the `styles` array in `angular.json`:
```json
"styles": [
  "src/styles.css",
  "node_modules/@daltonr/pathwrite-angular/dist/index.css"
]
```

**Theming:**
```css
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
| `--pw-color-error` | `#dc2626` | Validation message text colour. |
| `--pw-color-error-bg` | `#fef2f2` | Validation message background. |
| `--pw-color-error-border` | `#fecaca` | Validation message border colour. |
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
| `.pw-shell__root-progress` | Root (top-level) progress bar, visible during sub-paths. |
| `.pw-shell__header` | Progress indicator wrapper (shows the active path's steps). |
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
| `.pw-shell__validation` | Validation message list (hidden when empty). |
| `.pw-shell__validation-item` | Individual validation message. |
| `.pw-shell__footer` | Navigation button bar. |
| `.pw-shell__footer-left` | Left side of footer (Back). |
| `.pw-shell__footer-right` | Right side of footer (Cancel, Next). |
| `.pw-shell__btn` | Base button class. |
| `.pw-shell__btn--back` | Back button — outlined secondary style (transparent bg, primary border + text). |
| `.pw-shell__btn--next` | Next / Complete button — primary filled style. |
| `.pw-shell__btn--cancel` | Cancel button — ghost style (no border, muted text). |

#### Customising the sub-path progress bar

By default, root progress and sub-path progress merge into a single card (the
sub-path portion is compact and faded). Override with plain CSS:

```css
/* Separate cards instead of merged */
.pw-shell__root-progress + .pw-shell__header {
  margin-top: 0;
  border-radius: var(--pw-shell-radius);
}
.pw-shell__root-progress:has(+ .pw-shell__header) {
  border-radius: var(--pw-shell-radius);
}

/* Hide the sub-path bar entirely — only show the root */
.pw-shell__root-progress + .pw-shell__header { display: none; }

/* Hide the root bar — revert to pre-0.7 behaviour */
.pw-shell__root-progress { display: none; }
```

Or replace the header entirely using the adapter's custom header mechanism
(`renderHeader`, `#header` slot, `pwShellHeader`, or `header` snippet) and use
`snapshot.rootProgress` to render both bars however you like.

### When to use the shell vs. going headless

| Scenario | Use |
|---|---|
| Quick prototype, internal tool, standard wizard layout | Default shell — define steps and go. |
| Custom design system, non-linear layout, complex animations | Headless API — build your own UI from the snapshot. |
| Need to override just the header or footer | Shell with `renderHeader` / `renderFooter` (React) or scoped slots (Vue). |

The shell and the headless API are not mutually exclusive. You can start with `<PathShell>` and migrate individual sections (or the entire component) to custom markup whenever you need more control.

### Cross-adapter API equivalence

The four shell components follow their framework's idiomatic conventions, so props, events, and context access patterns look different even when they do the same thing. This table maps each concept across all four frameworks:

#### Shell component name

| Angular | React | Vue | Svelte |
|---------|-------|-----|--------|
| `<pw-shell>` | `<PathShell>` | `<PathShell>` | `<PathShell>` |

#### Completion and cancellation callbacks

| Concept | Angular | React | Vue | Svelte |
|---------|---------|-------|-----|--------|
| Path complete | `(completed)="fn($event)"` | `onComplete={fn}` | `@complete="fn"` | `oncomplete={fn}` |
| Path cancelled | `(cancelled)="fn($event)"` | `onCancel={fn}` | `@cancel="fn"` | `oncancel={fn}` |
| Every event | `(pathEvent)="fn($event)"` | `onEvent={fn}` | `@event="fn"` | `onevent={fn}` |

#### Step content wiring

| Concept | Angular | React | Vue | Svelte |
|---------|---------|-------|-----|--------|
| Register a step | `<ng-template pwStep="id">` | `steps={{ id: <Comp /> }}` | `<template #id>` | `{#snippet id()}` |
| Custom header | `pwShellHeader` directive | `renderHeader={fn}` | `<template #header="{ snapshot }">` | `{#snippet header(snapshot)}` |
| Custom footer | `pwShellFooter` directive | `renderFooter={fn}` | `<template #footer="{ snapshot, actions }">` | `{#snippet footer(snapshot, actions)}` |

#### Accessing the engine from a step component

| Concept | Angular | React | Vue | Svelte |
|---------|---------|-------|-----|--------|
| Get engine in step | `injectPath<T>()` | `usePathContext<T>()` | `usePathContext<T>()` | `getPathContext<T>()` |
| Snapshot | `path.snapshot()` (Signal) | `snapshot` (state) | `snapshot.value` (Ref) | `ctx.snapshot` (rune) |
| Advance | `path.next()` | `next()` | `next()` | `ctx.next()` |
| Update data | `path.setData(key, val)` | `setData(key, val)` | `setData(key, val)` | `ctx.setData(key, val)` |


---

## 15. Using the Core Engine Directly

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
| `restart(def, data?)` | `Promise<void>` | Tear down any active path (without firing hooks) and start fresh. Safe at any time. |
| `startSubPath(def, data?, meta?)` | `Promise<void>` | Push sub-path. Throws if no path is active. `meta` is returned unchanged to `onSubPathComplete` / `onSubPathCancel`. |
| `next()` | `Promise<void>` | Advance. Completes path past the last step. |
| `previous()` | `Promise<void>` | Go back. No-op when already on the first step of a top-level path. Pops a sub-path back to its parent. |
| `cancel()` | `Promise<void>` | Cancel. Pops sub-path silently; completes top-level with `cancelled` event. |
| `setData(key, value)` | `Promise<void>` | Update one data value. Emits `stateChanged`. |
| `resetStep()` | `Promise<void>` | Revert the current step's data to what it was when the step was entered. Emits `stateChanged`. |
| `goToStep(stepId)` | `Promise<void>` | Jump to step by ID. Calls `onLeave`/`onEnter`; bypasses guards and `shouldSkip`. |
| `goToStepChecked(stepId)` | `Promise<void>` | Jump to a step by ID, checking `canMoveNext` (forward) or `canMovePrevious` (backward) first. Navigation is blocked if the guard returns false. |
| `snapshot()` | `PathSnapshot \| null` | Synchronous snapshot read. |
| `subscribe(listener)` | `() => void` | Subscribe to events. Returns the unsubscribe function. |

All navigation methods return a `Promise`. If `isNavigating` is `true` when a navigation method is called, it returns immediately (concurrent navigation is debounced automatically).

---

## 16. TypeScript Generics

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

### Adapter-level generics

The React, Vue, and Svelte adapters also accept an optional generic on `usePath`, `usePathContext`, and `getPathContext`. This narrows `snapshot.data` so you can read typed values without manual assertions:

```tsx
// React
const { snapshot, setData } = usePath<CourseData>();
snapshot?.data.courseName; // string — no cast needed

// Vue
const { snapshot, setData } = usePath<CourseData>();
snapshot.value?.data.courseName; // string — no cast needed

// Svelte
const path = usePath<CourseData>();
path.snapshot?.data.courseName; // string — no cast needed
```

The Angular adapter uses a generic on `PathFacade` itself. Because `PathFacade` is injected via Angular's DI (which cannot carry generics at runtime), narrow it with a cast at the injection site:

```typescript
// Angular
const facade = inject(PathFacade) as PathFacade<CourseData>;
facade.snapshot()?.data.courseName; // string — no cast needed

// Or declare the field typed from the start:
protected readonly facade = inject(PathFacade) as PathFacade<CourseData>;
protected readonly snapshot = this.facade.stateSignal; // Signal<PathSnapshot<CourseData> | null>
```

`setData` is also typed against `TData` — both the key and value are checked at compile time:

```tsx
setData("courseName", 42);       // ✗ TS error: number is not assignable to string
setData("typo", "x");            // ✗ TS error: "typo" is not a key of CourseData
setData("courseName", "Biology"); // ✓
```

The generic is a **type-level assertion** — it narrows `snapshot.data` and `setData` for convenience but is not enforced at runtime. Define your data shape once in a `PathDefinition<TData>` and use the same generic at the adapter level to keep the types consistent throughout.

### Accessing typed data in step components

Step components are only rendered while `PathShell` has a non-null snapshot. This means `snapshot` (or `snapshot()` in Angular) is **guaranteed non-null** inside any step component. Use a non-null assertion (`!`) instead of optional chaining with a fallback — it eliminates casts entirely.

**Angular** — `injectPath<T>()` with `snapshot()!.data`:

```typescript
export class PersonalInfoStepComponent {
  protected readonly path = injectPath<OnboardingData>();

  // snapshot()! is safe — PathShell guarantees non-null while mounted.
  // The generic narrows .data to OnboardingData; no cast needed.
  protected get data(): OnboardingData {
    return this.path.snapshot()!.data;
  }
}
```

**React** — `usePathContext<T>()` with `snapshot!`:

```tsx
function PersonalInfoStep() {
  const { snapshot, setData } = usePathContext<OnboardingData>();
  // snapshot! is safe — PathShell only renders this component when active.
  const data = snapshot!.data;          // OnboardingData — no cast needed
  const name = data.firstName;          // string
  setData("firstName", "Alice");        // key and value are type-checked
}
```

**Vue** — `usePathContext<T>()` with `snapshot.value` inside `v-if`:

```vue
<script setup lang="ts">
const { snapshot, setData } = usePathContext<OnboardingData>();
</script>

<template>
  <!-- Inside v-if="snapshot", snapshot is non-null -->
  <div v-if="snapshot">
    <input :value="snapshot.data.firstName"
           @input="setData('firstName', ($event.target as HTMLInputElement).value)" />
  </div>
</template>
```

**Svelte** — `getPathContext<T>()` with `{#if ctx.snapshot}`:

```svelte
<script lang="ts">
  const ctx = getPathContext<OnboardingData>();
</script>

{#if ctx.snapshot}
  <!-- ctx.snapshot.data is OnboardingData — dot notation works -->
  <input value={ctx.snapshot.data.firstName}
         oninput={(e) => ctx.setData("firstName", e.currentTarget.value)} />
{/if}
```

> **Why not `?? {}` with a cast?** The pattern `snapshot?.data ?? {} as T` produces
> a union type (`T | {}`) that TypeScript cannot automatically narrow, forcing an
> `as T` cast. Since PathShell guarantees a non-null snapshot for step content, the
> `!` assertion is both safer (it will throw at runtime if the assumption is ever
> violated) and cleaner (no cast needed).

**Passing typed path definitions to `start()` and `startSubPath()`**: All adapters
accept `PathDefinition<any>` at their public boundaries, so a typed
`PathDefinition<CourseData>` can be passed directly — no cast required:

```typescript
const path: PathDefinition<CourseData> = { id: "course", steps: [...] };

// All of these work without any cast:
await facade.start(path);                    // Angular
await engine.start(path);                    // core
const { start } = usePath<CourseData>();     // React / Vue
start(path);

// Angular shell — [path] input also accepts PathDefinition<any>
// <pw-shell [path]="path">...</pw-shell>
```

**Non-generic users are unaffected.** When no type argument is supplied, `TData` defaults to `PathData` (`Record<string, unknown>`), and `setData` collapses to `(key: string, value: unknown) => void` — identical to before.

---

## 17. Backend Lifecycle Patterns

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

## 18. Testing

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

`PathFacade` is a plain `@Injectable` service with no component dependencies, so
it can be tested with or without `TestBed`. Because the adapter is now compiled
with `ngc` (emitting full Ivy metadata), it also works in `TestBed` integration
tests that include the shell components.

**Unit testing `PathFacade` directly (no TestBed needed):**

```typescript
it("emits completed after the last step", async () => {
  const facade = new PathFacade();
  const events: PathEvent[] = [];
  facade.events$.subscribe((e) => events.push(e));

  await facade.start(myPath);
  await facade.next();
  await facade.next();

  expect(events.some((e) => e.type === "completed")).toBe(true);
  facade.ngOnDestroy();
});
```

**Integration testing with `TestBed`:**

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
import { PathShell } from "@daltonr/pathwrite-react";

afterEach(() => cleanup());

it("renders step content and navigates", async () => {
  const path = { id: "test", steps: [{ id: "a", title: "A" }, { id: "b", title: "B" }] };
  const steps = {
    a: createElement("div", null, "Content A"),
    b: createElement("div", null, "Content B"),
  };
  await act(async () =>
    render(createElement(PathShell, { path, steps }))
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
import { PathShell } from "@daltonr/pathwrite-vue";

it("renders step content and navigates", async () => {
  const path = { id: "test", steps: [{ id: "a", title: "A" }, { id: "b", title: "B" }] };
  const Host = defineComponent({
    setup: () => () =>
      h(PathShell, { path }, {
        a: () => h("div", "Content A"),
        b: () => h("div", "Content B"),
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

### Testing with the Svelte adapter

The Svelte adapter uses `onDestroy` for cleanup, which requires a component context. In unit tests, mock Svelte's lifecycle to capture and control cleanup:

```typescript
import { vi, beforeEach, describe, it, expect } from "vitest";

let destroyCallbacks: Array<() => void> = [];

vi.mock("svelte", async () => {
  const actual = await vi.importActual<typeof import("svelte")>("svelte");
  return {
    ...actual,
    onDestroy: (fn: () => void) => { destroyCallbacks.push(fn); },
    getContext: () => undefined,
    setContext: () => {},
  };
});

import { usePath } from "@daltonr/pathwrite-svelte";

beforeEach(() => { destroyCallbacks = []; });

it("advances to the next step", async () => {
  const path = usePath();
  await path.start({ id: "test", steps: [{ id: "a" }, { id: "b" }] });
  expect(path.snapshot?.stepId).toBe("a");
  await path.next();
  expect(path.snapshot?.stepId).toBe("b");
});

it("cleans up on destroy", async () => {
  const path = usePath();
  await path.start({ id: "test", steps: [{ id: "a" }] });
  expect(destroyCallbacks).toHaveLength(1);
  destroyCallbacks[0](); // simulate component unmount
});
```

> **Why mock `onDestroy`?** `usePath()` calls `onDestroy()` internally, which requires a running component context. Mocking it lets you test the adapter's logic without mounting a Svelte component.

### Testing the Svelte shell

Because Svelte 5 components require the Svelte compiler, shell integration tests typically run within a Vite-based test setup with the Svelte plugin. For unit tests that don't need the rendered component, mock the `.svelte` import:

```typescript
vi.mock("../src/PathShell.svelte", () => ({ default: {} }));
```

For full integration tests, use a test runner configured with `@sveltejs/vite-plugin-svelte` and test the shell by mounting it in a DOM environment.

---

## 19. Design Decisions

### Headless first, shells optional
Pathwrite owns no HTML or CSS at its core. The snapshot gives you everything you need to render a path; how you render it is entirely up to you. The engine works equally well driving a UI wizard, a backend document lifecycle, or any ordered state transition with constraints. The optional shell components are a convenience layer — they use the same public API you would use to build custom UI.

### Steps are states
A "step" is just an ordered state with optional guards and hooks. This abstraction maps naturally to lifecycle states (Draft → Review → Approved → Published), but also to wizard steps, pipeline stages, or onboarding phases. `goToStep` enables non-linear transitions (e.g. rejection), and `shouldSkip` handles conditional routing.

### Data is the source of truth
All path data lives in `data`. There is no separate "form model" — `data` is the form model. Guards and hooks read from `data` and return patches to update it. Data flow is unidirectional and auditable.

### Hooks return patches, not mutations
`ctx.data` is a read-only copy. Hooks return a `Partial<TData>` patch; the engine applies it. This prevents accidental mutations and makes hook behaviour easy to test in isolation.

### Async-first API
All navigation methods return `Promise<void>` even when synchronous. Concurrent calls while `isNavigating` is `true` are silently dropped.

### Sub-paths are full paths
There is no special "sub-path" type. `startSubPath` pushes the current path onto a stack and starts the provided definition as the new active path. The stack can be arbitrarily deep.

### No RxJS in core
`@daltonr/pathwrite-core` has zero dependencies. The Angular adapter introduces RxJS because Angular apps already depend on it. The React adapter uses only React's built-in `useSyncExternalStore`. The Vue adapter uses only Vue's built-in `shallowRef` and `onScopeDispose`. The Svelte adapter uses only Svelte 5's built-in `$state` runes and `onDestroy`. Each adapter is a thin translation layer from `subscribe` + `snapshot()` into the framework's native reactivity model.

### Shell as an optional layer, not a core feature
The default UI shell components (`<PathShell>` / `<pw-shell>`) are an optional convenience layer exported alongside the headless adapter API. They use the exact same `usePath` / `PathFacade` that you would use to build custom UI. This ensures there is no hidden API — everything the shell does, you can do yourself. The Angular shell is in a separate entry point (`@daltonr/pathwrite-angular/shell`) to avoid pulling the Angular compiler into headless-only imports.

### Unstyled by default, themeable by convention
Shell components render structural HTML with BEM-style `pw-shell__*` CSS classes but include no embedded styles. The optional `shell.css` stylesheet provides sensible defaults using CSS custom properties (`--pw-*`). This means the shell works in any design system — override a few variables to re-theme, or ignore the stylesheet entirely and write your own CSS targeting the same classes.

---

## 20. Observers & Persistence

### PathObserver

A `PathObserver` is a plain function registered at engine construction time:

```typescript
type PathObserver = (event: PathEvent, engine: PathEngine) => void;
```

Observers are wired **before** the first event fires and run for the engine's lifetime. They cannot be removed — for removable one-off listeners use `engine.subscribe()`.

The second argument is the engine itself, giving the observer access to `engine.exportState()`, `engine.snapshot()`, etc.

```typescript
const logger: PathObserver = (event) =>
  console.log(`[wizard] ${event.type}`, 'cause' in event ? event.cause : "");

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

### Serialization

`engine.exportState()` returns a `SerializedPathState | null` — the full current state as a plain JSON-serializable object: step position, data, visited steps, and any sub-path stack.

`PathEngine.fromState(state, pathDefinitions, options?)` reconstructs a working engine from saved state. Pass `options.observers` to wire observers on the restored engine exactly as you would on a fresh one:

```typescript
const saved = await store.load(key);
const engine = PathEngine.fromState(saved, { [path.id]: path }, {
  observers: [httpPersistence({ store, key })],
});
// engine is already on the correct step — no start() needed
```

### HTTP persistence

`@daltonr/pathwrite-store-http` provides `httpPersistence()` — an observer factory that saves state to a REST API based on a configurable strategy:

```typescript
import { HttpStore, httpPersistence, restoreOrStart } from "@daltonr/pathwrite-store-http";

const store = new HttpStore({ baseUrl: "/api/wizard" });
const key = "user:123:onboarding";

// Lower-level: wire manually
const engine = new PathEngine({
  observers: [httpPersistence({ store, key })],
});
await engine.start(myPath, initialData);

// Higher-level: one-call convenience
const { engine, restored } = await restoreOrStart({
  store,
  key,
  path: myPath,
  initialData: { name: "", email: "" },
  observers: [httpPersistence({ store, key })],
});
```

#### Persistence strategies

The `strategy` option controls when the observer saves state to your backend. The default is `"onNext"`.

##### Available strategies

| Strategy | Saves when | Best for |
|---|---|---|
| `"onNext"` *(default)* | After `next()` navigation completes | Multi-step forms (1 save per step) |
| `"onEveryChange"` | Every settled `stateChanged` event | Real-time autosave (use with `debounceMs`) |
| `"onSubPathComplete"` | A sub-path completes and the parent resumes | Nested wizard checkpoints |
| `"onComplete"` | The path completes | Audit trail / final submission only |
| `"manual"` | Never — you call `store.save()` yourself | Custom save logic |

##### Strategy examples

**`"onNext"` — save after each navigation (default)**

```typescript
httpPersistence({ store, key: "user:123:onboarding" })
// Saves once after each next() navigation settles
```

User flow: types "Hello" (5 keystrokes) → clicks Next → **1 save**.

**`"onEveryChange"` — save on every state change**

```typescript
httpPersistence({ store, key: "user:123:wizard", strategy: "onEveryChange" })
// Saves on every setData(), every navigation, every sub-path completion
```

User flow: types "Hello" → **5 saves** (one per keystroke) → clicks Next → **1 more save** = **6 total**.

For text inputs, add a debounce to avoid flooding the API:

```typescript
httpPersistence({
  store,
  key: "user:123:wizard",
  strategy: "onEveryChange",
  debounceMs: 500,  // waits 500ms after last change before saving
})
```

User flow: types "Hello" → pauses → **1 save** (after 500ms idle) → clicks Next → **1 save** = **2 total**.

**`"onSubPathComplete"` — save when sub-paths finish**

```typescript
httpPersistence({ store, key: "user:123:wizard", strategy: "onSubPathComplete" })
// Only saves when a sub-path completes and the parent resumes
```

Useful for wizards where each sub-flow represents a meaningful checkpoint.

**`"onComplete"` — save only the final result**

```typescript
httpPersistence({ store, key: "user:123:wizard", strategy: "onComplete" })
// No mid-flow saves — only saves when the path completes
```

Use when you only care about the final submitted data, not in-progress state. The saved record persists after completion (not deleted) for audit/review purposes.

**`"manual"` — full control**

```typescript
httpPersistence({ store, key: "user:123:wizard", strategy: "manual" })
// Never auto-saves. Call store.save(key, engine.exportState()!) yourself
```

##### Choosing a strategy

| Your wizard has... | Use | Why |
|---|---|---|
| Text-heavy forms | `"onNext"` | 1 save per step, no debounce needed |
| Dropdowns / checkboxes only | `"onNext"` or `"onEveryChange"` | Each change is deliberate |
| Text inputs + crash protection needed | `"onEveryChange"` + `debounceMs: 500` | Saves while typing without flooding API |
| Nested sub-flows | `"onSubPathComplete"` | Save at meaningful checkpoints |
| Final submission only | `"onComplete"` | Audit trail / record-keeping |
| Custom save logic | `"manual"` | Full control over when saves occur |

##### Debugging save timing

Use callbacks to observe when saves happen:

```typescript
httpPersistence({
  store,
  key: "user:123:wizard",
  strategy: "onEveryChange",
  debounceMs: 500,
  onSaveSuccess: () => console.log(`[${new Date().toISOString()}] Saved`),
  onSaveError: (err) => console.error("Save failed:", err.message),
})
```

Or add a logging observer alongside persistence:

```typescript
const engine = new PathEngine({
  observers: [
    httpPersistence({ store, key }),
    (event) => console.log(`[wizard] ${event.type}`, 'cause' in event ? event.cause : ""),
  ],
});
```

For detailed API call counts and timing diagrams, see `PERSISTENCE_STRATEGY_GUIDE.md`.

### Advanced Patterns: Multi-Store Scenarios

Because `restoreOrStart` and `httpPersistence` accept any `PathStore` implementation, you can load from one backend and save to another. This enables several useful patterns:

#### Migration: read from old backend, write to new

```typescript
const legacyStore = new HttpStore({ baseUrl: "/api/v1" });
const newStore = new HttpStore({ baseUrl: "/api/v2" });

const { engine } = await restoreOrStart({
  store: legacyStore,  // restore from v1 API if state exists
  key: "user:123:onboarding",
  path: myPath,
  observers: [
    httpPersistence({ store: newStore, key: "user:123:onboarding" })  // all future saves go to v2
  ],
});
```

On the first load, existing state is read from the legacy API. All subsequent saves go to the new API. Once all users have been migrated, the legacy read path can be removed.

#### Performance: read from cache, write to both cache and persistent storage

```typescript
const cache = new RedisStore({ host: "localhost" });
const persistent = new MongoStore({ uri: "mongodb://..." });

const { engine } = await restoreOrStart({
  store: cache,  // fast load from Redis
  key: "user:123:onboarding",
  path: myPath,
  observers: [
    httpPersistence({ store: cache, key: "user:123:onboarding" }),        // keep cache fresh
    httpPersistence({ store: persistent, key: "user:123:onboarding" }),   // backup to MongoDB
  ],
});
```

Two observers means every state change is saved to both stores. The load path checks only the cache (fast). If cache misses, you can fall back to `persistent.load()` before calling `restoreOrStart`.

#### Offline-first: read from server, write locally

```typescript
const remote = new HttpStore({ baseUrl: "/api/forms" });
const local = new LocalStorageStore();

const { engine } = await restoreOrStart({
  store: remote,  // try to load from server first (may fail if offline)
  key: "user:123:onboarding",
  path: myPath,
  observers: [
    httpPersistence({ store: local, key: "user:123:onboarding" }),  // save to localStorage
  ],
});
```

State is always saved locally. On next page load, you can reverse the pattern: load from `local` (always available), save to both `local` and `remote` (when online).

---

## 21. Forms with Pathwrite

While Pathwrite excels at multi-step wizards, it's also a powerful choice for **single-step forms**. A path with one step gives you field-level validation, automatic error handling, crash recovery, and consistent cross-framework APIs — without learning a separate form library.

### Why use Pathwrite for forms?

✅ **Type-safe data binding** with TypeScript generics  
✅ **Field-level validation** with automatic error rendering  
✅ **Smart error timing** (show after first submit attempt)  
✅ **Auto-persistence** with crash recovery (HTTP stores)  
✅ **Consistent API** across React, Vue, Svelte, Angular  
✅ **Zero configuration** for common behaviors  
✅ **Event streaming** for analytics and side effects  

### Quick Start

A single-step `PathDefinition` is all you need:

```typescript
const contactForm: PathDefinition = {
  id: "contact-form",
  steps: [{
    id: "contact",
    title: "Contact Us",
    fieldErrors: ({ data }) => ({
      name:    !data.name?.trim()              ? "Name is required."          : undefined,
      email:   !data.email?.includes("@")     ? "Valid email address required." : undefined,
      message: !data.message?.trim()          ? "Message is required."        : undefined,
    })
    // No canMoveNext needed — auto-derived from fieldErrors (see below)
  }]
};
```

> **`canMoveNext` is auto-derived from `fieldErrors`.** When `fieldErrors` is defined
> and `canMoveNext` is not, the engine treats the step as valid (allows navigation) when
> every field message is `undefined`, and blocks navigation when any message is non-empty.
>
> This means you never need to duplicate the "all fields must be valid" logic in a separate
> `canMoveNext` — one function does both. Only define `canMoveNext` explicitly when your
> guard differs from "all fields valid" (e.g. an additional async server check).

**React:**
```tsx
<PathShell 
  path={contactForm} 
  initialData={{ name: "", email: "", message: "" }}
  onComplete={(data) => submitToBackend(data)}
/>
```

**Vue:**
```vue
<PathShell 
  :path="contactForm" 
  :initial-data="{ name: '', email: '', message: '' }"
  @complete="submitToBackend"
>
  <template #contact>
    <ContactFormFields />
  </template>
</PathShell>
```

**Angular:**
```html
<pw-shell [path]="contactForm" [initialData]="{}" (completed)="submit($event)">
  <ng-template pwStep="contact">
    <app-contact-form />
  </ng-template>
</pw-shell>
```

**Svelte:**
```svelte
<PathShell 
  path={contactForm} 
  initialData={{ name: "", email: "", message: "" }}
  oncomplete={submitToBackend}
>
  {#snippet contact()}
    <ContactFormFields />
  {/snippet}
</PathShell>
```

### What you get automatically

With the code above, single-step forms **automatically**:

1. **Hide the progress indicator** (no "Step 1 of 1" clutter)
2. **Use form-style footer** (Cancel on left, Submit on right)
3. **Block submission while invalid** (canMoveNext derived from fieldErrors)
4. **Hide errors initially** (shown after first submit attempt via hasAttemptedNext)
5. **Render field errors with labels** (camelCase → Title Case: "firstName" → "First Name")
6. **Disable submit during validation** (isNavigating flag)

**Auto-detection rule:** When `stepCount === 1 && nestingLevel === 0`, the shell assumes form mode.

Override when needed:
```tsx
<PathShell 
  path={form}
  hideProgress={false}       // Force show progress
  footerLayout="wizard"      // Force wizard layout
/>
```

### Field Validation Patterns

#### Basic Validation

```typescript
fieldErrors: ({ data }) => ({
  email: !data.email?.includes("@") ? "Invalid email" : undefined,
  age: (data.age < 18) ? "Must be 18 or older" : undefined,
  terms: !data.terms ? "You must accept the terms" : undefined
})
```

#### Multiple Errors per Field

Return the first error encountered:

```typescript
fieldErrors: ({ data }) => ({
  password: !data.password 
    ? "Password is required"
    : data.password.length < 8
    ? "Password must be at least 8 characters"
    : !/[A-Z]/.test(data.password)
    ? "Password must contain an uppercase letter"
    : undefined
})
```

#### Form-Level Errors

Use `"_"` as the key for errors that don't belong to a specific field:

```typescript
fieldErrors: ({ data }) => ({
  _: data.password !== data.confirmPassword 
    ? "Passwords do not match" 
    : undefined
})
```

The shell renders this without a label.

#### Conditional Validation

Only validate certain fields based on other fields:

```typescript
fieldErrors: ({ data }) => ({
  country: !data.country ? "Required" : undefined,
  state: data.country === "US" && !data.state 
    ? "State is required for US addresses" 
    : undefined,
  province: data.country === "CA" && !data.province 
    ? "Province is required for Canadian addresses" 
    : undefined
})
```

#### Async Validation

For async validation (checking username availability, validating addresses, etc.), perform it in `canMoveNext` and store the result in `data`:

```typescript
{
  id: "signup",
  fieldErrors: ({ data }) => ({
    username: !data.username ? "Required" : undefined,
    _: data.usernameAvailable === false ? "Username is already taken" : undefined
  }),
  canMoveNext: async ({ data }) => {
    if (!data.username) return false;
    
    // Check availability (only if not already checked)
    if (data.usernameAvailable === undefined) {
      const available = await checkUsernameAvailability(data.username);
      // Update data with result
      await engine.setData("usernameAvailable", available);
      return available;
    }
    
    return data.usernameAvailable !== false;
  }
}
```

### Using Form Data in Step Templates

Access and update form data via context:

**React:**
```tsx
function ContactFormFields() {
  const { snapshot, setData } = usePathContext();
  
  return (
    <>
      <input 
        value={snapshot.data.name || ""} 
        onChange={(e) => setData("name", e.target.value)}
        className={snapshot.fieldErrors.name ? "error" : ""}
      />
      {snapshot.hasAttemptedNext && snapshot.fieldErrors.name && (
        <span className="error">{snapshot.fieldErrors.name}</span>
      )}
      
      <input 
        value={snapshot.data.email || ""} 
        onChange={(e) => setData("email", e.target.value)}
      />
      {snapshot.hasAttemptedNext && snapshot.fieldErrors.email && (
        <span className="error">{snapshot.fieldErrors.email}</span>
      )}
    </>
  );
}
```

**Vue:**
```vue
<script setup>
const { snapshot, setData } = usePathContext();
</script>

<template>
  <input 
    :value="snapshot.data.name || ''" 
    @input="setData('name', $event.target.value)"
    :class="{ error: snapshot.fieldErrors.name }"
  />
  <span v-if="snapshot.hasAttemptedNext && snapshot.fieldErrors.name" class="error">
    {{ snapshot.fieldErrors.name }}
  </span>
</template>
```

**Svelte:**
```svelte
<script lang="ts">
  import { getPathContext } from '@daltonr/pathwrite-svelte';

  const ctx = getPathContext();
</script>

{#if ctx.snapshot}
  <input
    value={ctx.snapshot.data.name || ''}
    oninput={(e) => ctx.setData('name', e.currentTarget.value)}
    class={ctx.snapshot.fieldErrors.name ? 'error' : ''}
  />
  {#if ctx.snapshot.hasAttemptedNext && ctx.snapshot.fieldErrors.name}
    <span class="error">{ctx.snapshot.fieldErrors.name}</span>
  {/if}

  <input
    value={ctx.snapshot.data.email || ''}
    oninput={(e) => ctx.setData('email', e.currentTarget.value)}
  />
  {#if ctx.snapshot.hasAttemptedNext && ctx.snapshot.fieldErrors.email}
    <span class="error">{ctx.snapshot.fieldErrors.email}</span>
  {/if}
{/if}
```

### Default Values and Data Initialization

Use `onEnter` to set defaults or fetch initial data:

```typescript
{
  id: "profile",
  onEnter: async ({ data, isFirstEntry }) => {
    // Only fetch on first entry, not when navigating back
    if (isFirstEntry) {
      const user = await fetchCurrentUser();
      return {
        name: user.name,
        email: user.email,
        phone: user.phone || ""  // Provide default for optional fields
      };
    }
  },
  fieldErrors: ({ data }) => ({
    name: !data.name ? "Required" : undefined,
    email: !data.email?.includes("@") ? "Invalid email" : undefined
  })
}
```

### Multi-Section Forms (Still Single-Step)

You can have a complex, multi-section form as a single step by organizing your template:

```typescript
const registrationForm: PathDefinition = {
  id: "registration",
  steps: [{
    id: "signup",
    fieldErrors: ({ data }) => ({
      // Personal info section
      firstName: !data.firstName ? "Required" : undefined,
      lastName: !data.lastName ? "Required" : undefined,
      email: !data.email?.includes("@") ? "Invalid email" : undefined,
      
      // Company info section
      companyName: !data.companyName ? "Required" : undefined,
      role: !data.role ? "Required" : undefined,
      
      // Preferences section
      newsletter: undefined,  // Optional
      notifications: undefined  // Optional
    })
  }]
};
```

Your template can render these in tabs, accordions, or separate sections — it's all one step from Pathwrite's perspective.

### When NOT to use Pathwrite for forms

Consider traditional form libraries when:

❌ **Very simple forms** (1-2 fields, no validation)  
❌ **Deeply nested field structures** (arrays of objects with arrays)  
❌ **Need field-level touched/dirty tracking** per field (Pathwrite has step-level `hasAttemptedNext`)  
❌ **Complex field dependencies** (use specialized form libraries)  

**Better for Pathwrite:**

✅ Forms with 5+ fields and validation  
✅ Forms that need crash recovery / auto-save  
✅ Forms that are part of a larger wizard  
✅ Forms that need consistency across frameworks  
✅ Forms with async validation or external API calls  

### Integration with Existing Form Libraries

You can use Pathwrite alongside traditional form libraries by storing the form library's state in Pathwrite's data:

```typescript
// React Hook Form + Pathwrite
function MyForm() {
  const { snapshot, setData } = usePathContext();
  const { register, handleSubmit, formState } = useForm({
    defaultValues: snapshot.data.formState || {}
  });
  
  // Sync form state to Pathwrite for persistence
  useEffect(() => {
    setData("formState", formState);
  }, [formState]);
  
  return <form onSubmit={handleSubmit(onSubmit)}>...</form>;
}
```

### Complete Example with Persistence

A production-ready form with auto-save:

```typescript
// form-definition.ts
export const contactForm: PathDefinition = {
  id: "contact-form",
  steps: [{
    id: "contact",
    title: "Contact Us",
    onEnter: ({ isFirstEntry }) => {
      // Set defaults only on first entry
      if (isFirstEntry) {
        return {
          name: "",
          email: "",
          message: "",
          subscribe: false
        };
      }
    },
    fieldErrors: ({ data }) => ({
      name: !data.name?.trim() ? "Name is required" : undefined,
      email: !data.email?.includes("@") ? "Valid email address required" : undefined,
      message: !data.message?.trim() 
        ? "Message is required" 
        : data.message.length < 10
        ? "Message must be at least 10 characters"
        : undefined
    })
  }]
};

// React component
import { PathShell } from "@daltonr/pathwrite-react";
import { HttpStore, httpPersistence } from "@daltonr/pathwrite-store-http";

function ContactPage() {
  const store = new HttpStore({ baseUrl: "/api/forms" });
  const userId = getCurrentUserId();
  
  const engine = useMemo(() => {
    const eng = new PathEngine({
      observers: [
        httpPersistence({
          store,
          key: `contact:${userId}`,
          strategy: "onEveryChange",
          debounceMs: 1000  // Auto-save after 1 second of inactivity
        })
      ]
    });
    return eng;
  }, [userId]);
  
  const handleComplete = async (data: PathData) => {
    try {
      await submitContactForm(data);
      toast.success("Message sent!");
      // Clear the saved draft
      await store.delete(`contact:${userId}`);
    } catch (error) {
      toast.error("Failed to send message");
    }
  };
  
  return (
    <PathShell
      engine={engine}
      path={contactForm}
      initialData={{}}
      onComplete={handleComplete}
      hideCancel={true}  // No cancel needed for standalone forms
    >
      {/* Step content */}
    </PathShell>
  );
}
```

### Form Styling Tips

The shell renders validation messages with these CSS classes:

```css
.pw-shell__validation {
  /* Validation message container */
}

.pw-shell__validation-item {
  /* Individual validation message */
}

.pw-shell__validation-label {
  /* Field name label (e.g., "Email:") */
}
```

Hide the automatic shell validation and render inline instead:

```css
.pw-shell__validation {
  display: none;
}
```

Then in your template:
```tsx
<input 
  value={snapshot.data.email} 
  onChange={(e) => setData("email", e.target.value)}
/>
{snapshot.hasAttemptedNext && snapshot.fieldErrors.email && (
  <span className="inline-error">{snapshot.fieldErrors.email}</span>
)}
```

### Summary

Forms with Pathwrite give you:

- **One API** for both forms and wizards
- **Auto-detection** for appropriate UI behavior
- **Field validation** with labeled error rendering
- **Smart error timing** (after first submit)
- **Crash recovery** with HTTP stores
- **Cross-framework consistency**
- **Type safety** with generics

For simple forms, the pattern is just as concise as traditional form libraries, but you get persistence, validation, and cross-framework APIs for free.

See also: [Beyond Wizards guide](./BEYOND_WIZARDS.md) for more use cases beyond forms and wizards.

---

© 2026 Devjoy Ltd. MIT License.

