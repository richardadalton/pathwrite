# @daltonr/pathwrite-store-http

## 0.8.0 - 2026-03-26

### Minor Changes

- **Compatible with `@daltonr/pathwrite-core@0.8.0`** — No store-http API changes. `fieldErrors` rename and new snapshot fields (`isDirty`, `stepEnteredAt`, `fieldWarnings`) are all in the core and adapters.



## 0.7.0 - 2026-03-24

### Minor Changes

- **LocalStorageStore implementation** — New browser-local persistence adapter that implements the `PathStore` interface for saving wizard state to `localStorage` (or an in-memory fallback in Node/test environments). Features:
  - Automatic prefix-based key namespacing (default: `@daltonr/pathwrite:`)
  - URL-safe key encoding for special characters
  - `list()` method to enumerate all saved sessions under the prefix
  - `clear()` method to delete all sessions at once
  - Pluggable `StorageAdapter` interface (supports `sessionStorage` or custom backends)
  - In-memory fallback when `localStorage` is unavailable (SSR, Node, tests)
  - Full test coverage (36 tests) including error propagation, key encoding, and `httpPersistence`/`restoreOrStart` integration
- **Switchable storage backends demo** — `demo-vue-storage` now demonstrates toggling between `LocalStorageStore` (browser-local) and `HttpStore` (server-backed API) at runtime, showing how both adapters implement the same `PathStore` interface
- **Documentation improvements** — Updated README with `LocalStorageStore` examples, comparison table, and usage guidance

### Dependencies

- @daltonr/pathwrite-core@0.7.0

## 0.6.3

### Patch Changes

- 24d12ea: Change default `validationDisplay` from `"summary"` to `"inline"` across all shell components. Documentation updates including full Svelte adapter coverage in the Developer Guide.
- Updated dependencies [24d12ea]
  - @daltonr/pathwrite-core@0.6.3

## 0.6.2

### Patch Changes

- @daltonr/pathwrite-core@0.6.2

## 0.6.1

### Patch Changes

- @daltonr/pathwrite-core@0.6.1

## 0.5.0

### Patch Changes

- @daltonr/pathwrite-core@0.5.0

## 0.4.0 - 2026-03-21

### Added

- **Initial release** — HTTP persistence store for PathEngine with automatic state saving
- **Five persistence strategies:**
  - `onNext` (default) — Save on successful forward navigation
  - `onEveryChange` — Save on every state change (requires debouncing for text inputs)
  - `onSubPathComplete` — Save when sub-paths complete
  - `onComplete` — Save only when wizard completes
  - `manual` — No auto-save, call `save()` explicitly
- **Debouncing support** — Built-in debouncing for `onEveryChange` strategy
- **Lifecycle callbacks** — `onBeforeSave`, `onSaveSuccess`, `onSaveError`, `onLoadSuccess`, `onLoadError`
- **PathEngineWithStore wrapper** — High-level API with automatic persistence
- **Framework integration examples** — Vue 3, React, Vanilla JS
- **Comprehensive documentation** — 800+ line README with testing guidance, migration patterns, and server-side examples

### Dependencies

- @daltonr/pathwrite-core@0.4.0