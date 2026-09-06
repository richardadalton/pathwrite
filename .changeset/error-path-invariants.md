---
"@daltonr/pathwrite-core": minor
"@daltonr/pathwrite-store": minor
---

**Failure-path fixes, each written against an invariant test that fails without it.** Half of these were introduced by the previous round of review fixes, because those were validated against the finding they addressed rather than the guarantees they touched. The new suites (`packages/core/test/error-paths.properties.test.ts`, `packages/store/test/persistence.invariants.test.ts`) assert the guarantees instead, so a future fix that breaks one is caught.

**Engine**

- `snapshot()` can no longer throw. A `StepChoice` whose `select` threw or returned an unknown id left the choice unresolved, and every later `snapshot()` threw — including the one the engine's own error handler takes, which wedged it in `entering` and took the host application's render down with it. Snapshot-time resolution now degrades to a renderable placeholder; navigation still resolves strictly.
- **Behaviour change:** an unknown `select` id no longer rejects `start()`. It is reported through the normal error model instead: status `"error"`, the diagnostic on `snapshot().error`, and a working `retry()`. The old rejection was a side effect of the bug above, and surfaced as an unhandled rejection in adapters that do not await `start()`.
- `blockingError` no longer outlives the step that set it. A guard's reason survived into the completed snapshot, and leaked out of a sub-path into a parent that never blocked, where shells render it under the step body as an error about a screen the user has already left.
- `previous()` on the first step of a top-level path is a true no-op again. It cleared the pending error and retry before reaching its own no-op check, so a call that navigated nowhere silently discarded the "Try again" the shell was offering, emitting no event: the panel stayed on screen with a dead button.

**Persistence**

- **A transient store failure no longer destroys saved progress.** `restoreOrStart` wrapped `load` and restore in one `catch` and deleted the record on any error, so a 503 during a deploy, an expired token or a dropped mobile connection erased work the user had done. Reading and validating are now separate: a record that was read and is unusable is still cleared, and a store that could not be reached is left alone.
- New `UnusableStateError`, exported. `PathStore.load` throwing is otherwise ambiguous between "the backend is down" and "the stored bytes are garbage". The built-in stores throw it for an unparseable or malformed record; `restoreOrStart` deletes only for it, and for a bare `SyntaxError` so custom stores that simply let `JSON.parse` throw keep working.
- Nothing is written after a path completes. The completion delete left the debounce timer armed and the dirty flag set, so a pending save or a `flush()` from a `beforeunload` handler re-created the record of a finished path, keeping whatever the user typed in storage indefinitely.
- If the completion delete fails, a `completed` tombstone is written instead. Without it the last pre-completion record survived on the final step with status `"idle"`, so a returning user was resumed there and pressing Next ran `onComplete` a second time and submitted twice.

**Serialization coverage.** `packages/core/test/serialization.properties.test.ts` adds generated coverage for export and restore, which previously had 86 example-based assertions and no properties: a round trip reproduces every observable field of the snapshot, a restored engine still restarts, exporting a restored engine reproduces the record, and no input at all — including hand-edited or truncated records — yields an engine that cannot navigate. These pass against the current engine; they exist so the next change to the format cannot quietly break it. The generated states reach sub-path stacks four deep, which the first draft of the suite silently never reached.

`@daltonr/pathwrite-store` now type-checks against the ES2022 lib, matching every other package and the repo's `target`.
