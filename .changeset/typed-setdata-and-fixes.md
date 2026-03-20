---
"@daltonr/pathwrite-core": patch
"@daltonr/pathwrite-angular": patch
"@daltonr/pathwrite-react": patch
"@daltonr/pathwrite-vue": patch
---

**Typed `setData` in React and Vue adapters**

`setData` now accepts a generic key/value constraint when `usePath<TData>()` is called with a typed data interface. Passing a wrong key or a value that doesn't match the declared type is a compile-time TypeScript error. Non-generic users (`usePath()` with no type argument) are completely unaffected — the signature collapses to `(key: string, value: unknown)` as before.

**Fix: CSS stylesheet import path in shell.css**

The usage comment at the top of the shared `shell.css` file referenced the non-existent `@daltonr/pathwrite-shell.css` package. It now shows the correct per-adapter import paths.

