---
"@daltonr/pathwrite-react": minor
"@daltonr/pathwrite-react-native": minor
---

**Breaking:** `PathProvider` is now a headless `PathShell`. It takes a `path` (started once on mount with `initialData`) or an `engine` the parent owns (from `usePath()` or `restoreOrStart()`), and renders `children` only while a path is active, with a new `fallback` prop for the rest of the time (before the start resolves, after `cancel()`, after a `"dismiss"` completion). It throws when given neither. The old form — a bare `<PathProvider>` whose child component called `start()` through the context — no longer works: pass the path to the provider instead (`<PathProvider path={myPath}>`).

Because both providers of the context now gate their children, `usePathContext().snapshot` is typed `PathSnapshot` (non-null) again, matching Vue; the `if (!snapshot) return null;` guards added in the previous release are unnecessary (and harmless). `useField()` and `<FieldError>` rely on it.
