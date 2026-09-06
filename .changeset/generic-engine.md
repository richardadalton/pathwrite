---
"@daltonr/pathwrite-core": minor
"@daltonr/pathwrite-react": minor
"@daltonr/pathwrite-react-native": minor
"@daltonr/pathwrite-vue": minor
"@daltonr/pathwrite-svelte": minor
"@daltonr/pathwrite-solid": minor
"@daltonr/pathwrite-angular": minor
"@daltonr/pathwrite-store": minor
---

**The engine is generic over its data.** `PathEngine<TData>` types `start`'s definition and initial data, `setData`'s key and value, `snapshot().data`, the events passed to `subscribe`, the observers in `PathEngineOptions<TData>` and `PathEngine.fromState<TData>()`. Every adapter's `usePath<TData>()` (Angular's `PathFacade<TData>`) creates a typed engine, its `start` takes a `PathDefinition<TData>`, and `@daltonr/pathwrite-store`'s `restoreOrStart<TData>()` returns a `PathEngine<TData>`. The default type parameter keeps the previous loose surface, so untyped code compiles unchanged, and `PathDefinition<any>` is gone from every public signature: where a surface must accept a definition over any data (shell `path` props, `startSubPath`) it takes plain `PathDefinition`.

Step and path hooks (`onEnter`, `canMoveNext`, `select`, `onComplete`, …) are now declared with method syntax, which is what lets a `PathDefinition<Typed>` flow into those untyped positions. Object literals are unaffected. Prefer a `type` alias for your data: an `interface` that extends `PathData` carries a string index signature, so `setData` accepts any key on it (values for known keys are still checked).

**Step choices: one id in every hook.** Inside a `StepChoice`, `onLeave`, `canMoveNext` and `canMovePrevious` on the selected inner step received the inner step's id as `ctx.stepId` and, because the visit history is keyed by the choice, an `isFirstEntry` that was always `true`. They now get the choice's own id like every other hook and the snapshot (`formId` still names the inner step), and a correct `isFirstEntry`. A guard on an inner step that compared `ctx.stepId` to the inner id needs to compare to the choice's id instead.

Type-level changes that may need a one-line edit: `errorPhaseMessage()` takes an `ErrorPhase` rather than any string; `PathStore` and observer types are unchanged.

**Svelte `PathShell` (breaking):** step components are passed as a `steps` record (`<PathShell steps={{ personalInfo: PersonalInfoStep }} />`) instead of loose props keyed by step id, matching the React and Solid shells. The props no longer carry an index signature, so misspelled props are now type errors, and `onevent` is typed `(event: PathEvent) => void`.

Also in this release: the Svelte store holds the snapshot in `$state.raw` (no deep proxy per snapshot); the Angular shell memoises its field-error, warning and step rows per snapshot and tracks them by key, so unchanged rows keep their DOM nodes across change detection.
