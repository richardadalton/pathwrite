# @daltonr/pathwrite-solid

## 0.15.0

### Patch Changes

- Updated dependencies [0a0ada2]
  - @daltonr/pathwrite-core@0.15.0

## 0.14.1

### Patch Changes

- **`@daltonr/pathwrite-solid` can now be imported.** Every published version from 0.6.0 to 0.14.0 shipped a `dist` built by `tsc`, which cannot compile Solid: `solid-js/jsx-runtime` is types only, and Solid's JSX has to be transformed by `babel-preset-solid` into fine-grained DOM operations. The emitted bundle imported `jsx`, `jsxs` and `Fragment` from a module that exports none of them, so `import "@daltonr/pathwrite-solid"` threw for every consumer. The repository never caught it because the eight Solid demos aliased the package to its source.

  The runtime build now goes through `vite-plugin-solid` and `tsc` emits declarations only. Two builds are published, because a Solid component compiled for the DOM calls client-only APIs at module scope and throws under a server runtime: `dist/index.js` (`generate: "dom"`) and `dist/server.js` (`generate: "ssr"`), both hydratable so they can be used as a pair.

  **New `solid` export condition.** The package now exposes its source at the `solid` condition, which `vite-plugin-solid` puts first in its resolve conditions. A consumer running their own Solid toolchain compiles `src/index.tsx` for their own target, so dom versus ssr generation and hydration match their application exactly, and the output tree-shakes against their build. Consumers without a Solid compiler in the pipeline fall back to the `node`, `browser` and `import` conditions.

  The eight Solid demos no longer alias the adapter to its source. They resolve it through the published export map, the same way a consumer's project does.
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

### Patch Changes

- fe25e97: An `engine` that arrives after mount is adopted. `PathShell`'s `engine` prop (and `usePath({ engine })`) used to be read once at mount; an engine passed later — the common case when `restoreOrStart()` resolves asynchronously — was silently ignored while the shell kept driving its own path. The hook now tracks the engine in each framework's idiom (React / React Native: re-read on every render; Vue: a plain engine, ref or getter, watched; Solid: a plain engine or accessor, tracked; Svelte: a getter over the reactive prop) and, when it changes, re-subscribes and re-seeds its snapshot from the new engine. Angular already adopted a late `[engine]` via `ngOnChanges`; that is now pinned by a test. Set `autoStart` to `false` when the engine is expected later and the shell should not start its own path meanwhile.
- 0b3c860: Custom shell headers follow one rule in every shell: shown whenever progress is not hidden (`hideProgress`, `layout="tabs"`), including for a single-step path; only the default progress header additionally hides for one step. Angular's `pwShellHeader` ignored `hideProgress` and `layout="tabs"`; Solid's `renderHeader` and React Native's `renderHeader` were hidden for single-step paths.
- 42cbd0a: `restoreKey` restores a remounted inner shell in place. The value stored under `data[restoreKey]` is still the inner `PathSnapshot` (so outer steps keep reading `data.<key>.data.<field>`), but it now also carries a `serializedState` field — the inner engine's `exportState()`. On remount the inner engine is rebuilt from it with `PathEngine.fromState()` instead of starting the path and jumping to the step, which re-ran `onEnter` on the first step and `onLeave` / `onEnter` on the way to the target on every remount and lost attempted / visited state (a blocked attempt's errors vanished when the user came back). A stored value without `serializedState`, written by an older version, still restores the old way. Every shell has a remount test for this. Angular's `PathFacade` gains an `engine` getter.
- f64b309: `PathShell` now falls back from a `StepChoice`'s inner step id (`formId`) to the slot's own `stepId` when looking up step content, as the React, Vue and Svelte shells already did. A choice registered under its own id (`steps={{ type: ... }}` / `<ng-template pwStep="type">`) rendered blank in Angular and Solid; content registered under the inner id still takes precedence.
- 2b27f9e: `PathShell` no longer tears down and re-creates the current step component on every engine event. The step render function used to be called inside a tracked render position that read the `{ equals: false }` snapshot signal, so each `setData` (every keystroke) destroyed the step and rebuilt it — the `<input>` lost its DOM node, focus and local state. The rendered step is now keyed on its identity (path, nesting level, step / form id), created once when the step becomes current and kept until the path moves on. The `snapshot` argument passed to the render function is live: its properties read the current snapshot reactively, so `(snap) => <Step snapshot={snap} />` with `createMemo(() => props.snapshot.data)` inside keeps working. `usePathContext().snapshot()` is unchanged.
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

- **`steps`, `renderHeader`, `renderFooter` accept component references directly** — previously required an arrow function wrapper; component references now type-check correctly.

### Patch Changes

- Updated dependencies [431a268]
  - @daltonr/pathwrite-core@0.12.0

## 0.11.0

### Minor Changes

- Add `@daltonr/pathwrite-solid` — SolidJS adapter with `usePath()` composable, `PathShell` component, and `usePathContext()` hook. State is exposed as a `createSignal` accessor with `onCleanup` disposal.

### Patch Changes

- @daltonr/pathwrite-core@0.11.0
