# @daltonr/pathwrite-svelte

## 0.14.0

### Minor Changes

- 41055d4: **The engine is generic over its data.** `PathEngine<TData>` types `start`'s definition and initial data, `setData`'s key and value, `snapshot().data`, the events passed to `subscribe`, the observers in `PathEngineOptions<TData>` and `PathEngine.fromState<TData>()`. Every adapter's `usePath<TData>()` (Angular's `PathFacade<TData>`) creates a typed engine, its `start` takes a `PathDefinition<TData>`, and `@daltonr/pathwrite-store`'s `restoreOrStart<TData>()` returns a `PathEngine<TData>`. The default type parameter keeps the previous loose surface, so untyped code compiles unchanged, and `PathDefinition<any>` is gone from every public signature: where a surface must accept a definition over any data (shell `path` props, `startSubPath`) it takes plain `PathDefinition`.

  Step and path hooks (`onEnter`, `canMoveNext`, `select`, `onComplete`, …) are now declared with method syntax, which is what lets a `PathDefinition<Typed>` flow into those untyped positions. Object literals are unaffected. Prefer a `type` alias for your data: an `interface` that extends `PathData` carries a string index signature, so `setData` accepts any key on it (values for known keys are still checked).

  **Step choices: one id in every hook.** Inside a `StepChoice`, `onLeave`, `canMoveNext` and `canMovePrevious` on the selected inner step received the inner step's id as `ctx.stepId` and, because the visit history is keyed by the choice, an `isFirstEntry` that was always `true`. They now get the choice's own id like every other hook and the snapshot (`formId` still names the inner step), and a correct `isFirstEntry`. A guard on an inner step that compared `ctx.stepId` to the inner id needs to compare to the choice's id instead.

  Type-level changes that may need a one-line edit: `errorPhaseMessage()` takes an `ErrorPhase` rather than any string; `PathStore` and observer types are unchanged.

  **Svelte `PathShell` (breaking):** step components are passed as a `steps` record (`<PathShell steps={{ personalInfo: PersonalInfoStep }} />`) instead of loose props keyed by step id, matching the React and Solid shells. The props no longer carry an index signature, so misspelled props are now type errors, and `onevent` is typed `(event: PathEvent) => void`.

  Also in this release: the Svelte store holds the snapshot in `$state.raw` (no deep proxy per snapshot); the Angular shell memoises its field-error, warning and step rows per snapshot and tracks them by key, so unchanged rows keep their DOM nodes across change detection.

### Patch Changes

- dad0380: Every adapter re-exports the `StepStatus` type (`"completed" | "current" | "upcoming"`, the `status` of each entry in `snapshot.steps`) alongside the other core types, so custom headers need not import it from core directly.
- Updated dependencies [41055d4]
  - @daltonr/pathwrite-core@0.14.0

## 0.13.1

### Patch Changes

- Documentation only — no code changes. The README quick starts now compile as written: core's data type extends `PathData` (the example failed to type-check before), Solid's and Vue's step components import the shared data type instead of referring to one declared in another file, React Native imports only what it uses, the React / React Native examples drop null guards the non-null context snapshot no longer needs, and Svelte's completion callback parameter is typed.
- Updated dependencies
  - @daltonr/pathwrite-core@0.13.1

## 0.13.0

### Patch Changes

- b46447a: `usePathContext()` now exposes the full action surface in every adapter. Svelte's `PathContext` lacked `start`, `startSubPath` and `validate`, so a step component could not launch a sub-path through the context; it now extends `UsePathReturn`, and `<PathShell>` provides all three. Angular's `UsePathContextReturn` lacked `validate()`; it is now derived from `PathFacade` (`Pick<PathFacade, FacadeContextMethod>`) and forwards `validate()`. Both were hand-written copies of the hook / facade surface that fell behind when `validate()` was added; each adapter now has a type-level test asserting the context matches its hook or facade, so this cannot recur silently.
- fe25e97: An `engine` that arrives after mount is adopted. `PathShell`'s `engine` prop (and `usePath({ engine })`) used to be read once at mount; an engine passed later — the common case when `restoreOrStart()` resolves asynchronously — was silently ignored while the shell kept driving its own path. The hook now tracks the engine in each framework's idiom (React / React Native: re-read on every render; Vue: a plain engine, ref or getter, watched; Solid: a plain engine or accessor, tracked; Svelte: a getter over the reactive prop) and, when it changes, re-subscribes and re-seeds its snapshot from the new engine. Angular already adopted a late `[engine]` via `ngOnChanges`; that is now pinned by a test. Set `autoStart` to `false` when the engine is expected later and the shell should not start its own path meanwhile.
- 42cbd0a: `restoreKey` restores a remounted inner shell in place. The value stored under `data[restoreKey]` is still the inner `PathSnapshot` (so outer steps keep reading `data.<key>.data.<field>`), but it now also carries a `serializedState` field — the inner engine's `exportState()`. On remount the inner engine is rebuilt from it with `PathEngine.fromState()` instead of starting the path and jumping to the step, which re-ran `onEnter` on the first step and `onLeave` / `onEnter` on the way to the target on every remount and lost attempted / visited state (a blocked attempt's errors vanished when the user came back). A stored value without `serializedState`, written by an older version, still restores the old way. Every shell has a remount test for this. Angular's `PathFacade` gains an `engine` getter.
- 4cccbb1: `.svelte` files are now type-checked: `svelte-check` runs as the first step of the package build (`npm run check`). It found and this release fixes: `PathShell` calling `restart(path, initialData)` against the zero-argument `restart()` (harmless at runtime, but wrong); `PathContext.snapshot` typed non-null while it is `null` with no active path (the README already narrows it with `{#if ctx.snapshot}`); the `path` prop typed optional but passed unguarded to `start()` — the shell now throws a clear error when neither `path` nor `engine` is given; and an `import.meta.env` read that relied on Vite's ambient types.
- f6e8bae: `PathShellActions` is exported and is the type of the second argument of a custom `footer` snippet (`{#snippet footer(snap, actions)}`), which was typed `object`. Same shape as the other adapters' `PathShellActions`.
- Updated dependencies [ca1eba7]
  - @daltonr/pathwrite-core@0.13.0

## 0.12.0

### Minor Changes

- **`completionBehaviour`** — `"stayOnFinal"` (default), `"dismiss"`, or `"reset"`. Use the `{#snippet completion(snap)}` slot to render a custom done screen when `stayOnFinal` is active.

- **`restoreKey` prop on `PathShell`** — pass a string key and the inner shell automatically saves its full state (data + active step) into the outer path's data on every change, restoring on remount. Eliminates state loss when navigating away from a wizard step that hosts a nested shell.

- **`layout` prop on `PathShell`** _(replaces `footerLayout`)_ — accepted values: `"auto"` (default), `"wizard"`, `"form"`, `"tabs"`. The new `"tabs"` value hides both the progress header and footer in a single prop.

- **`validateWhen` prop on `PathShell`** — when it becomes `true`, calls `validate()` on the engine. Bind to the outer snapshot's `hasAttemptedNext` when nesting a shell inside a wizard step.

- **`services` prop on `PathShell` + `usePathContext<TData, TServices>()`** — pass an arbitrary services object to all step components without prop-drilling. Access it as `usePathContext<TData, TServices>().services`.

- **`goToStep(stepId, options?)` / `goToStepChecked(stepId, options?)`** — both now accept `{ validateOnLeave: true }` to mark the departing step as attempted before navigating.

- **Dev warning for camelCase callbacks** — passing `onComplete`, `onCancel`, or `onEvent` (camelCase) now emits a `console.warn` in development. Svelte requires lowercase: `oncomplete`, `oncancel`, `onevent`.

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
