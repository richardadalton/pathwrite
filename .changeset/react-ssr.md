---
"@daltonr/pathwrite-react": patch
"@daltonr/pathwrite-react-native": patch
---

`usePath()` (and therefore `PathShell`, `PathProvider` and `usePathContext`) now renders under `react-dom/server`. The `useSyncExternalStore` call had no server snapshot, so any server-side or static render threw "Missing getServerSnapshot". `<FieldError>` also used `useLayoutEffect`, which React warns about on the server; it now falls back to a plain effect when there is no `window`.
