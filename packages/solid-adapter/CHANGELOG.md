# @daltonr/pathwrite-solid

## 0.13.0

### Patch Changes

- fe25e97: An `engine` that arrives after mount is adopted. `PathShell`'s `engine` prop (and `usePath({ engine })`) used to be read once at mount; an engine passed later — the common case when `restoreOrStart()` resolves asynchronously — was silently ignored while the shell kept driving its own path. The hook now tracks the engine in each framework's idiom (React / React Native: re-read on every render; Vue: a plain engine, ref or getter, watched; Solid: a plain engine or accessor, tracked; Svelte: a getter over the reactive prop) and, when it changes, re-subscribes and re-seeds its snapshot from the new engine. Angular already adopted a late `[engine]` via `ngOnChanges`; that is now pinned by a test. Set `autoStart` to `false` when the engine is expected later and the shell should not start its own path meanwhile.
- 0b3c860: Custom shell headers follow one rule in every shell: shown whenever progress is not hidden (`hideProgress`, `layout="tabs"`), including for a single-step path; only the default progress header additionally hides for one step. Angular's `pwShellHeader` ignored `hideProgress` and `layout="tabs"`; Solid's `renderHeader` and React Native's `renderHeader` were hidden for single-step paths.
- 42cbd0a: `restoreKey` restores a remounted inner shell in place. The value stored under `data[restoreKey]` is still the inner `PathSnapshot` (so outer steps keep reading `data.<key>.data.<field>`), but it now also carries a `serializedState` field — the inner engine's `exportState()`. On remount the inner engine is rebuilt from it with `PathEngine.fromState()` instead of starting the path and jumping to the step, which re-ran `onEnter` on the first step and `onLeave` / `onEnter` on the way to the target on every remount and lost attempted / visited state (a blocked attempt's errors vanished when the user came back). A stored value without `serializedState`, written by an older version, still restores the old way. Every shell has a remount test for this. Angular's `PathFacade` gains an `engine` getter.
- f64b309: `PathShell` now falls back from a `StepChoice`'s inner step id (`formId`) to the slot's own `stepId` when looking up step content, as the React, Vue and Svelte shells already did. A choice registered under its own id (`steps={{ type: ... }}` / `<ng-template pwStep="type">`) rendered blank in Angular and Solid; content registered under the inner id still takes precedence.
- 2b27f9e: `PathShell` no longer tears down and re-creates the current step component on every engine event. The step render function used to be called inside a tracked render position that read the `{ equals: false }` snapshot signal, so each `setData` (every keystroke) destroyed the step and rebuilt it — the `<input>` lost its DOM node, focus and local state. The rendered step is now keyed on its identity (path, nesting level, step / form id), created once when the step becomes current and kept until the path moves on. The `snapshot` argument passed to the render function is live: its properties read the current snapshot reactively, so `(snap) => <Step snapshot={snap} />` with `createMemo(() => props.snapshot.data)` inside keeps working. `usePathContext().snapshot()` is unchanged.
- Updated dependencies [ca1eba7]
  - @daltonr/pathwrite-core@0.13.0

## 0.12.0

### Minor Changes

- **`completionBehaviour`** — `"stayOnFinal"` (default), `"dismiss"`, or `"reset"`. Use the `completionContent` prop to render a custom done screen when `stayOnFinal` is active.

- **`restoreKey` prop on `PathShell`** — pass a string key and the inner shell automatically saves its full state (data + active step) into the outer path's data on every change, restoring on remount. Eliminates state loss when navigating away from a wizard step that hosts a nested shell.

- **`layout` prop on `PathShell`** _(replaces `footerLayout`)_ — accepted values: `"auto"` (default), `"wizard"`, `"form"`, `"tabs"`. The new `"tabs"` value hides both the progress header and footer in a single prop.

- **`validateWhen` prop on `PathShell`** — when it becomes `true`, calls `validate()` on the engine. Bind to the outer snapshot's `hasAttemptedNext` when nesting a shell inside a wizard step.

- **`services` prop on `PathShell` + `usePathContext<TData, TServices>()`** — pass an arbitrary services object to all step components without prop-drilling. Access it as `usePathContext<TData, TServices>().services`.

- **`goToStep(stepId, options?)` / `goToStepChecked(stepId, options?)`** — both now accept `{ validateOnLeave: true }` to mark the departing step as attempted before navigating.

- **`steps`, `renderHeader`, `renderFooter` accept component references directly** — previously required an arrow function wrapper; component references now type-check correctly.

### Patch Changes

- Updated dependencies [431a268]
  - @daltonr/pathwrite-core@0.12.0

## 0.11.0

### Minor Changes

- Add `@daltonr/pathwrite-solid` — SolidJS adapter with `usePath()` composable, `PathShell` component, and `usePathContext()` hook. State is exposed as a `createSignal` accessor with `onCleanup` disposal.

### Patch Changes

- @daltonr/pathwrite-core@0.11.0
