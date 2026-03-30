# Architecture

This document explains why Pathwrite is designed the way it is. It is aimed at contributors and developers who want to understand the design decisions before modifying the engine or adding an adapter.

---

## Why headless?

The central design decision is that `@daltonr/pathwrite-core` owns no HTML, no CSS, and no component lifecycle. The engine manages state transitions; everything else is the application's concern.

This is not merely an aesthetic choice. It means:

- The same `PathDefinition` drives a React wizard, an Angular form, a Svelte onboarding flow, and a Node.js backend document lifecycle — without modification.
- Tests do not need a DOM, a browser, or any framework mounting machinery. You import `PathEngine`, call `start()` and `next()`, and assert on `snapshot()`.
- Custom UI is a first-class option, not a workaround. Any UI you can build with the framework's native primitives is achievable with the same API the default shell uses.

The optional `PathShell` components are a convenience layer that uses the same public API you would use if you built custom UI. There is no hidden API.

---

## Immutable snapshots

At any point in time the engine can produce a **snapshot**: a plain JavaScript object describing the current state — step ID, step index, step count, progress percentage, the current data, field errors, and a summary of all steps with their statuses.

Snapshots are value objects. The engine never mutates an in-flight snapshot. Each call to `snapshot()` returns a new object. Guards and hooks receive `ctx.data` as a read-only copy; they return a `Partial<TData>` patch, and the engine applies it. No hook can accidentally mutate shared state by modifying a reference.

This makes snapshot-based code easy to reason about: a snapshot you captured before calling `next()` remains valid after `next()` returns. It also makes testing straightforward — assert on the snapshot after each navigation call.

Snapshots are never reactive proxies. The engine does not use `Proxy`, `Object.defineProperty`, or any getter-based reactivity. Reactivity is the adapter layer's responsibility.

---

## Observer pattern

The engine exposes `subscribe(listener)` and `snapshot()`. That is the entire contract between the engine and the outside world.

An observer is any object that implements the `PathObserver` interface. Observers are registered when the engine is constructed and are called on every state change — after `next()`, after `previous()`, after `goToStep()`, after a sub-path completes, and at completion.

This is how persistence plugs in without touching the engine:

```typescript
const engine = new PathEngine({
  observers: [
    httpPersistence({ store, key, strategy: "onEveryChange" }),
    analyticsObserver,
    auditLogObserver,
  ],
});
```

Persistence strategies (`onEveryChange`, `onNext`, `onSubPathComplete`, `onComplete`, `manual`) are implemented entirely in observer code — the engine knows nothing about them. Adding a new persistence strategy is a matter of writing an observer; the engine does not change.

The same pattern applies to side effects. An analytics observer that fires a tracking event on every step transition is indistinguishable from a persistence observer at the engine level. Both are called after the state change settles.

---

## Stack-based sub-paths

A sub-path is not a special construct in the path definition language. `startSubPath(definition, initialData)` pushes the current engine state onto an internal stack and starts the provided definition as the new active path. The stack can be arbitrarily deep.

When the sub-path completes or is cancelled, the engine pops the stack, restores the parent state, and calls the appropriate hook on the parent step (`onSubPathComplete` or `onSubPathCancel`). The hook returns a data patch that is merged into the parent path's data.

The alternative would have been a nested definition tree — steps that contain sub-paths in their declaration. The stack model was chosen because:

- A sub-path definition is a complete, reusable `PathDefinition`. The same definition can be launched from multiple parent steps in multiple parent paths without modification.
- The parent step does not need to know about the sub-path's internal structure. It receives the sub-path's final data as a plain object and decides what to do with it.
- The stack is a simpler mental model than a recursive definition tree for the common cases (one or two levels deep). The recursive depth is unbounded if needed.

The snapshot exposes `nestingLevel` — 0 for the top-level path, 1 for the first sub-path, and so on — so UI code can reflect depth if desired.

---

## Framework adapters

Each adapter is a thin translation layer from the engine's `subscribe()` + `snapshot()` contract into the framework's native reactivity model.

| Adapter | Reactivity mechanism |
|---|---|
| `@daltonr/pathwrite-react` | `useSyncExternalStore` from React's built-in API |
| `@daltonr/pathwrite-vue` | `shallowRef` + `onScopeDispose` from Vue's Composition API |
| `@daltonr/pathwrite-angular` | RxJS `BehaviorSubject` wrapped in Angular signals |
| `@daltonr/pathwrite-svelte` | Svelte 5 `$state` rune + `onDestroy` |
| `@daltonr/pathwrite-solid` | `createSignal` accessor + `onCleanup` |
| `@daltonr/pathwrite-react-native` | Same `useSyncExternalStore` as the React adapter |

The engine does not import from any framework. Each adapter's `usePath()` (or `PathFacade` for Angular) creates an engine instance, calls `subscribe()` with a callback that updates the framework-native reactive value, and exposes the snapshot through that value.

Because the contract is small and consistent, adapters are short. The React adapter is essentially:

```typescript
const snapshot = useSyncExternalStore(
  engine.subscribe.bind(engine),
  engine.snapshot.bind(engine),
);
```

Adding support for a new framework means implementing `subscribe`-based reactivity for that framework. Nothing in the core changes.

`@daltonr/pathwrite-core` has zero dependencies. RxJS is introduced only by the Angular adapter because Angular applications already depend on it. The other adapters depend only on their respective framework, which the consuming application already provides as a peer dependency.

---

## Where Pathwrite fits

### Form libraries: React Hook Form, Formik, VeeValidate, Angular Forms

These libraries manage field state, validation, and submission within a **single form**. They are excellent at what they do. They do not provide step progression, inter-step data continuity, persistence, lifecycle hooks on step entry and exit, guard-based navigation blocking, or sub-path nesting. Multi-step support can be hacked in but is not a design goal.

Pathwrite is not a replacement for a field-level validation library within a step. It manages the orchestration layer above individual form fields.

### State machines: XState

XState is a formal hierarchical state machine implementation. It can model any state transition system and has excellent tooling (visual editor, state diagrams). It is the right tool for complex parallel states, history states, and state logic that warrants formal verification.

Pathwrite uses an ordered step model rather than a state graph. The tradeoffs:

- Lower learning curve — steps are intuitive; state machine concepts (context, send, actors, guards as `cond`) are not.
- Less expressive for genuinely complex branching — XState's parallel and history state handling has no direct equivalent in Pathwrite.
- Built-in persistence — XState has no opinion on persistence; you wire it yourself via actors or services.
- Simpler model for the common case — sequential flows with optional skipping, guards, and lifecycle hooks.

XState is the better choice for complex UI state machines with non-sequential transitions. Pathwrite is the better choice for any flow that is fundamentally a progression from step A to step B, with optional branching, skipping, and sub-paths.

### Wizard UI components: react-step-wizard, vue-form-wizard, Angular Material Stepper

These are UI components, not state engines. They render steps and handle navigation UI. They do not manage state, do not implement guards, do not support persistence, and are each locked to a single framework. They have no concept of lifecycle hooks or sub-paths.

### What Pathwrite does that none of them do

The combination that does not exist elsewhere:

- Multi-step orchestration with lifecycle hooks and guard-based navigation blocking
- Built-in persistence with configurable strategies (`onEveryChange`, `onNext`, `onComplete`, etc.)
- Framework adapters for React, Vue, Angular, Svelte, SolidJS, and React Native with a unified `PathDefinition` API
- Headless core with optional shell components
- Sub-path stacking for nested workflows
- Zero-dependency core that runs in browser, Node, workers, React Native, and Electron

The closest single alternative is XState. The gap is persistence, the simpler mental model for sequential flows, and native multi-framework support without additional adapter packages.

---

## The coupling between workflow and UI

There is an unavoidable coupling between a path definition and the UI that renders it. Both sides must agree on field names in `TData`, step IDs, and which fields `fieldErrors` reports. The CONNASCENCE_AND_TYPES guide covers this in detail, including the current state of type safety and where it can be improved.

The short version:

- `TData` field access is well-managed — `usePathContext<MyData>()` gives fully typed access to `snapshot.data`, and a misspelled field name is a compile error.
- Step IDs are currently unchecked — both the path definition and the UI use string literals with no compile-time link between them. Renaming a step ID does not produce a build error.
- `fieldErrors` keys are `Record<string, string | undefined>` — the key is not constrained to `keyof TData`, so a renamed field produces a silent `undefined` rather than a compile error.

These are known improvements, not fundamental limitations.

---

© 2026 Devjoy Ltd. MIT License.
