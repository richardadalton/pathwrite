---
"@daltonr/pathwrite-react": patch
"@daltonr/pathwrite-react-native": patch
---

`usePathContext()` now types `snapshot` as `PathSnapshot<TData> | null`, matching `usePath()` and what actually happens at runtime: under a bare `<PathProvider>` it is `null` until `start()` is called (and after cancel or a `"dismiss"` completion). It was declared non-null, so code that read `snapshot.data` under a provider crashed with no warning from the compiler. Step components rendered by `<PathShell>` only exist while a snapshot does, so they narrow with a plain `if (!snapshot) return null;` — the pattern the docs already showed. `useField()` and `<FieldError>` are null-safe: with no active path they yield an empty value and no messages instead of throwing.
