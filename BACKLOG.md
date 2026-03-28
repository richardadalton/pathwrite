# Pathwrite Backlog

Issues derived from the adapter DX review (2026-03-28).
Items within each section are roughly priority-ordered.

---

## Cross-cutting

### ~~BL-01 — Change `validationDisplay` default to `"summary"` across all adapters~~ ✓ Done
~~The current default `"inline"` suppresses the shell's error rendering, so newcomers see no feedback at all when they use `fieldErrors` without adding their own error UI. Default should be `"summary"` (show errors in the shell). Rename or alias `"inline"` → `"suppress"` to make intent clear.~~
~~**Affects:** react, vue, svelte, angular, react-native adapters + PathShell in each.~~
All 5 adapters now default to `"summary"`. All existing demos updated with explicit `validationDisplay="inline"` to preserve their inline rendering behaviour. The react-native adapter gained the `validationDisplay` prop for the first time.

### BL-02 — `usePathContext` / `getPathContext` / `injectPath` should return non-null snapshot
Step components are only mounted when a snapshot is active; the null case is impossible at runtime. The current `PathSnapshot | null` return type forces `snapshot!.data` or `snapshot?.data ?? {}` guards throughout every step component. Return `PathSnapshot<TData>` (non-null) from the context helpers.
**Affects:** react, vue, svelte, angular, react-native adapters.

### ~~BL-04 — Document `canMoveNext` auto-derivation from `fieldErrors` more prominently~~ ✓ Done
~~The engine auto-derives `canMoveNext: true` when `fieldErrors` is defined and returns no messages, and `canMoveNext` is not explicitly set. Several demos still define redundant `canMoveNext` guards that just duplicate the fieldErrors logic. This should be the documented "default pattern" front-and-centre.~~
~~**Affects:** docs, demos.~~
Removed redundant `canMoveNext` from the "about-you" step in the React, Vue, and Svelte wizard demos. Updated all three wizard READMEs to reflect auto-derivation as the default pattern. Added inline note to the `canMoveNext` row in the DEVELOPER_GUIDE step fields table.

---

## React

### ~~BL-05 — Add `useField` binding helper to React adapter~~ ✓ Done
~~Every React step component writes `onChange={e => setData("field", e.target.value)}` for each input. A small `useField("name")` helper returning `{ value, onChange }` (typed against `TData`) would eliminate the repetition and improve ergonomics for form-heavy steps.~~
~~**Affects:** react adapter.~~
Added `useField<TData, K>(field)` to `@daltonr/pathwrite-react`. Returns `{ value: string, onChange }` bound to `snapshot.data[field]` — spread directly onto any `<input>`, `<select>`, or `<textarea>`. Updated the react-form `ContactStep` demo to use it for all four fields.

### BL-06 — `usePath().restart()` should not require re-passing path and initialData
`PathShell` exposes a `restart()` handle via `ref` that correctly captures `path` and `initialData` at mount time. But the lower-level `usePath().restart(path, initialData)` always requires re-passing them. Consider overloading or a `createRestarter(path, initialData)` helper.
**Affects:** react adapter.

---

## Vue

### ~~BL-07 — Warn prominently about `shallowRef` requirement for external engines~~ ✓ Done
~~Using `ref(engine)` instead of `shallowRef(engine)` causes Vue to deep-proxy the `PathEngine` class, stripping its private members. The failure mode is a confusing type error. Add a `console.warn` in the adapter when it detects a deep-proxied engine, and add a prominent docs/JSDoc warning.~~
~~**Affects:** vue adapter, docs.~~
Fixed automatically: `usePath` now calls `toRaw(options?.engine)` before using the engine, stripping any Vue reactive proxy the caller may have applied. `ref(engine)` and `shallowRef(engine)` are now both safe.

---

## Svelte

### BL-08 — Warn in JSDoc that destructuring `snapshot` loses reactivity
`const { snapshot } = usePath()` silently copies the current value instead of the getter, breaking reactivity. This is the single most dangerous footgun in the Svelte adapter. Add a `@warn` JSDoc block and a runtime `console.warn` (dev-only) if it can be detected.
**Affects:** svelte adapter, docs.

### BL-09 — Consolidate PathShell import path for Svelte
The demos import `PathShell` via `"@daltonr/pathwrite-svelte/PathShell.svelte"` (the direct path) rather than `"@daltonr/pathwrite-svelte"` (the package index re-export). Ensure `PathShell` is cleanly re-exported from the package index so both paths work and the canonical one is documented.
**Affects:** svelte adapter.

### BL-10 — Audit Svelte component-as-snippet pattern for Svelte 5 stability
PathShell renders step values with `{@render stepSnippets[stepId]()}`, treating Svelte component constructors as callable snippets. This works in current Svelte 5 but relies on undocumented compiled behaviour. Investigate whether this is officially supported, and add a regression test or add an issue to Svelte tracking.
**Affects:** svelte adapter.

---

## Angular

### BL-11 — Add `[engine]` input to Angular `PathShellComponent`
All other adapters accept an external engine via a prop/binding, letting `restoreOrStart` integrate directly. Angular requires a `@ViewChild` + `facade.adoptEngine()` dance in `ngAfterViewChecked` — significantly more complex. Adding `[engine]` input to `pw-shell` that calls `facade.adoptEngine()` internally would bring Angular in line with the other adapters.
**Affects:** angular adapter.

### BL-12 — Standardise event name: `(completed)` → `(complete)` to match Vue
Angular PathShell emits `completed` (past tense); Vue emits `complete` (imperative). Pick one and make them consistent across all adapters. Deprecate the old name with a migration note.
**Affects:** angular adapter, docs.

---

## React Native

### BL-13 — Add `AsyncStorageStore` to `@daltonr/pathwrite-store-http`
`LocalStorageStore` uses `window.localStorage`, which doesn't exist in React Native. RN apps need `@react-native-async-storage/async-storage`. Adding an `AsyncStorageStore` (or a factory that accepts any async key-value store) to the existing store-http package would unblock RN persistence without a new package.
**Affects:** store-http package.

### BL-14 — Show current step title in RN PathShell progress header
The RN PathShell shows colour-coded dots with no text labels. Web PathShell shows numbered dots with step titles. Add the current step title (or at minimum the step number and total) to the RN header so users can orient themselves in longer wizards.
**Affects:** react-native adapter.

### BL-15 — Add `disableBodyScroll` prop to RN PathShell
The PathShell body wraps step content in a `ScrollView`. Steps that contain a `FlatList` or other virtualized list trigger the "VirtualizedList inside ScrollView" warning. A `disableBodyScroll` prop would remove the `ScrollView` wrapper so the step can manage its own scroll.
**Affects:** react-native adapter.

### BL-16 — Document RN monorepo metro config in the main README
The `metro.config.js` requires non-obvious `resolver.nodeModulesPaths` and `watchFolders` settings to find workspace packages. This took a dedicated fix commit. Add a "Monorepo setup" section to the docs and/or the react-native adapter README.
**Affects:** docs.

### BL-17 — Consolidate RN demos into a single multi-path app
Each RN demo is a full Expo project (~8 files of boilerplate before any pathwrite code). Unlike web adapters where adding a demo is ~10 meaningful files, the Expo overhead is heavy. Consider a single RN showcase app with a menu for switching between demo paths.
**Affects:** react-native-demos.
