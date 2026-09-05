---
"@daltonr/pathwrite-core": patch
"@daltonr/pathwrite-store": patch
---

Engine fixes for findings C1–C9 of the September 2026 review and all of its core "from reading" bugs (`previous()` guard status; `stateChanged` cause on completion failures and retries; `suspend()`, `validate()` and `goToStep` edge cases; `start()`/`restart()` during an in-flight navigation; fuller `exportState()`), plus the store's `restoreOrStart` now marking the engine as persisted.

**Bug fixes**

- `retry()` after a throwing `onSubPathComplete` re-runs the hook and resumes the parent instead of completing the parent path. The `resumed` event now carries a settled (`idle`) snapshot.
- `PathEngine.fromState()` records the root path and its initial data, so `restart()` and `completionBehaviour: "reset"` work on a restored engine. `exportState()` now includes `initialData` (optional; older states fall back to `{}`).
- `fromState()` normalises any mid-flight `_status` (`entering`, `validating`, `leaving`, `completing`, `error`) to `idle` so a restored engine can navigate; `completed` is preserved. Out-of-range `currentStepIndex` values are clamped and a missing `pathStack` is tolerated.
- Async `canMoveNext` / `canMovePrevious` / `fieldErrors` functions are invoked once by `snapshot()` to detect that they are async, then skipped, and warned about once — not on every `setData`.
- `hasAttemptedNext` is scoped to the path instance. A fresh launch of a sub-path starts clean, and a parent and sub-path whose steps share an id no longer see each other's attempts.
- `previous()` runs `canMovePrevious` under status `"validating"` and only moves to `"leaving"` for `onLeave`, matching the documented `PathStatus` contract and `next()`. It now emits `validating → leaving → idle` (one more `stateChanged` than before).
- A subscriber that throws no longer aborts the emit loop or unwinds into the navigation that emitted the event (which left the engine stuck in a busy status). The error is reported via `console.error` and the remaining subscribers still receive the event.
- Completing a path whose trailing step(s) were skipped leaves the completed / error snapshot on the last *visible* step instead of the skipped one.
- `stateChanged.cause` now identifies the method that actually triggered the event: a completion failure reached from `start()` (all steps skipped) reports `"start"` instead of `"next"`, and every `retry()` emits `"retry"` instead of replaying the original cause.
- `suspend()` only acts on a settled engine (`idle` or `error`). Called mid-navigation it no longer resets the status and lets the in-flight navigation land on a "suspended" engine; called after completion it no longer lets a later `next()` run `onComplete` again.
- `start()` and `restart()` are safe to call while a hook or guard of the old path is still running. The abandoned navigation used to resume against the new path — re-running `onEnter` on its first step, emitting a stray `stateChanged`, applying a stale patch or error, or completing / resuming the old path after the restart. It now exits without touching the engine.
- `goToStep` / `goToStepChecked` to a step an earlier navigation had resolved as skipped now clears it from the skip cache, so the snapshot lists it as current instead of reporting a `stepIndex` that pointed at a different step.
- `validate()` also works while the status is `"error"`, so an outer shell whose Next just failed can still reveal the inner tabs' errors. The error and its retry are left untouched.
- `exportState()` now includes `attemptedStepIds` and `skippedStepIds` (active path and each stack entry), `hasValidated` and `blockingError`. After a restore, `hasAttemptedNext`, `blockingError`, `stepCount` and `progress` are right immediately instead of after the first navigation. All new fields are optional; states saved by earlier versions still load (still `version: 1`).
- `@daltonr/pathwrite-store`: `restoreOrStart` constructs the engine with `hasPersistence: true` on both the fresh-start and restore branches, so `snapshot.hasPersistence` is true whenever a store is attached that way and shells can show their "your progress is saved" escalation copy.

- `setData()` and hook patches store every key as an own property. A key of `"__proto__"` (possible from user-supplied field names or parsed JSON) used to re-parent the data object instead of storing the value, which then vanished from every snapshot and export.

**Behaviour changes** (bug fixes, but observable)

- `start()` on an engine with an active path now **replaces** it, as documented, instead of nesting it as a sub-path. Code that relied on `start()` to nest should call `startSubPath()`. `start()` during an in-flight hook now proceeds (like `restart()`) rather than being silently dropped.
- `goToStep()` to the step the path is already on no longer runs `onLeave` / `onEnter` or re-snapshots the step's entry data (so `resetStep()` still reverts edits made before the call); it behaves like `goToStepChecked()` did. With `{ validateOnLeave: true }` both still mark the step attempted and emit `stateChanged`.
- `previous()`, `goToStep()`, `goToStepChecked()` and a sub-path `cancel()` now use the same error / retry model as `next()`: when a hook or guard fails they **resolve**, set `snapshot.error` with the failing phase, move to status `"error"` and store a `retry()`. They no longer reject. Programmer errors (unknown step id, no active path) still throw.
