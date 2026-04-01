# @daltonr/pathwrite-solid

## 0.12.0

### Minor Changes

- **`completionBehaviour`** — `"stayOnFinal"` (default), `"dismiss"`, or `"reset"`. Use the `completionContent` prop to render a custom done screen when `stayOnFinal` is active.

- **`restoreKey` prop on `PathShell`** — pass a string key and the inner shell automatically saves its full state (data + active step) into the outer path's data on every change, restoring on remount. Eliminates state loss when navigating away from a wizard step that hosts a nested shell.

- **`layout` prop on `PathShell`** *(replaces `footerLayout`)* — accepted values: `"auto"` (default), `"wizard"`, `"form"`, `"tabs"`. The new `"tabs"` value hides both the progress header and footer in a single prop.

- **`validateWhen` prop on `PathShell`** — when it becomes `true`, calls `validate()` on the engine. Bind to the outer snapshot's `hasAttemptedNext` when nesting a shell inside a wizard step.

- **`services` prop on `PathShell` + `usePathContext<TData, TServices>()`** — pass an arbitrary services object to all step components without prop-drilling. Access it as `usePathContext<TData, TServices>().services`.

- **`goToStep(stepId, options?)` / `goToStepChecked(stepId, options?)`** — both now accept `{ validateOnLeave: true }` to mark the departing step as attempted before navigating.

- **`steps`, `renderHeader`, `renderFooter` accept component references directly** — previously required an arrow function wrapper; component references now type-check correctly.

### Patch Changes

- Updated dependencies [431a268]
  - @daltonr/pathwrite-core@0.12.0

## 0.11.0

### Minor Changes

- Add `@daltonr/pathwrite-solid` — SolidJS adapter with `usePath()` composable, `PathShell` component, and `usePathContext()` hook. State is exposed as a `createSignal` accessor with `onCleanup` disposal.

### Patch Changes

- @daltonr/pathwrite-core@0.11.0
