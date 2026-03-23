# @daltonr/pathwrite-store-http

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
