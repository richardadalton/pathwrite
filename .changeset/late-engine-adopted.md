---
"@daltonr/pathwrite-react": patch
"@daltonr/pathwrite-react-native": patch
"@daltonr/pathwrite-vue": patch
"@daltonr/pathwrite-svelte": patch
"@daltonr/pathwrite-solid": patch
---

An `engine` that arrives after mount is adopted. `PathShell`'s `engine` prop (and `usePath({ engine })`) used to be read once at mount; an engine passed later — the common case when `restoreOrStart()` resolves asynchronously — was silently ignored while the shell kept driving its own path. The hook now tracks the engine in each framework's idiom (React / React Native: re-read on every render; Vue: a plain engine, ref or getter, watched; Solid: a plain engine or accessor, tracked; Svelte: a getter over the reactive prop) and, when it changes, re-subscribes and re-seeds its snapshot from the new engine. Angular already adopted a late `[engine]` via `ngOnChanges`; that is now pinned by a test. Set `autoStart` to `false` when the engine is expected later and the shell should not start its own path meanwhile.
