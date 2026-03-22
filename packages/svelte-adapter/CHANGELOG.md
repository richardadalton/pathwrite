# @daltonr/pathwrite-svelte

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
