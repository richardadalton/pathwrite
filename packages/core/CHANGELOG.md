# @daltonr/pathwrite-core

## 0.14.0

### Minor Changes

- 41055d4: **The engine is generic over its data.** `PathEngine<TData>` types `start`'s definition and initial data, `setData`'s key and value, `snapshot().data`, the events passed to `subscribe`, the observers in `PathEngineOptions<TData>` and `PathEngine.fromState<TData>()`. Every adapter's `usePath<TData>()` (Angular's `PathFacade<TData>`) creates a typed engine, its `start` takes a `PathDefinition<TData>`, and `@daltonr/pathwrite-store`'s `restoreOrStart<TData>()` returns a `PathEngine<TData>`. The default type parameter keeps the previous loose surface, so untyped code compiles unchanged, and `PathDefinition<any>` is gone from every public signature: where a surface must accept a definition over any data (shell `path` props, `startSubPath`) it takes plain `PathDefinition`.

  Step and path hooks (`onEnter`, `canMoveNext`, `select`, `onComplete`, …) are now declared with method syntax, which is what lets a `PathDefinition<Typed>` flow into those untyped positions. Object literals are unaffected. Prefer a `type` alias for your data: an `interface` that extends `PathData` carries a string index signature, so `setData` accepts any key on it (values for known keys are still checked).

  **Step choices: one id in every hook.** Inside a `StepChoice`, `onLeave`, `canMoveNext` and `canMovePrevious` on the selected inner step received the inner step's id as `ctx.stepId` and, because the visit history is keyed by the choice, an `isFirstEntry` that was always `true`. They now get the choice's own id like every other hook and the snapshot (`formId` still names the inner step), and a correct `isFirstEntry`. A guard on an inner step that compared `ctx.stepId` to the inner id needs to compare to the choice's id instead.

  Type-level changes that may need a one-line edit: `errorPhaseMessage()` takes an `ErrorPhase` rather than any string; `PathStore` and observer types are unchanged.

  **Svelte `PathShell` (breaking):** step components are passed as a `steps` record (`<PathShell steps={{ personalInfo: PersonalInfoStep }} />`) instead of loose props keyed by step id, matching the React and Solid shells. The props no longer carry an index signature, so misspelled props are now type errors, and `onevent` is typed `(event: PathEvent) => void`.

  Also in this release: the Svelte store holds the snapshot in `$state.raw` (no deep proxy per snapshot); the Angular shell memoises its field-error, warning and step rows per snapshot and tracks them by key, so unchanged rows keep their DOM nodes across change detection.

## 0.13.1

### Patch Changes

- Documentation only — no code changes. The README quick starts now compile as written: core's data type extends `PathData` (the example failed to type-check before), Solid's and Vue's step components import the shared data type instead of referring to one declared in another file, React Native imports only what it uses, the React / React Native examples drop null guards the non-null context snapshot no longer needs, and Svelte's completion callback parameter is typed.

## 0.13.0

### Patch Changes

- ca1eba7: Engine fixes for findings C1–C9 of the September 2026 review and all of its core "from reading" bugs (`previous()` guard status; `stateChanged` cause on completion failures and retries; `suspend()`, `validate()` and `goToStep` edge cases; `start()`/`restart()` during an in-flight navigation; fuller `exportState()`), plus the store's `restoreOrStart` now marking the engine as persisted.

  **Bug fixes**

  - `retry()` after a throwing `onSubPathComplete` re-runs the hook and resumes the parent instead of completing the parent path. The `resumed` event now carries a settled (`idle`) snapshot.
  - `PathEngine.fromState()` records the root path and its initial data, so `restart()` and `completionBehaviour: "reset"` work on a restored engine. `exportState()` now includes `initialData` (optional; older states fall back to `{}`).
  - `fromState()` normalises any mid-flight `_status` (`entering`, `validating`, `leaving`, `completing`, `error`) to `idle` so a restored engine can navigate; `completed` is preserved. Out-of-range `currentStepIndex` values are clamped and a missing `pathStack` is tolerated.
  - Async `canMoveNext` / `canMovePrevious` / `fieldErrors` functions are invoked once by `snapshot()` to detect that they are async, then skipped, and warned about once — not on every `setData`.
  - `hasAttemptedNext` is scoped to the path instance. A fresh launch of a sub-path starts clean, and a parent and sub-path whose steps share an id no longer see each other's attempts.
  - `previous()` runs `canMovePrevious` under status `"validating"` and only moves to `"leaving"` for `onLeave`, matching the documented `PathStatus` contract and `next()`. It now emits `validating → leaving → idle` (one more `stateChanged` than before).
  - A subscriber that throws no longer aborts the emit loop or unwinds into the navigation that emitted the event (which left the engine stuck in a busy status). The error is reported via `console.error` and the remaining subscribers still receive the event.
  - Completing a path whose trailing step(s) were skipped leaves the completed / error snapshot on the last _visible_ step instead of the skipped one.
  - `stateChanged.cause` now identifies the method that actually triggered the event: a completion failure reached from `start()` (all steps skipped) reports `"start"` instead of `"next"`, and every `retry()` emits `"retry"` instead of replaying the original cause.
  - `suspend()` only acts on a settled engine (`idle` or `error`). Called mid-navigation it no longer resets the status and lets the in-flight navigation land on a "suspended" engine; called after completion it no longer lets a later `next()` run `onComplete` again.
  - `start()` and `restart()` are safe to call while a hook or guard of the old path is still running. The abandoned navigation used to resume against the new path — re-running `onEnter` on its first step, emitting a stray `stateChanged`, applying a stale patch or error, or completing / resuming the old path after the restart. It now exits without touching the engine.
  - `goToStep` / `goToStepChecked` to a step an earlier navigation had resolved as skipped now clears it from the skip cache, so the snapshot lists it as current instead of reporting a `stepIndex` that pointed at a different step.
  - `validate()` also works while the status is `"error"`, so an outer shell whose Next just failed can still reveal the inner tabs' errors. The error and its retry are left untouched.
  - `exportState()` now includes `attemptedStepIds` and `skippedStepIds` (active path and each stack entry), `hasValidated` and `blockingError`. After a restore, `hasAttemptedNext`, `blockingError`, `stepCount` and `progress` are right immediately instead of after the first navigation. All new fields are optional; states saved by earlier versions still load (still `version: 1`).
  - `@daltonr/pathwrite-store`: `restoreOrStart` constructs the engine with `hasPersistence: true` on both the fresh-start and restore branches, so `snapshot.hasPersistence` is true whenever a store is attached that way and shells can show their "your progress is saved" escalation copy.

  - `setData()` and hook patches store every key as an own property. A key of `"__proto__"` (possible from user-supplied field names or parsed JSON) used to re-parent the data object instead of storing the value, which then vanished from every snapshot and export.

  - `matchesStrategy("onNext", …)` (and so the store's default `persistence` strategy) now also matches the return from a sub-path: the `resumed` event on completion and the settled `stateChanged` with cause `"cancel"` on cancel. Completing a sub-path emits no `stateChanged`, so the last save was still _inside_ the sub-path and a restore dropped the user back into a finished flow.

  - `GuardResult` is now `boolean | { allowed: boolean; reason?: string | null }`. It was declared as `true | { allowed: false; reason?: string }`, so a guard returning a plain boolean — which the engine has always accepted at runtime and which the demos and docs use — failed to type-check in user code. `{ allowed: true }` is accepted too.

  **Behaviour changes** (bug fixes, but observable)

  - `start()` on an engine with an active path now **replaces** it, as documented, instead of nesting it as a sub-path. Code that relied on `start()` to nest should call `startSubPath()`. `start()` during an in-flight hook now proceeds (like `restart()`) rather than being silently dropped.
  - `goToStep()` to the step the path is already on no longer runs `onLeave` / `onEnter` or re-snapshots the step's entry data (so `resetStep()` still reverts edits made before the call); it behaves like `goToStepChecked()` did. With `{ validateOnLeave: true }` both still mark the step attempted and emit `stateChanged`.
  - `previous()`, `goToStep()`, `goToStepChecked()` and a sub-path `cancel()` now use the same error / retry model as `next()`: when a hook or guard fails they **resolve**, set `snapshot.error` with the failing phase, move to status `"error"` and store a `retry()`. They no longer reject. Programmer errors (unknown step id, no active path) still throw.

## 0.12.0

### Minor Changes

- **`completionBehaviour` on `PathDefinition`** — controls what the engine does after a path completes. `"stayOnFinal"` (default) keeps the completed snapshot in place; `"dismiss"` sets snapshot to `null`; `"reset"` calls `restart()` automatically.

- **Per-step `hasAttemptedNext` persistence** — `snapshot.hasAttemptedNext` is now tracked per step (keyed by step ID) and persists when the user navigates away and back. No longer resets on `previous()` or `goToStep()`. Cleared only on `start()` / `restart()`.

- **`validateOnLeave` option on `goToStep` / `goToStepChecked`** — `goToStep(stepId, { validateOnLeave: true })` marks the departing step as attempted before navigating, so inline field errors appear if the user returns to that tab. Designed for tab bar click handlers.

## 0.11.0

## 0.10.1

### Patch Changes

- Merge defineServices and ServiceUnavailableError into core. Fix camelCase fallback for hyphenated step IDs in Svelte PathShell. Update all package READMEs and documentation.

## 0.9.0

### Minor Changes

- New `@daltonr/pathwrite-store` package replaces `@daltonr/pathwrite-store-http`.

  - Adds `AsyncStorageStore` for React Native local persistence — pass any async key-value adapter (`@react-native-async-storage/async-storage` works directly)
  - Renames `httpPersistence` → `persistence` (works with any `PathStore`, not just HTTP)
  - Angular `PathShellComponent`: adds `[engine]` input for externally managed engines; renames outputs `complete`, `cancel`, `event` (breaking)
  - React Native `PathShell`: numbered step dots with titles in progress header; adds `disableBodyScroll` prop
  - React adapter: adds `useField` binding helper
  - Svelte adapter: fixes `PathShell` step rendering and import path

## 0.8.0 - 2026-03-26

### Breaking Changes

- **Renamed `fieldMessages` to `fieldErrors`** — Now that `fieldWarnings` exists, `fieldMessages` was ambiguous. Rename your step definitions and snapshot references accordingly.

### Minor Changes

- **Added `onComplete` and `onCancel` callbacks to `PathDefinition`** — Define completion and cancellation handlers directly on the path definition instead of subscribing to events. Callbacks are only invoked for top-level paths (sub-path completion/cancellation continues to use parent step hooks).
- **Added `resetStep()` method** — Resets the current step's data to what it was when the step was entered. Useful for "Clear" or "Reset" buttons. Emits a `stateChanged` event with cause `"resetStep"`.
- **Added `isDirty` to `PathSnapshot`** — Automatically tracks whether any data has changed since entering the current step. Resets on navigation or `resetStep()`. Zero configuration required.
- **Added `stepEnteredAt` to `PathSnapshot`** — Captures `Date.now()` when each step is entered. Useful for analytics, timeout warnings, and logging. Persisted and restored with state. Zero configuration required.
- **Added `fieldWarnings` to `PathStep` and `PathSnapshot`** — Same shape as `fieldErrors` but purely informational; warnings never block navigation. Perfect for "Did you mean gmail.com?" hints or soft advisories.

## 0.7.0 - 2026-03-24

### Minor Changes

- **No core changes** — This is a coordinated release with `@daltonr/pathwrite-store-http@0.7.0` which adds `LocalStorageStore` for browser-local persistence. The core engine is unchanged; all adapters remain compatible.

## 0.6.3

### Patch Changes

- 24d12ea: Change default `validationDisplay` from `"summary"` to `"inline"` across all shell components. Documentation updates including full Svelte adapter coverage in the Developer Guide.

## 0.6.2

## 0.6.1

## 0.5.0

## 0.4.0 - 2026-03-21

### Documentation

- **Comprehensive documentation overhaul** — All features that existed but were undocumented are now properly explained:
  - `isFirstEntry` flag usage in lifecycle hooks
  - `onSubPathCancel` hook for tracking abandoned sub-paths
  - Guard safety: warnings about guards running before `onEnter` on first entry
  - Defensive coding patterns for guards (nullish coalescing)
  - `restart()` method for "start over" flows

### Notes

No code changes in this release. All features listed were already implemented in v0.3.0-0.3.1 but lacked comprehensive documentation. This release focuses on making the API discoverable and easier to use correctly.

## 0.3.1

### Patch Changes

- **Guard and `validationMessages` error resilience** — `evaluateGuardSync` and
  `evaluateValidationMessagesSync` now wrap execution in `try/catch`. If a guard or
  validation hook throws, Pathwrite logs a descriptive `console.warn` (step ID +
  thrown value + note about before-`onEnter` timing) and returns the safe default
  (`true` / `[]`) so the UI stays operable. Write guards defensively:
  `(data.name ?? "").trim().length > 0` rather than `data.name.trim().length > 0`.

- **`restart(path, initialData?)`** — new `PathEngine` method that tears down any
  active path and sub-path stack without firing lifecycle hooks or emitting
  `cancelled`, then immediately starts the given path fresh. Safe to call at any
  time. Use for "Start over" / retry flows without remounting the host component.

- **`.pw-shell__btn--back` CSS rule** — `shell.css` now defines an explicit modifier
  for the Back button (transparent background, primary-coloured border and text,
  `primary-light` hover). Previously the Back button fell back to the neutral base
  `.pw-shell__btn` style and was visually indistinguishable from a generic button.
  All three adapters copy `shell.css` at build time so no adapter source changes are
  required for this fix.

### Minor Changes

- New core features and adapter parity improvements.

  **`isFirstEntry` on `PathStepContext`** — `ctx.isFirstEntry` is `true` the first time a step is entered within the current path instance, and `false` on all subsequent re-entries (e.g. after navigating Back). Available in all hooks (`onEnter`, `onLeave`, `canMoveNext`, `canMovePrevious`, `validationMessages`, `onSubPathComplete`, `onSubPathCancel`). Fixes the silent footgun where `onEnter` would reset data on re-entry.

  **`startSubPath` meta parameter** — `startSubPath(path, data?, meta?)` accepts an optional `meta: Record<string, unknown>` object that is stored on the sub-path and returned unchanged as the 4th argument of `onSubPathComplete` and `onSubPathCancel`. Eliminates the workaround of embedding correlation keys inside the sub-path's data when iterating over a collection.

  **`onSubPathCancel` hook on `PathStep`** — fires when a sub-path is cancelled (either via `cancel()` or by pressing Back on the sub-path's first step). Receives `(subPathId, subPathData, ctx, meta?)` — the same signature as `onSubPathComplete`. Return a patch to record a skipped or declined outcome in the parent path's data.

  **Angular shell header/footer overrides** — `PathShellHeaderDirective` (`pwShellHeader`) and `PathShellFooterDirective` (`pwShellFooter`) allow replacing the default progress bar and navigation buttons with custom templates. Matches the `renderHeader`/`renderFooter` render props in the React adapter and the `#header`/`#footer` named slots in the Vue adapter. Exported `PathShellActions` interface for typed access to navigation callbacks.

  **Adapter parity fixes** — `goToStepChecked` added to `PathShellActions` in React and Vue; stale `previous()` JSDoc corrected in React and Vue source; `PathShell` component fully documented in React and Vue READMEs.

## 0.2.1

### Patch Changes

- Fix TypeScript contravariance: `start()` and `startSubPath()` now accept `PathDefinition<any>` at their public boundaries, so a typed `PathDefinition<MyData>` can be passed directly without casting. The Angular shell `[path]` input, React `PathShellProps.path`, and Vue `PathShell` path prop are updated consistently.

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

## 0.1.4

### Patch Changes

- 9883477: **Typed `setData` in React and Vue adapters**

  `setData` now accepts a generic key/value constraint when `usePath<TData>()` is called with a typed data interface. Passing a wrong key or a value that doesn't match the declared type is a compile-time TypeScript error. Non-generic users (`usePath()` with no type argument) are completely unaffected — the signature collapses to `(key: string, value: unknown)` as before.

  **Fix: CSS stylesheet import path in shell.css**

  The usage comment at the top of the shared `shell.css` file referenced the non-existent `@daltonr/pathwrite-shell.css` package. It now shows the correct per-adapter import paths.

## 0.1.2

### Patch Changes

- 06f6864: Add optional generic on usePath/usePathContext to type snapshot.data; update PathShell APIs (React uses steps map, Vue uses named slots); sync DEVELOPER_GUIDE with current codebase

## 0.1.1

### Patch Changes

- Initial Release of Pathwrite
