# @daltonr/pathwrite-store

## 0.12.0

### Minor Changes

- 7dab99d: Updated for `@daltonr/pathwrite-core@0.12.0` — `completionBehaviour`, per-step `hasAttemptedNext`, and `validateOnLeave`. No store-specific API changes.

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

- 141af41: `persistence()` now returns a `PersistenceObserver` with `flush()` and `dispose()`. `flush()` saves immediately — cancelling a pending debounce window — and resolves once every queued store operation has landed, for `beforeunload` / unmount handling; with the `"manual"` strategy it is the on-demand save. `dispose()` cancels a pending debounce window and ignores later events, so a timer never outlives the host component. `HttpStore.load()` returns `null` for a `204 No Content` or an empty body instead of throwing, and rejects with a clear message (through `onError`) when the body is not JSON or the JSON is not a `SerializedPathState`, instead of handing arbitrary data to `fromState()`.
- d0383bf: `HttpStore` no longer drops headers given as a `Headers` instance or as an array of `[name, value]` tuples. The `headers` option is typed `HeadersInit`, but the store spread it into an object literal — which yields nothing for those two forms — so an `Authorization` header supplied that way never reached the request. Headers are now merged through `Headers`, so every `HeadersInit` form works, and user headers override the store's defaults as a plain object always could. Requests now carry a `Headers` object rather than a plain object; a custom `fetch` receives that in `init.headers`.
- 13bf181: `HttpStore` accepts `credentials` (sent on every request), `signal` (an `AbortSignal` that cancels every request when aborted) and `timeoutMs` (aborts any single request that runs longer). A timed-out or aborted request rejects and is reported through `onError` like any other failure; the timeout timer is cleared when the request settles.
- bb6a685: `persistence()` no longer drops state that changes while a save is in flight. A save request that arrived while one was already on the wire returned the in-flight promise and never re-ran, so with a slow store two quick `next()` calls saved only the first position. A mid-flight request now marks the observer dirty, and one follow-up save of the engine's latest state runs as soon as the in-flight one settles (success or failure); several mid-flight requests collapse into that single follow-up.
- 8850f46: The `"onComplete"` strategy now writes a valid audit record — the engine's real exported state (or, for `completionBehaviour: "dismiss"`, one synthesised from the event) with the final `data` and `_status: "completed"` — instead of a hand-built record with `currentStepIndex: -1`. `restoreOrStart` treats any saved state whose status is `"completed"` (or whose index is negative, as older records were) as a finished path: it starts fresh with `restored: false` and leaves the record in place. Previously the next load either crashed inside `fromState` or, after the index clamping fix, resumed the finished path on step 1 with the submitted data.
- aafa325: `restoreOrStart` no longer rejects when saved state cannot be used. A failing `store.load` (corrupt JSON, network), an unsupported `version`, or a path id no longer present in `pathDefinitions` (a renamed path) used to reject the whole call, leaving the app unable to start until storage was cleared by hand. The error is now reported through the new `onRestoreError` option (or `console.warn` when absent), the record is deleted on a best-effort basis, and the path starts fresh with `restored: false`.
- cb5d323: `persistence()` runs its store operations for a key strictly one at a time, in request order. The delete issued on completion was fire-and-forget, so with `completionBehaviour: "reset"` (which restarts and saves immediately) a slow DELETE could land after the new session's PUT and wipe it. The delete is now queued behind any in-flight save and ahead of any later one. The in-flight re-save from the previous fix is part of the same queue: a save requested while one is on the wire runs afterwards with the latest state, and several such requests collapse into one.
- Updated dependencies [ca1eba7]
- Updated dependencies [7dab99d]
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
