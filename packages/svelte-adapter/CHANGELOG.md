# @daltonr/pathwrite-svelte

## 0.8.0 - 2026-03-26

### Breaking Changes

- **Renamed `fieldMessages` to `fieldErrors`** — Update snapshot references and step definitions.

### Minor Changes

- **`fieldWarnings` rendering in shell** — Warnings rendered in amber; never block navigation.
- **`onComplete` / `onCancel` props on `PathShell`** — Pass handlers directly on the shell component.
- **`resetStep()` exposed** — Call to revert current step data to its entry state.
- **New snapshot fields** — `isDirty`, `stepEnteredAt`, and `fieldWarnings` all passed through.



## 0.7.0 - 2026-03-24

### Patch Changes

- Coordinated release with `@daltonr/pathwrite-store-http@0.7.0` which adds `LocalStorageStore` for browser-local persistence. No adapter changes.
- Updated dependencies
  - @daltonr/pathwrite-core@0.7.0

## 0.6.3

### Patch Changes

- 24d12ea: Change default `validationDisplay` from `"summary"` to `"inline"` across all shell components. Documentation updates including full Svelte adapter coverage in the Developer Guide.
- Updated dependencies [24d12ea]
  - @daltonr/pathwrite-core@0.6.3

## 0.6.2

### Patch Changes

- Fix duplicate `restart` identifier in PathShell.svelte that caused a build error (`Identifier 'restart' has already been declared`). The destructured `restart` from `usePath()` now uses a local alias (`restartFn`) to avoid colliding with the exported `restart()` function.
  - @daltonr/pathwrite-core@0.6.2

## 0.6.1

### Patch Changes

- @daltonr/pathwrite-core@0.6.1

## 0.5.0

### Minor Changes

- Migrate Svelte adapter to Svelte 5 runes

  **Breaking changes to `@daltonr/pathwrite-svelte`:**

  - `usePath()` snapshot is now a reactive getter instead of a Svelte store. Access via `path.snapshot` (not `$snapshot`). Cannot be destructured.
  - `bindData()` takes a getter function `() => path.snapshot` instead of a `Readable` store. Returns `{ value, set }` instead of a store.
  - `PathContext.snapshot` is a reactive getter, not a `Readable`.
  - Build now uses `@sveltejs/package` (generates `.svelte.js` + `.svelte.d.ts`).
  - No more dependency on `svelte/store`.

### Patch Changes

- @daltonr/pathwrite-core@0.5.0

## 0.4.0 (2026-03-21)

### Features

- **Initial release** of Svelte adapter
- `usePath()` composable with reactive Svelte stores
- `<PathShell>` component with named slots for step content
- `getPathContext()` for accessing path engine from child components
- `bindData()` helper for two-way data binding
- Full TypeScript support with generic typing
- Compatible with Svelte 4.x and above
- Feature parity with React, Vue, and Angular adapters
- Auto-cleanup via `onDestroy`
- Context API for component tree sharing
- Support for external engines (persistence integration)
- Custom header/footer via slots
- Validation message display
- Progress indicator with step status tracking

### Breaking Changes

None (initial release)