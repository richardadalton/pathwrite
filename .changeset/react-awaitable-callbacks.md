---
"@daltonr/pathwrite-react": patch
"@daltonr/pathwrite-react-native": patch
---

`usePath()` / `usePathContext()` action callbacks (`start`, `startSubPath`, `next`, `previous`, `cancel`, `goToStep`, `goToStepChecked`, `setData`, `resetStep`, `restart`, `retry`, `suspend`), `PathShellActions` (custom footers) and the `PathShell` ref handle's `restart` are now typed `() => Promise<void>` — they always returned the engine's promise, but were declared `void`, so `await next()` did not type-check. `validate()` stays synchronous. Type-only change; matches the other four adapters.
