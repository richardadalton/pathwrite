# @daltonr/pathwrite-react-native

## 0.14.1

### Patch Changes

- @daltonr/pathwrite-core@0.14.1

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

### Minor Changes

- f00002f: **Breaking:** `PathProvider` is now a headless `PathShell`. It takes a `path` (started once on mount with `initialData`) or an `engine` the parent owns (from `usePath()` or `restoreOrStart()`), and renders `children` only while a path is active, with a new `fallback` prop for the rest of the time (before the start resolves, after `cancel()`, after a `"dismiss"` completion). It throws when given neither. The old form — a bare `<PathProvider>` whose child component called `start()` through the context — no longer works: pass the path to the provider instead (`<PathProvider path={myPath}>`).

  Because both providers of the context now gate their children, `usePathContext().snapshot` is typed `PathSnapshot` (non-null) again, matching Vue; the `if (!snapshot) return null;` guards added in the previous release are unnecessary (and harmless). `useField()` and `<FieldError>` rely on it.

### Patch Changes

- fe25e97: An `engine` that arrives after mount is adopted. `PathShell`'s `engine` prop (and `usePath({ engine })`) used to be read once at mount; an engine passed later — the common case when `restoreOrStart()` resolves asynchronously — was silently ignored while the shell kept driving its own path. The hook now tracks the engine in each framework's idiom (React / React Native: re-read on every render; Vue: a plain engine, ref or getter, watched; Solid: a plain engine or accessor, tracked; Svelte: a getter over the reactive prop) and, when it changes, re-subscribes and re-seeds its snapshot from the new engine. Angular already adopted a late `[engine]` via `ngOnChanges`; that is now pinned by a test. Set `autoStart` to `false` when the engine is expected later and the shell should not start its own path meanwhile.
- 13702c5: `usePath()` / `usePathContext()` action callbacks (`start`, `startSubPath`, `next`, `previous`, `cancel`, `goToStep`, `goToStepChecked`, `setData`, `resetStep`, `restart`, `retry`, `suspend`), `PathShellActions` (custom footers) and the `PathShell` ref handle's `restart` are now typed `() => Promise<void>` — they always returned the engine's promise, but were declared `void`, so `await next()` did not type-check. `validate()` stays synchronous. Type-only change; matches the other four adapters.
- 39b23d0: `usePathContext()` now types `snapshot` as `PathSnapshot<TData> | null`, matching `usePath()` and what actually happens at runtime: under a bare `<PathProvider>` it is `null` until `start()` is called (and after cancel or a `"dismiss"` completion). It was declared non-null, so code that read `snapshot.data` under a provider crashed with no warning from the compiler. Step components rendered by `<PathShell>` only exist while a snapshot does, so they narrow with a plain `if (!snapshot) return null;` — the pattern the docs already showed. `useField()` and `<FieldError>` are null-safe: with no active path they yield an empty value and no messages instead of throwing.
- 4a4eda0: `usePath()` (and therefore `PathShell`, `PathProvider` and `usePathContext`) now renders under `react-dom/server`. The `useSyncExternalStore` call had no server snapshot, so any server-side or static render threw "Missing getServerSnapshot". `<FieldError>` also used `useLayoutEffect`, which React warns about on the server; it now falls back to a plain effect when there is no `window`.
- 919b991: `PathShell` catches up with the other shells: a `progressLayout` prop (`"merged"` default, `"rootOnly"`, `"activeOnly"`) and the root path's progress bar shown above the active path's dots while a sub-path runs; warnings are no longer rendered when `validationDisplay` is `"inline"` (step components render them, like errors); the completion panel keeps the progress header above it (all steps ticked) unless progress is hidden; and `PathEngine` is re-exported as a value, so `new PathEngine()` needs no second import.
- 21bfe44: `PathShell` no longer disables the Next button when `snapshot.canMoveNext` is false. The button only looked enabled (the disabled style was tied to the busy status alone) but ignored presses, so on a step with `fieldErrors` or a blocking `canMoveNext` the user could never trigger the attempt that reveals the validation summary or the blocking reason. Next now stays pressable, like the other five shells, and is disabled only while a navigation is in flight.
- 0b3c860: Custom shell headers follow one rule in every shell: shown whenever progress is not hidden (`hideProgress`, `layout="tabs"`), including for a single-step path; only the default progress header additionally hides for one step. Angular's `pwShellHeader` ignored `hideProgress` and `layout="tabs"`; Solid's `renderHeader` and React Native's `renderHeader` were hidden for single-step paths.
- 42cbd0a: `restoreKey` restores a remounted inner shell in place. The value stored under `data[restoreKey]` is still the inner `PathSnapshot` (so outer steps keep reading `data.<key>.data.<field>`), but it now also carries a `serializedState` field — the inner engine's `exportState()`. On remount the inner engine is rebuilt from it with `PathEngine.fromState()` instead of starting the path and jumping to the step, which re-ran `onEnter` on the first step and `onLeave` / `onEnter` on the way to the target on every remount and lost attempted / visited state (a blocked attempt's errors vanished when the user came back). A stored value without `serializedState`, written by an older version, still restores the old way. Every shell has a remount test for this. Angular's `PathFacade` gains an `engine` getter.
- 449dae5: `PathShell` now honours `validateWhen` when it is already `true` at mount. The shells applied it before the mount-time `start()`, which resets the engine's validated flag, so a nested shell that remounted with `validateWhen` bound to the outer step's `hasAttemptedNext` (the tabbed layout) never showed its inner errors. Vue's watcher also was not immediate, so a true initial value was never applied at all. All four shells now re-apply `validateWhen` once the path (and any `restoreKey` jump) has settled. Solid and Svelte already ran the effect after `start()` and are unchanged; every shell now has a regression test for the case.
- Updated dependencies [ca1eba7]
  - @daltonr/pathwrite-core@0.13.0

## 0.12.0

### Minor Changes

- **`completionBehaviour`** — `"stayOnFinal"` (default), `"dismiss"`, or `"reset"`. Use the `completionContent` prop to render a custom done screen when `stayOnFinal` is active.

- **`restoreKey` prop on `PathShell`** — pass a string key and the inner shell automatically saves its full state (data + active step) into the outer path's data on every change, restoring on remount. Eliminates state loss when navigating away from a wizard step that hosts a nested shell.

- **`layout` prop on `PathShell`** _(replaces `footerLayout`)_ — accepted values: `"auto"` (default), `"wizard"`, `"form"`, `"tabs"`. The new `"tabs"` value hides both the progress header and footer in a single prop.

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
