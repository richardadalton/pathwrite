---
"@daltonr/pathwrite-store": patch
---

The `"onComplete"` strategy now writes a valid audit record — the engine's real exported state (or, for `completionBehaviour: "dismiss"`, one synthesised from the event) with the final `data` and `_status: "completed"` — instead of a hand-built record with `currentStepIndex: -1`. `restoreOrStart` treats any saved state whose status is `"completed"` (or whose index is negative, as older records were) as a finished path: it starts fresh with `restored: false` and leaves the record in place. Previously the next load either crashed inside `fromState` or, after the index clamping fix, resumed the finished path on step 1 with the submitted data.
