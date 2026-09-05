---
"@daltonr/pathwrite-core": minor
---

**`completionBehaviour` on `PathDefinition`** — controls what the engine does after a path completes. `"stayOnFinal"` (default) keeps the completed snapshot in place; `"dismiss"` sets snapshot to `null`; `"reset"` calls `restart()` automatically.

**Per-step `hasAttemptedNext` persistence** — `snapshot.hasAttemptedNext` is now tracked per step (keyed by step ID) and persists when the user navigates away and back. No longer resets on `previous()` or `goToStep()`. Cleared only on `start()` / `restart()`.

**`validateOnLeave` option on `goToStep` / `goToStepChecked`** — `goToStep(stepId, { validateOnLeave: true })` marks the departing step as attempted before navigating, so inline field errors appear if the user returns to that tab. Designed for tab bar click handlers.
