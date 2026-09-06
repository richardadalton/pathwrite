---
"@daltonr/pathwrite-core": patch
---

Test output only, plus one message-prefix fix. The engine's `[Pathwrite] Step "…" has an async shouldSkip` warning now uses the lowercase `[pathwrite]` prefix every other message uses.

The suite emitted roughly half a megabyte of stderr, nearly all of it from passing tests that exercise warning paths on purpose: async guards falling back to an optimistic default in a snapshot, guards that throw, a forced delete failure, `usePath()` called outside a Solid root, and a test asserting that `usePathContext()` throws outside a provider. A genuine failure looked exactly like all of it, which cost several interrupted releases.

Output is now captured rather than muted. `captureExpectedConsole` silences the messages a suite provokes deliberately and fails the test on anything unlisted, so a file can be quiet without going deaf; it caught an unlisted warning the moment it was switched on. The two eligibility property tests assert their warning is still emitted, so the engine going silent would be a failure rather than an improvement.
