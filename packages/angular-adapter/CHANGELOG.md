# @daltonr/pathwrite-angular

## 0.13.1

### Patch Changes

- Documentation only — no code changes. The README quick starts now compile as written: core's data type extends `PathData` (the example failed to type-check before), Solid's and Vue's step components import the shared data type instead of referring to one declared in another file, React Native imports only what it uses, the React / React Native examples drop null guards the non-null context snapshot no longer needs, and Svelte's completion callback parameter is typed.
- Updated dependencies
  - @daltonr/pathwrite-core@0.13.1

## 0.13.0

### Patch Changes

- 3afacac: `<pw-shell>` shows "No active path." after the path is cancelled (or dismissed on completion) instead of an empty `.pw-shell`, like the other shells, and wraps the completion panel in `.pw-shell__body` so the shared stylesheet applies to it.
- b46447a: `usePathContext()` now exposes the full action surface in every adapter. Svelte's `PathContext` lacked `start`, `startSubPath` and `validate`, so a step component could not launch a sub-path through the context; it now extends `UsePathReturn`, and `<PathShell>` provides all three. Angular's `UsePathContextReturn` lacked `validate()`; it is now derived from `PathFacade` (`Pick<PathFacade, FacadeContextMethod>`) and forwards `validate()`. Both were hand-written copies of the hook / facade surface that fell behind when `validate()` was added; each adapter now has a type-level test asserting the context matches its hook or facade, so this cannot recur silently.
- 0b3c860: Custom shell headers follow one rule in every shell: shown whenever progress is not hidden (`hideProgress`, `layout="tabs"`), including for a single-step path; only the default progress header additionally hides for one step. Angular's `pwShellHeader` ignored `hideProgress` and `layout="tabs"`; Solid's `renderHeader` and React Native's `renderHeader` were hidden for single-step paths.
- 42cbd0a: `restoreKey` restores a remounted inner shell in place. The value stored under `data[restoreKey]` is still the inner `PathSnapshot` (so outer steps keep reading `data.<key>.data.<field>`), but it now also carries a `serializedState` field — the inner engine's `exportState()`. On remount the inner engine is rebuilt from it with `PathEngine.fromState()` instead of starting the path and jumping to the step, which re-ran `onEnter` on the first step and `onLeave` / `onEnter` on the way to the target on every remount and lost attempted / visited state (a blocked attempt's errors vanished when the user came back). A stored value without `serializedState`, written by an older version, still restores the old way. Every shell has a remount test for this. Angular's `PathFacade` gains an `engine` getter.
- f64b309: `PathShell` now falls back from a `StepChoice`'s inner step id (`formId`) to the slot's own `stepId` when looking up step content, as the React, Vue and Svelte shells already did. A choice registered under its own id (`steps={{ type: ... }}` / `<ng-template pwStep="type">`) rendered blank in Angular and Solid; content registered under the inner id still takes precedence.
- 449dae5: `PathShell` now honours `validateWhen` when it is already `true` at mount. The shells applied it before the mount-time `start()`, which resets the engine's validated flag, so a nested shell that remounted with `validateWhen` bound to the outer step's `hasAttemptedNext` (the tabbed layout) never showed its inner errors. Vue's watcher also was not immediate, so a true initial value was never applied at all. All four shells now re-apply `validateWhen` once the path (and any `restoreKey` jump) has settled. Solid and Svelte already ran the effect after `start()` and are unchanged; every shell now has a regression test for the case.
- Updated dependencies [ca1eba7]
  - @daltonr/pathwrite-core@0.13.0

## 0.12.0

### Minor Changes

- **`completionBehaviour`** — `"stayOnFinal"` (default), `"dismiss"`, or `"reset"`. Use the `[pwShellCompletion]` directive to render a custom done screen when `stayOnFinal` is active.

- **`restoreKey` input on `<pw-shell>`** — pass a string key and the inner shell automatically saves its full state (data + active step) into the outer path's data on every change, restoring on remount. Eliminates state loss when navigating away from a wizard step that hosts a nested shell.

- **`layout` input on `<pw-shell>`** _(replaces `footerLayout`)_ — accepted values: `"auto"` (default), `"wizard"`, `"form"`, `"tabs"`. The new `"tabs"` value hides both the progress header and footer in a single prop.

- **`validateWhen` input on `<pw-shell>`** — when it becomes `true`, calls `validate()` on the engine. Bind to the outer snapshot's `hasAttemptedNext` when nesting a shell inside a wizard step.

- **`services` input on `<pw-shell>` + `usePathContext<TData, TServices>()`** — pass an arbitrary services object to all step components without prop-drilling. Stored on the scoped `PathFacade` instance; access it as `usePathContext<TData, TServices>().services`.

- **`goToStep(stepId, options?)` / `goToStepChecked(stepId, options?)`** on both `PathFacade` and `usePathContext()` — both now accept `{ validateOnLeave: true }` to mark the departing step as attempted before navigating.

### Patch Changes

- Updated dependencies [431a268]
  - @daltonr/pathwrite-core@0.12.0

## 0.11.0

### Patch Changes

- @daltonr/pathwrite-core@0.11.0

## 0.10.1

### Patch Changes

- Merge defineServices and ServiceUnavailableError into core. Fix camelCase fallback for hyphenated step IDs in Svelte PathShell. Update all package READMEs and documentation.
- Updated dependencies
  - @daltonr/pathwrite-core@0.10.1

## 0.9.0

### Minor Changes

- New `@daltonr/pathwrite-store` package replaces `@daltonr/pathwrite-store-http`.

  - Adds `AsyncStorageStore` for React Native local persistence — pass any async key-value adapter (`@react-native-async-storage/async-storage` works directly)
  - Renames `httpPersistence` → `persistence` (works with any `PathStore`, not just HTTP)
  - Angular `PathShellComponent`: adds `[engine]` input for externally managed engines; renames outputs `complete`, `cancel`, `event` (breaking)
  - React Native `PathShell`: numbered step dots with titles in progress header; adds `disableBodyScroll` prop
  - React adapter: adds `useField` binding helper
  - Svelte adapter: fixes `PathShell` step rendering and import path

### Patch Changes

- Updated dependencies
  - @daltonr/pathwrite-core@0.9.0

## 0.8.0 - 2026-03-26

### Breaking Changes

- **Renamed `fieldMessages` to `fieldErrors`** — Update snapshot references and step definitions.

### Minor Changes

- **`fieldWarnings` rendering in shell** — Warnings rendered in amber; never block navigation.
- **`onComplete` / `onCancel` props on `PathShell`** — Pass handlers directly on the shell component.
- **`resetStep()` exposed** — Call to revert current step data to its entry state.
- **New snapshot fields** — `isDirty`, `stepEnteredAt`, and `fieldWarnings` all passed through.

## 0.7.0 - 2026-03-24

### Patch Changes

- Coordinated release with `@daltonr/pathwrite-store-http@0.7.0` which adds `LocalStorageStore` for browser-local persistence. No adapter changes.
- Updated dependencies
  - @daltonr/pathwrite-core@0.7.0

## 0.6.3

### Patch Changes

- 24d12ea: Change default `validationDisplay` from `"summary"` to `"inline"` across all shell components. Documentation updates including full Svelte adapter coverage in the Developer Guide.
- Updated dependencies [24d12ea]
  - @daltonr/pathwrite-core@0.6.3

## 0.6.2

### Patch Changes

- @daltonr/pathwrite-core@0.6.2

## 0.6.1

### Patch Changes

- @daltonr/pathwrite-core@0.6.1

## 0.5.0

### Patch Changes

- @daltonr/pathwrite-core@0.5.0

## 0.4.0 - 2026-03-21

### Documentation

- **Complete sub-path workflow examples** — Added comprehensive approver collection example showing:
  - Collection iteration with sub-paths
  - `meta` correlation field for tracking items
  - `onSubPathComplete` and `onSubPathCancel` usage
  - Template co-location with `pwStep` directives
- **Guards and lifecycle hooks guide** — New section covering:
  - Warning: guards run before `onEnter` on first entry
  - Defensive coding patterns (nullish coalescing)
  - `isFirstEntry` flag usage examples
  - `onEnter` vs `initialData` guidance
- **CSS custom properties reference** — Complete list of all `--pw-*` theming variables with defaults

### Updated dependencies

- @daltonr/pathwrite-core@0.4.0

## 0.3.1

### Patch Changes

- **`restart(path, initialData?)`** — new `PathFacade` method. Tears down any
  active path (without firing hooks) and immediately starts the given path fresh.
  Safe to call at any time. Use for "Start over" / retry flows without destroying
  and re-creating the component that provides the facade.

- **`PathShellActions.restart()`** — the `actions` object passed to custom
  `pwShellFooter` templates now includes `restart()`, which restarts the shell's
  own `[path]` input with its own `[initialData]` input. Matches the `restart()`
  action already present in Vue's `#footer` slot and React's `renderFooter` prop.

- Updated dependencies
  - @daltonr/pathwrite-core@0.3.1

### Minor Changes

- New core features and adapter parity improvements.

  **`isFirstEntry` on `PathStepContext`** — `ctx.isFirstEntry` is `true` the first time a step is entered within the current path instance, and `false` on all subsequent re-entries (e.g. after navigating Back). Available in all hooks (`onEnter`, `onLeave`, `canMoveNext`, `canMovePrevious`, `validationMessages`, `onSubPathComplete`, `onSubPathCancel`). Fixes the silent footgun where `onEnter` would reset data on re-entry.

  **`startSubPath` meta parameter** — `startSubPath(path, data?, meta?)` accepts an optional `meta: Record<string, unknown>` object that is stored on the sub-path and returned unchanged as the 4th argument of `onSubPathComplete` and `onSubPathCancel`. Eliminates the workaround of embedding correlation keys inside the sub-path's data when iterating over a collection.

  **`onSubPathCancel` hook on `PathStep`** — fires when a sub-path is cancelled (either via `cancel()` or by pressing Back on the sub-path's first step). Receives `(subPathId, subPathData, ctx, meta?)` — the same signature as `onSubPathComplete`. Return a patch to record a skipped or declined outcome in the parent path's data.

  **Angular shell header/footer overrides** — `PathShellHeaderDirective` (`pwShellHeader`) and `PathShellFooterDirective` (`pwShellFooter`) allow replacing the default progress bar and navigation buttons with custom templates. Matches the `renderHeader`/`renderFooter` render props in the React adapter and the `#header`/`#footer` named slots in the Vue adapter. Exported `PathShellActions` interface for typed access to navigation callbacks.

  **Adapter parity fixes** — `goToStepChecked` added to `PathShellActions` in React and Vue; stale `previous()` JSDoc corrected in React and Vue source; `PathShell` component fully documented in React and Vue READMEs.

### Patch Changes

- Updated dependencies
  - @daltonr/pathwrite-core@0.3.0

## 0.2.1

### Patch Changes

- Fix TypeScript contravariance: `start()` and `startSubPath()` now accept `PathDefinition<any>` at their public boundaries, so a typed `PathDefinition<MyData>` can be passed directly without casting. The Angular shell `[path]` input, React `PathShellProps.path`, and Vue `PathShell` path prop are updated consistently.
- Updated dependencies
  - @daltonr/pathwrite-core@0.2.1

## 0.2.0

### Minor Changes

- **New: `validationMessages` hook on `PathStep`**

  Add `validationMessages?: (ctx) => string[]` to `PathStep`. The engine evaluates it synchronously on every snapshot and exposes the result as `validationMessages: string[]` on `PathSnapshot`. The default shell in all three adapters (Angular `<pw-shell>`, React `<PathShell>`, Vue `<PathShell>`) renders the list below the step body automatically — hidden when empty. Async functions default to `[]`; keep the hook synchronous.

  **New: `goToStepChecked(stepId)` on `PathEngine` and all adapters**

  Jumps directly to a step by ID while respecting the current step's navigation guard: `canMoveNext` when going forward, `canMovePrevious` when going backward. Navigation is blocked (and `stateChanged` still emitted) if the guard returns false. `onLeave` / `onEnter` only fire when the guard permits. The original `goToStep` (which bypasses guards) is still available for administrative use cases.

  **Breaking change: `previous()` from the first step of a top-level path is now a no-op**

  Previously, calling `previous()` when already on step 1 silently triggered a full `cancelled` event and destroyed all path state. This was surprising and inconsistent with every other blocked-navigation case. It now returns immediately without emitting any event. To cancel from step 1, call `cancel()` explicitly. Sub-path behaviour is unchanged: `previous()` on a sub-path's first step still pops back to the parent path.

  **Angular: `PathFacade<TData>` generic**

  `PathFacade` is now generic. `state$`, `stateSignal`, `snapshot()`, and `setData()` are all typed against `TData`. Inject untyped and cast: `inject(PathFacade) as PathFacade<MyData>`.

  **Angular: `stateSignal` on `PathFacade`**

  `PathFacade` now ships a pre-wired `stateSignal: Signal<PathSnapshot | null>` field updated synchronously alongside `state$`. No `toSignal()` call or injection context required.

  **Angular: `syncFormGroup` utility**

  `syncFormGroup(facade, formGroup, destroyRef?)` syncs an Angular `FormGroup` to the engine via `setData` on every value change, keeping `canMoveNext` guards reactive without manual event binding. Uses `getRawValue()` so disabled controls are always included. `@angular/forms` is an optional peer dependency.

### Patch Changes

- Updated dependencies
  - @daltonr/pathwrite-core@0.2.0

## 0.1.4

### Patch Changes

- 9883477: **Typed `setData` in React and Vue adapters**

  `setData` now accepts a generic key/value constraint when `usePath<TData>()` is called with a typed data interface. Passing a wrong key or a value that doesn't match the declared type is a compile-time TypeScript error. Non-generic users (`usePath()` with no type argument) are completely unaffected — the signature collapses to `(key: string, value: unknown)` as before.

  **Fix: CSS stylesheet import path in shell.css**

  The usage comment at the top of the shared `shell.css` file referenced the non-existent `@daltonr/pathwrite-shell.css` package. It now shows the correct per-adapter import paths.

- Updated dependencies [9883477]
  - @daltonr/pathwrite-core@0.1.4

## 0.1.2

### Patch Changes

- 06f6864: Add optional generic on usePath/usePathContext to type snapshot.data; update PathShell APIs (React uses steps map, Vue uses named slots); sync DEVELOPER_GUIDE with current codebase
- Updated dependencies [06f6864]
  - @daltonr/pathwrite-core@0.1.2

## 0.1.1

### Patch Changes

- Initial Release of Pathwrite
- Updated dependencies
  - @daltonr/pathwrite-core@0.1.1
