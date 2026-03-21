# @daltonr/pathwrite-angular

## 0.3.1

### Patch Changes

- **`restart(path, initialData?)`** — new `PathFacade` method. Tears down any
  active path (without firing hooks) and immediately starts the given path fresh.
  Safe to call at any time. Use for "Start over" / retry flows without destroying
  and re-creating the component that provides the facade.

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
