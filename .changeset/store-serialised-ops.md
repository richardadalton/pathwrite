---
"@daltonr/pathwrite-store": patch
---

`persistence()` runs its store operations for a key strictly one at a time, in request order. The delete issued on completion was fire-and-forget, so with `completionBehaviour: "reset"` (which restarts and saves immediately) a slow DELETE could land after the new session's PUT and wipe it. The delete is now queued behind any in-flight save and ahead of any later one. The in-flight re-save from the previous fix is part of the same queue: a save requested while one is on the wire runs afterwards with the latest state, and several such requests collapse into one.
