# @daltonr/pathwrite-react-native

## 0.12.0

### Minor Changes

- **`completionBehaviour`** — `"stayOnFinal"` (default), `"dismiss"`, or `"reset"`. Use the `completionContent` prop to render a custom done screen when `stayOnFinal` is active.

- **`restoreKey` prop on `PathShell`** — pass a string key and the inner shell automatically saves its full state (data + active step) into the outer path's data on every change, restoring on remount. Eliminates state loss when navigating away from a wizard step that hosts a nested shell.

- **`layout` prop on `PathShell`** *(replaces `footerLayout`)* — accepted values: `"auto"` (default), `"wizard"`, `"form"`, `"tabs"`. The new `"tabs"` value hides both the progress header and footer in a single prop.

- **`validateWhen` prop on `PathShell`** — when it becomes `true`, calls `validate()` on the engine. Bind to the outer snapshot's `hasAttemptedNext` when nesting a shell inside a wizard step.

- **`services` prop on `PathShell` + `usePathContext<TData, TServices>()`** — pass an arbitrary services object to all step components without prop-drilling. Access it as `usePathContext<TData, TServices>().services`.

- **`goToStep(stepId, options?)` / `goToStepChecked(stepId, options?)`** — both now accept `{ validateOnLeave: true }` to mark the departing step as attempted before navigating.

### Patch Changes

- Updated dependencies [431a268]
  - @daltonr/pathwrite-core@0.12.0

## 0.11.0

### Patch Changes

- @daltonr/pathwrite-core@0.11.0

## 0.10.1

### Patch Changes

- Merge defineServices and ServiceUnavailableError into core. Fix camelCase fallback for hyphenated step IDs in Svelte PathShell. Update all package READMEs and documentation.
- Updated dependencies
  - @daltonr/pathwrite-core@0.10.1

## 0.9.0

### Minor Changes

- New `@daltonr/pathwrite-store` package replaces `@daltonr/pathwrite-store-http`.

  - Adds `AsyncStorageStore` for React Native local persistence — pass any async key-value adapter (`@react-native-async-storage/async-storage` works directly)
  - Renames `httpPersistence` → `persistence` (works with any `PathStore`, not just HTTP)
  - Angular `PathShellComponent`: adds `[engine]` input for externally managed engines; renames outputs `complete`, `cancel`, `event` (breaking)
  - React Native `PathShell`: numbered step dots with titles in progress header; adds `disableBodyScroll` prop
  - React adapter: adds `useField` binding helper
  - Svelte adapter: fixes `PathShell` step rendering and import path

### Patch Changes

- Updated dependencies
  - @daltonr/pathwrite-core@0.9.0
