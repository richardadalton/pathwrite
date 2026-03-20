# @daltonr/pathwrite-angular

## 0.1.4

### Patch Changes

- 9883477: **Typed `setData` in React and Vue adapters**

  `setData` now accepts a generic key/value constraint when `usePath<TData>()` is called with a typed data interface. Passing a wrong key or a value that doesn't match the declared type is a compile-time TypeScript error. Non-generic users (`usePath()` with no type argument) are completely unaffected — the signature collapses to `(key: string, value: unknown)` as before.

  **Fix: CSS stylesheet import path in shell.css**

  The usage comment at the top of the shared `shell.css` file referenced the non-existent `@daltonr/pathwrite-shell.css` package. It now shows the correct per-adapter import paths.

- Updated dependencies [9883477]
  - @daltonr/pathwrite-core@0.1.4

## 0.1.2

### Patch Changes

- 06f6864: Add optional generic on usePath/usePathContext to type snapshot.data; update PathShell APIs (React uses steps map, Vue uses named slots); sync DEVELOPER_GUIDE with current codebase
- Updated dependencies [06f6864]
  - @daltonr/pathwrite-core@0.1.2

## 0.1.1

### Patch Changes

- Initial Release of Pathwrite
- Updated dependencies
  - @daltonr/pathwrite-core@0.1.1
