---
"@daltonr/pathwrite-core": patch
---

Engine fixes for findings C1–C7 of the September 2026 review, plus its first two "from reading" items (`previous()` guard status; `stateChanged` cause on completion failures and retries).

**Bug fixes**

- `retry()` after a throwing `onSubPathComplete` re-runs the hook and resumes the parent instead of completing the parent path. The `resumed` event now carries a settled (`idle`) snapshot.
- `PathEngine.fromState()` records the root path and its initial data, so `restart()` and `completionBehaviour: "reset"` work on a restored engine. `exportState()` now includes `initialData` (optional; older states fall back to `{}`).
- `fromState()` normalises any mid-flight `_status` (`entering`, `validating`, `leaving`, `completing`, `error`) to `idle` so a restored engine can navigate; `completed` is preserved. Out-of-range `currentStepIndex` values are clamped and a missing `pathStack` is tolerated.
- Async `canMoveNext` / `canMovePrevious` / `fieldErrors` functions are invoked once by `snapshot()` to detect that they are async, then skipped, and warned about once — not on every `setData`.
- `hasAttemptedNext` is scoped to the path instance. A fresh launch of a sub-path starts clean, and a parent and sub-path whose steps share an id no longer see each other's attempts.
- `previous()` runs `canMovePrevious` under status `"validating"` and only moves to `"leaving"` for `onLeave`, matching the documented `PathStatus` contract and `next()`. It now emits `validating → leaving → idle` (one more `stateChanged` than before).
- `stateChanged.cause` now identifies the method that actually triggered the event: a completion failure reached from `start()` (all steps skipped) reports `"start"` instead of `"next"`, and every `retry()` emits `"retry"` instead of replaying the original cause.

**Behaviour changes** (bug fixes, but observable)

- `start()` on an engine with an active path now **replaces** it, as documented, instead of nesting it as a sub-path. Code that relied on `start()` to nest should call `startSubPath()`. `start()` during an in-flight hook now proceeds (like `restart()`) rather than being silently dropped.
- `previous()`, `goToStep()`, `goToStepChecked()` and a sub-path `cancel()` now use the same error / retry model as `next()`: when a hook or guard fails they **resolve**, set `snapshot.error` with the failing phase, move to status `"error"` and store a `retry()`. They no longer reject. Programmer errors (unknown step id, no active path) still throw.
