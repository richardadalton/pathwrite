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
19. [Observers & Persistence](#19-observers--persistence)

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
progress bar switches to show the sub-path's step list and `nestingLevel` increments.
The parent path's steps disappear from the progress indicator until the sub-path
completes or is cancelled and the parent is restored.

### Back on the first step of a sub-path

Calling `previous()` (or clicking Back in the shell) when on the **first step of a
sub-path** cancels the sub-path and returns to the parent. `onSubPathCancel` is
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

> **Tip:** `<PathShell>` (see [§13](#13-default-ui-shell)) also provides context automatically — step children rendered inside `<PathShell>` can call `usePathContext()` to access the same engine instance without a separate `<PathProvider>`.

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
| `setData` | `(key, value) => void` | Update a single data value. When `TData` is provided, `key` and `value` are type-checked against your data shape (see [§15](#15-typescript-generics)). |
| `restart` | `(def, data?) => void` | Tear down any active path (without firing hooks) and start the given path fresh. Safe at any time. Use for "Start over" / retry flows. |

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
| `startSubPath` | `(def, data?, meta?) => Promise<void>` | Push a sub-path. The optional `meta` object is passed back to `onSubPathComplete` / `onSubPathCancel`. |
| `next` | `() => Promise<void>` | Advance one step |
| `previous` | `() => Promise<void>` | Go back one step. No-op when already on the first step of a top-level path. |
| `cancel` | `() => Promise<void>` | Cancel the active path or sub-path |
| `goToStep` | `(stepId) => Promise<void>` | Jump to a step by ID. Calls `onLeave`/`onEnter`; bypasses guards and `shouldSkip`. |
| `goToStepChecked` | `(stepId) => Promise<void>` | Jump to a step by ID, checking the current step's guard first. |
| `setData` | `(key, value) => Promise<void>` | Update a single data value. When `TData` is provided, `key` and `value` are type-checked against your data shape (see [§15](#15-typescript-generics)). |
| `restart` | `(def, data?) => Promise<void>` | Tear down any active path (without firing hooks) and start the given path fresh. Safe at any time. Use for "Start over" / retry flows. |

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
- **Angular**: `PathShellComponent` provides `PathFacade` in its own `providers` array
  and passes its component-level `Injector` to every step template via
  `ngTemplateOutletInjector`. Step components can therefore call
  `inject(PathFacade)` directly and receive the same instance the shell uses —
  no additional provider setup needed.

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
  steps={{ a: <StepA />, b: <StepB /> }}
  renderFooter={(snap, { next, previous }) => (
    <div className="my-nav">
      <button onClick={previous}>← Back</button>
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
| `hideProgress` | `boolean` | `false` | Hide the progress indicator. |

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

`actions` contains: `next`, `previous`, `cancel`, `goToStep`, `goToStepChecked`, `setData`, `restart`. All return `Promise<void>`.

### Styling with CSS custom properties

Import the optional stylesheet from your adapter package for sensible defaults. Every visual value is a CSS custom property, so you can theme without overriding selectors:

**React / Vue** — import in your entry file or global stylesheet:
```css
@import "@daltonr/pathwrite-react/styles.css";
/* or */
@import "@daltonr/pathwrite-vue/styles.css";
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
| `.pw-shell__validation` | Validation message list (hidden when empty). |
| `.pw-shell__validation-item` | Individual validation message. |
| `.pw-shell__footer` | Navigation button bar. |
| `.pw-shell__footer-left` | Left side of footer (Back). |
| `.pw-shell__footer-right` | Right side of footer (Cancel, Next). |
| `.pw-shell__btn` | Base button class. |
| `.pw-shell__btn--back` | Back button — outlined secondary style (transparent bg, primary border + text). |
| `.pw-shell__btn--next` | Next / Finish button — primary filled style. |
| `.pw-shell__btn--cancel` | Cancel button — ghost style (no border, muted text). |

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
| `restart(def, data?)` | `Promise<void>` | Tear down any active path (without firing hooks) and start fresh. Safe at any time. |
| `startSubPath(def, data?, meta?)` | `Promise<void>` | Push sub-path. Throws if no path is active. `meta` is returned unchanged to `onSubPathComplete` / `onSubPathCancel`. |
| `next()` | `Promise<void>` | Advance. Completes path past the last step. |
| `previous()` | `Promise<void>` | Go back. No-op when already on the first step of a top-level path. Pops a sub-path back to its parent. |
| `cancel()` | `Promise<void>` | Cancel. Pops sub-path silently; completes top-level with `cancelled` event. |
| `setData(key, value)` | `Promise<void>` | Update one data value. Emits `stateChanged`. |
| `goToStep(stepId)` | `Promise<void>` | Jump to step by ID. Calls `onLeave`/`onEnter`; bypasses guards and `shouldSkip`. |
| `goToStepChecked(stepId)` | `Promise<void>` | Jump to step by ID, checking `canMoveNext` (forward) or `canMovePrevious` (backward) first. Navigation is blocked if the guard returns false. |
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

### Adapter-level generics

The React and Vue adapters also accept an optional generic on `usePath` and `usePathContext`. This narrows `snapshot.data` so you can read typed values without manual assertions:

```tsx
// React
const { snapshot, setData } = usePath<CourseData>();
snapshot?.data.courseName; // string — no cast needed

// Vue
const { snapshot, setData } = usePath<CourseData>();
snapshot.value?.data.courseName; // string — no cast needed
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

---

## 19. Observers & Persistence

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
import { HttpStore, httpPersistence, createPersistedEngine } from "@daltonr/pathwrite-store-http";

const store = new HttpStore({ baseUrl: "/api/wizard" });

// Lower-level: wire manually
const engine = new PathEngine({
  observers: [httpPersistence({ store, key: "user:123:onboarding", strategy: "onNext" })],
});
await engine.start(myPath, initialData);

// Higher-level: one-call convenience
const { engine, restored } = await createPersistedEngine({
  store,
  key: "user:123:onboarding",
  path: myPath,
  initialData: { name: "", email: "" },
  strategy: "onNext",
});
```

`createPersistedEngine` tries to load saved state; if found it restores, if not it starts fresh. It returns `{ engine, restored }` — `restored` is `true` when state was loaded from the server.

### Persistence strategies

| Strategy | Saves when |
|---|---|
| `"onNext"` *(default)* | `next()` completes navigation to a new step |
| `"onEveryChange"` | Any settled `stateChanged` or `resumed` event |
| `"onSubPathComplete"` | A sub-path finishes and the parent resumes |
| `"onComplete"` | The entire path completes |
| `"manual"` | Never — call `store.save()` yourself |

The strategy type is `ObserverStrategy`, exported from `@daltonr/pathwrite-core`. The matching logic is `matchesStrategy(strategy, event)`, also from core.

See `PERSISTENCE_STRATEGY_GUIDE.md` and `AUTO_PERSISTENCE_SUMMARY.md` for details.

### Building your own observer with ObserverStrategy

`ObserverStrategy` and `matchesStrategy` live in core so any observer — not just HTTP persistence — can share the same trigger logic without reimplementing it:

```typescript
import {
  type ObserverStrategy,
  matchesStrategy,
  type PathObserver,
} from "@daltonr/pathwrite-core";

function auditLogObserver(strategy: ObserverStrategy): PathObserver {
  return (event, engine) => {
    if (matchesStrategy(strategy, event)) {
      const state = engine.exportState();
      if (state) auditLog.record(state);
    }
  };
}

const engine = new PathEngine({
  observers: [
    httpPersistence({ store, key: "user:123:onboarding", strategy: "onNext" }),
    auditLogObserver("onComplete"),
    (event) => console.log(`[wizard] ${event.type}`),
  ],
});
```


