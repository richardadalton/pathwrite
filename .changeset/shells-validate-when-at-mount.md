---
"@daltonr/pathwrite-react": patch
"@daltonr/pathwrite-react-native": patch
"@daltonr/pathwrite-vue": patch
"@daltonr/pathwrite-angular": patch
---

`PathShell` now honours `validateWhen` when it is already `true` at mount. The shells applied it before the mount-time `start()`, which resets the engine's validated flag, so a nested shell that remounted with `validateWhen` bound to the outer step's `hasAttemptedNext` (the tabbed layout) never showed its inner errors. Vue's watcher also was not immediate, so a true initial value was never applied at all. All four shells now re-apply `validateWhen` once the path (and any `restoreKey` jump) has settled. Solid and Svelte already ran the effect after `start()` and are unchanged; every shell now has a regression test for the case.
