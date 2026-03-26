# Feedback — localStorage Demo Development

_March 2026 · `apps/vue-demos/demo-vue-storage`_

---

## What we built

A Vue wizard demo that:
- Collects a list of people on step 1 (extended textarea inputs)
- Launches a per-person two-step sub-wizard (background + goals) on step 2
- Shows a read-only summary on step 3
- Saves every change to localStorage, debounced at 500 ms
- On first load calls `restoreOrStart` — restores mid-session if a snapshot exists, otherwise starts fresh
- Supports **multiple concurrent sessions** via a session picker home screen backed by `LocalStorageStore.list()`

---

## What went smoothly

### `PathStore` interface is the right shape
The three-method contract (`save / load / delete`) was exactly right for a localStorage adapter. No changes were needed to core. `LocalStorageStore` dropped in as a `PathStore` replacement for `HttpStore` without touching anything in `httpPersistence` or `restoreOrStart`.

### `httpPersistence` + `restoreOrStart` composed well
The observer factory pattern meant persistence logic was completely decoupled from UI. The demo's App.vue just calls `restoreOrStart`, hands the engine to `PathShell`, and everything else (saving, deleting on completion, debouncing) is handled invisibly. That composability held up well when we added multi-session — only the key changed per session.

### `onSubPathComplete` data merging worked cleanly
Writing the per-member profile data back into the parent path's `profiles` map via `onSubPathComplete` + `meta.memberIndex` is a clean pattern. No awkward prop passing or shared state — the sub-wizard result flows naturally back to the parent through the engine's own lifecycle hook.

### Memory fallback in Node made tests trivial
Because `LocalStorageStore` falls back to an in-memory `Map` when `localStorage` is not defined (Node/vitest environment), the entire test suite ran without any JSDOM or browser environment setup. All 36 `LocalStorageStore` tests pass in a plain Node environment.

### `list()` was a natural extension
Once the demo needed a session picker, `list()` was the obvious missing method. Adding `getAllKeys?()` as an optional extension point on `StorageAdapter` kept the base interface minimal while unlocking `list()` and `clear()` for adapters that support it.

---

## Issues encountered (and what they revealed)

### 1. `storage: null` silently fell back to `localStorage` instead of memory

**What happened:** The original implementation used `if (options.storage)` to detect a provided adapter. This is falsy for `null`, so passing `storage: null` — which was documented as "force memory fallback" — would silently use the global `localStorage` in a browser environment instead.

**Fix:** Changed to `if (options.storage !== undefined)` so `null` and a real adapter are both handled explicitly, and only a missing option uses the environment detection path.

**Observation:** This is a classic "truthy check swallows explicit null" footgun. The comment said one thing and the code did another, but only in a browser. It would have been silent in tests because `localStorage` is undefined in Node.

---

### 2. `WizardData` and `ProfileSubData` didn't satisfy the `PathData` constraint

**What happened:** `PathData = Record<string, unknown>` requires an index signature. TypeScript refuses to accept a plain interface without one as a type argument to `PathDefinition<T>` or as a value where `PathData` is expected, because the interface might have properties that violate the index type.

**Fix:** Both interfaces now `extend PathData`, which adds `[key: string]: unknown` implicitly and makes all properties `unknown`-compatible.

**Observation:** This is an unavoidable TypeScript trade-off when generic containers use `Record<string, unknown>` as a bound. It's not a library design problem — but the error messages were deeply nested and not immediately obvious. A note in the developer guide about needing `extends PathData` (or the index signature) on custom data shapes would save time.

---

### 3. `PathDefinition<WizardData>` not assignable to `PathDefinition<PathData>` in `restoreOrStart`

**What happened:** `RestoreOrStartOptions.path` was typed as `PathDefinition` (i.e. `PathDefinition<PathData>`). Passing a `PathDefinition<WizardData>` failed because `PathStep<WizardData>` has callback parameters typed as `PathStepContext<WizardData>`, which is more specific than `PathStepContext<PathData>`. Function parameter types are contravariant — so `PathDefinition<WizardData>` is not a subtype of `PathDefinition<PathData>`.

**Fix:** Changed `RestoreOrStartOptions.path` to `PathDefinition<any>` (and `pathDefinitions` to `Record<string, PathDefinition<any>>`). `PathDefinition<WizardData>` is assignable to `PathDefinition<any>` because `any` disables the strict function-parameter check.

**Observation:** This is a real library API gap. Any typed consumer of `restoreOrStart` with a non-trivial data shape would hit this. The `<any>` fix is correct and pragmatic, but a better long-term solution might be a generic overload: `restoreOrStart<TData extends PathData>(options: RestoreOrStartOptions<TData>)`. That would preserve type safety end-to-end.

---

### 4. `PathEngine` stored in Vue `ref()` lost its class type

**What happened:** Storing a `PathEngine` instance in a Vue `ref<PathEngine | null>` caused the engine to be wrapped in a deep reactive Proxy. The Proxy's TypeScript type loses the class's private members, so passing `engine.value` to `PathShell`'s `:engine` prop failed the structural type check ("missing properties: activePath, pathStack, listeners…").

**Fix:** Changed to `shallowRef<PathEngine | null>`. `shallowRef` makes only the reference reactive, not the value — so the `PathEngine` instance is passed through unwrapped and its full class type is preserved.

**Observation:** This is a subtlety of Vue's reactivity system that affects any class instance with private fields. The `PathShell` component docs or README should call this out explicitly: _"When holding an externally-managed engine in reactive state, use `shallowRef` not `ref`."_ It's a one-word fix but easy to miss.

---

### 5. Vite alias to TypeScript source failed at runtime

**What happened:** We initially added a vite config alias pointing `@daltonr/pathwrite-store-http` to `packages/store-http/src/index.ts` (the TypeScript source) so changes would be reflected without a rebuild. This caused Vite's import analysis plugin to throw "Failed to resolve import" — the alias was configured correctly but Vite's pre-bundler couldn't handle the TypeScript entry point through an alias in this context.

**Fix:** Removed the alias entirely. The workspace symlink (`node_modules/@daltonr/pathwrite-store-http → packages/store-http`) resolves to the built `dist/index.js`, which is identical to how `@daltonr/pathwrite-vue` is resolved in every other demo. Since `store-http` was already built, this works correctly.

**Observation:** The root vitest config _does_ use source aliases successfully (for test resolution). The difference is that vitest uses a different bundler path than Vite's browser dev-server pre-bundler. Having a `build:watch` script for `store-http` (or a vite plugin that properly handles workspace source aliasing) would be the right long-term solution for an inner-loop development workflow.

---

### 6. Pre-existing `workspace:*` protocol broke `npm install`

**What happened:** `apps/vue-demos/demo-vue-course/package.json` had `"@daltonr/pathwrite-vue": "workspace:*"` — a pnpm/Yarn workspace protocol that npm does not support. This caused `npm install` to fail at the root with `EUNSUPPORTEDPROTOCOL`, which meant the new demo couldn't be installed via the normal workspace bootstrap.

**Fix:** Changed `workspace:*` to the explicit version `0.6.3` in `demo-vue-course/package.json`. This was a pre-existing bug — it would have blocked any `npm install` run that included the course demo workspace.

**Observation:** This is a workspace hygiene issue. If the repo is moving from pnpm/Yarn to npm (or was never on pnpm), any `workspace:*` references should be normalised to explicit version numbers. A CI step that runs `npm install` from the root would have caught this immediately.

---

## API design observations

### `PathStore` is clean and extensible
The three-method interface is minimal and correct. The fact that `HttpStore`, `LocalStorageStore`, and theoretically any other backend (IndexedDB, Redis via a server proxy, memory) all implement the same interface without any adapter code is a genuine success.

### `list()` and `clear()` belong on `LocalStorageStore`, not on `PathStore`
The `PathStore` interface deliberately doesn't include `list()` or `clear()` — not every backend can enumerate keys efficiently (HTTP REST stores typically can't). Keeping those methods on `LocalStorageStore` specifically, and making `getAllKeys` optional on `StorageAdapter`, was the right call. Callers who need session management use `LocalStorageStore` directly; callers who only need persistence use the `PathStore` interface.

### `StorageAdapter` type is better than `Storage`
The original implementation typed `storage?` as `Storage | null` (the DOM interface), which requires `length`, `key()`, `clear()` and other methods that a test stub wouldn't implement. Replacing it with the structural `StorageAdapter` interface (`getItem / setItem / removeItem / getAllKeys?`) made tests clean and the API honest about what it actually needs.

### `restoreOrStart` is the right abstraction
The load-or-start pattern is boilerplate that every persistence consumer would write. Having it as a named function makes App.vue intent-clear: "restore if possible, otherwise start fresh." The fact that it also accepts observers means the persistence observer is wired before the first event fires in both branches — which is subtle but important.

---

## Demo structure observations

### The session picker adds real value
A single-snapshot demo would show persistence working. The session picker shows _why_ the key design matters — multiple independent wizards, each with its own lifecycle, all sharing one `LocalStorageStore` instance. It makes `list()` feel necessary rather than academic.

### `shallowRef` + `:key` is the right pattern for externally-managed engines
The combination of `shallowRef` (for type safety) + `:key="engineKey"` (to force PathShell remount when the engine changes) is the canonical way to drive PathShell with an external engine in Vue. This should probably be a documented pattern in the vue-adapter README.

### Session key format (`session:${Date.now()}`)
Simple and works. A timestamp is unique, sortable, and human-readable in DevTools. No UUID library needed. The only edge case is two sessions started in the same millisecond — unlikely but possible. A counter suffix (`session:${Date.now()}-${Math.random().toString(36).slice(2,6)}`) would be more robust.

---

## Suggested follow-ups

| Priority | Item |
|----------|------|
| High | Add a note to the `@daltonr/pathwrite-vue` README: use `shallowRef` when holding a `PathEngine` in reactive state |
| High | Widen `RestoreOrStartOptions` generics properly (`path: PathDefinition<any>` is fixed but `restoreOrStart<TData>` would be better) |
| Medium | Add "custom data shapes must `extend PathData`" to the developer guide |
| Medium | Add a `build:watch` script to `store-http` for a better inner-loop DX when developing against source |
| Low | Normalise all remaining `workspace:*` protocol references in demo `package.json` files |
| Low | Add a README to `demo-vue-storage` with run instructions |
| Low | Consider a `session:${Date.now()}-${nanoid(4)}` key format for robustness |

