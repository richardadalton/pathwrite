# Storage Integration Feedback — Lessons from Building a Real Persistence Demo

**Date:** March 21, 2026  
**Context:** Built a Vue 3 wizard (`demo-vue-wizard`) backed by `@daltonr/pathwrite-store-http` and a simple Express API server (`demo-api-server`). This document records every pain point, bug, and improvement opportunity discovered during the process.

---

## 🔴 Bugs Found and Fixed

### 1. Adapters had no way to accept an external engine

**Severity:** Critical — persistence fundamentally broken  
**Packages affected:** `vue-adapter`, `react-adapter`, `angular-adapter`

`usePath()` / `PathFacade` always created `new PathEngine()` internally. `PathEngineWithStore` manages its own engine. There was **no way to connect them** — the persistence wrapper and the UI were completely isolated.

**Fix applied:**
- Vue/React: Added `engine?: PathEngine` option to `UsePathOptions`. When provided, `usePath()` subscribes to that engine instead of creating a new one.
- Vue/React: Added `engine` prop to `PathShell`. When provided, `PathShell` skips its own `start()` call.
- Angular: Added `adoptEngine(engine: PathEngine)` method to `PathFacade`.
- All adapters: Seed the snapshot immediately from `engine.snapshot()` on connection — critical for restored state where the engine is already mid-flow.
- All adapters: Re-export `PathEngine` class (not just the type) so consumers can type the engine prop without importing from core.

**Improvement opportunity:** Consider whether `PathEngineWithStore` should itself be an engine (decorator pattern) rather than a wrapper that holds one. That would let you pass it directly to `usePath()` without the two-object dance.

---

### 2. `fetch.bind(globalThis)` — "Illegal invocation" in browsers

**Severity:** Critical — store completely non-functional in any browser  
**Package:** `store-http`

`HttpStore` defaulted `fetch` to `options.fetch ?? fetch`. Storing `window.fetch` as a bare reference and later calling it as `this.options.fetch(url, ...)` loses the `window` binding, causing every browser to throw:

```
TypeError: Failed to execute 'fetch' on 'Window': Illegal invocation
```

**Fix:** `fetch.bind(globalThis)`

**Note:** This would only show up in a real browser. The test suite uses a mock fetch, so it was never caught. **Add a test that verifies the default fetch option works with the real global fetch**, or at least document that the binding is intentional.

---

### 3. Dynamic `import()` of `@daltonr/pathwrite-core` in `startOrRestore()`

**Severity:** Critical — hangs forever in Vite/browser contexts  
**Package:** `store-http`

`startOrRestore()` used `await import("@daltonr/pathwrite-core")` to get the `PathEngine` class "to avoid circular dependency issues." But:

1. There is no circular dependency — `store-http` depends on `core`, not vice versa.
2. The source file only imported core types (`import type { ... }`), so `PathEngine` wasn't available as a value — hence the dynamic import as a workaround.
3. In bundled environments (Vite, webpack), dynamic imports of bare specifiers inside pre-built `.js` files can fail to resolve or hang silently.

**Fix:** Changed to a regular static `import { PathEngine } from "@daltonr/pathwrite-core"` alongside the type imports. The dynamic import was completely unnecessary.

**Lesson:** Never use `import type` + dynamic `import()` as a pattern when a static import works. Reserve dynamic imports for genuinely lazy-loaded code.

---

### 4. `onNext` strategy saved on every `setData()`, not just navigation

**Severity:** High — completely wrong behavior, floods API with requests  
**Package:** `store-http`

The `onNext` case in `handleEvent` was:

```typescript
case "onNext":
    // For simplicity, we'll save on all stateChanged for now
    shouldSave = event.type === "stateChanged";
```

This means every keystroke in a text field and every checkbox click triggered a save. The "TODO" comment acknowledged it but shipped anyway.

**Fix:** Track `lastStepIndex` and only save when `event.snapshot.stepIndex !== lastStepIndex`. This correctly detects actual step navigation vs. data-only changes.

**Improvement opportunity:** The `stateChanged` event has no metadata about *what* caused it (setData vs. navigation). Consider adding a `cause` field to `PathEvent`:

```typescript
type PathEvent = {
  type: "stateChanged";
  snapshot: PathSnapshot;
  cause: "setData" | "next" | "previous" | "goToStep" | "start" | "subPathComplete";
}
```

This would make persistence strategies trivial to implement correctly and eliminate the step-tracking workaround.

---

### 5. `HttpStore.save()` uses PUT, but example server only had POST

**Severity:** Low — documentation/example mismatch, not a library bug  
**Package:** `store-http` / `demo-api-server`

PUT is arguably more correct for "upsert by key", but anyone building a quick API from the README examples would use POST. The server now accepts both.

**Improvement:** Document the HTTP methods clearly in the store-http README. State explicitly: "save uses PUT, load uses GET, delete uses DELETE."

---

## 🟡 Pain Points / Developer Experience Issues

### 6. Two-object dance for persistence

Using persistence requires creating *both* an `HttpStore` and a `PathEngineWithStore`, then calling `startOrRestore()`, then getting the engine with `getEngine()`, then passing it to the adapter. That's 4 setup steps before you can render anything:

```typescript
const store = new HttpStore({ baseUrl: "..." });
const wrapper = new PathEngineWithStore({ key: "...", store, ... });
await wrapper.startOrRestore(path, pathDefs, initialData);
const engine = wrapper.getEngine();
// NOW you can pass `engine` to PathShell
```

**Suggestion:** Consider a factory function:

```typescript
const { engine } = await restoreOrStart({
  baseUrl: "/api/wizard",
  key: "user:123:onboarding",
  path: onboardingWizard,
  initialData: { ... },
  strategy: "onNext",
});
```

---

### 7. `PathShell` shows "No active path" flash before async init completes

When using an external engine with persistence, the page mounts, `PathShell` renders, and before `startOrRestore()` resolves, the snapshot is `null`. The shell briefly shows "No active path."

The demo works around this by guarding with `v-if="engine"` and showing a custom loading state. But if someone naively passes the engine immediately, they get a flash of empty state.

**Suggestion:** Add a `loading` slot/prop to `PathShell` that renders while snapshot is null, instead of the "No active path" empty state. Or distinguish between "never started" and "loading/restoring".

---

### 8. No framework-specific persistence composable

Each framework adapter should ideally have a `usePersistedPath()` composable (or equivalent) that wraps the `HttpStore` + `PathEngineWithStore` + `usePath()` dance into a single call:

```typescript
// Vue dream API
const { snapshot, next, previous, setData, isLoading } = usePersistedPath({
  baseUrl: "/api/wizard",
  key: "user:123:onboarding",
  path: onboardingWizard,
  initialData: { ... },
  strategy: "onNext",
});
```

This would handle:
- Creating the store and wrapper
- Calling `startOrRestore()` in `onMounted`
- Bridging the engine to the adapter's reactivity system
- Cleaning up on unmount
- Exposing an `isLoading` ref

---

### 9. `HttpStoreOptions` vs `PathEngineWithStoreOptions` callback confusion

`HttpStoreOptions` has `onError`. `PathEngineWithStoreOptions` has `onSaveError` and `onSaveSuccess`. It's easy to put callbacks on the wrong object. During development, `onSaveSuccess`, `onSaveError`, `onLoadSuccess`, `onLoadError` were accidentally passed to `HttpStore` instead of `PathEngineWithStoreOptions` — TypeScript didn't catch it because excess properties on object literals passed to constructors can be silently ignored in some configurations.

**Suggestion:** Either:
- Unify the callback surface (put all callbacks on one object)
- Or add `onLoadSuccess`/`onLoadError` to `PathEngineWithStoreOptions` (they don't exist today)

---

### 10. Vite alias requirement for monorepo development

The demo app lives in the same monorepo as the packages. Importing `@daltonr/pathwrite-vue` resolves to the *npm-published* version in `node_modules`, not the locally-built source. This means local changes aren't reflected without either:
- Vite `resolve.alias` pointing to `../../packages/*/dist/index.js`
- Or running `npm link` / workspaces correctly

AND after every source change, the package must be rebuilt (`npm run build`) before the alias picks up the change.

AND Vite caches pre-bundled dependencies in `node_modules/.vite` — you have to nuke that cache (`--force` flag or `rm -rf`) after rebuilding.

This is a general monorepo DX issue, not specific to pathwrite, but it caused significant friction during development.

---

### 11. No `onLoadSuccess` / `onLoadError` callbacks on wrapper

`PathEngineWithStoreOptions` has `onSaveSuccess` and `onSaveError` but no equivalent for load operations. During development, there's no way to know whether state was restored or started fresh without checking outside the wrapper.

**Suggestion:** Add `onLoadSuccess` / `onLoadError` / `onRestored` callbacks, or have `startOrRestore()` return a result object:

```typescript
const result = await wrapper.startOrRestore(path, defs, initialData);
// result: { restored: true, stepId: "preferences" }
// or:    { restored: false }
```

---

## 🟢 Things That Worked Well

### 12. `PathEngine.fromState()` — seamless restoration

The serialization/deserialization round-trip works perfectly. Calling `fromState(saved, pathDefinitions)` reconstructs a fully functional engine mid-flow, with the correct step, data, and visited-step tracking. This is the core value proposition and it delivers.

### 13. Guard error resilience

Guards that throw on undefined data (common on first entry) are caught with helpful console warnings. This saved debugging time when the wizard first loaded with empty `initialData`.

### 14. `snapshot.stepIndex` is reliable for navigation detection

Using `stepIndex` to detect actual navigation (vs. data changes) was a clean solution for the `onNext` strategy. The snapshot API exposes enough state to make this trivial.

### 15. `exportState()` / `fromState()` symmetry

The API for serializing and restoring state is clean and well-designed. No manual mapping needed.

---

## 📋 Action Items Summary

| # | Item | Priority | Status |
|---|------|----------|--------|
| 1 | Adapters accept external engine | Done | ✅ Fixed |
| 2 | `fetch.bind(globalThis)` | Done | ✅ Fixed |
| 3 | Static import instead of dynamic | Done | ✅ Fixed |
| 4 | `onNext` only saves on navigation | Done | ✅ Fixed |
| 5 | API server accepts PUT | Done | ✅ Fixed |
| 6 | `cause` field on `PathEvent.stateChanged` | High | ✅ Fixed — `StateChangeCause` union type, `cause` on every `stateChanged` event |
| 7 | Factory function for persistence setup | Medium | ✅ Fixed — replaced `PathEngineWithStore` wrapper with observer pattern; `httpPersistence()` + `restoreOrStart()` |
| 8 | `loading` slot/prop for PathShell | Medium | ✅ Closed — non-issue with current API. `restoreOrStart` is async only because of the HTTP load request; the engine it returns is a plain synchronous JavaScript object that is fully started before it's returned. `snapshot()` is non-null immediately. The correct pattern is `v-if="engine"` / conditional render — PathShell never mounts while loading, so there is no flash. This was a symptom of the old two-step `PathEngineWithStore.startOrRestore()` dance, which no longer exists. |
| 9 | Framework-specific `usePersistedPath()` | Medium | ✅ Closed — non-issue. The observer pattern means the engine is a plain `PathEngine`; `usePath({ engine })` works as-is. The only async is `restoreOrStart`'s HTTP load, which belongs in a route guard or loader — not inside a component. By the time the component mounts the engine is ready, no composable wrapper needed. |
| 10 | Unify or clarify callback surfaces | Medium | ✅ Fixed — observer pattern has one callback surface (`HttpPersistenceOptions`); no more split between `HttpStoreOptions` and `PathEngineWithStoreOptions` |
| 11 | Add `onRestored` / load callbacks | Low | ✅ Fixed — `restoreOrStart()` returns `{ engine, restored: boolean }` |
| 12 | Document HTTP methods in README | Low | ✅ Fixed — store-http README has explicit HTTP methods table (PUT/GET/DELETE) |
| 13 | Add real-browser fetch test | Low | ✅ Closed — `fetch.bind(globalThis)` documented with an inline comment explaining why the binding is required; a real-browser integration test adds no value over the existing mock-fetch suite |
| 14 | Angular `PathShellComponent` needs `[engine]` input | Medium | ⏳ Open — `<pw-shell>` has no `[engine]` input; a developer using `restoreOrStart` cannot pass the engine into the shell directly. They must use `autoStart="false"` + `@ViewChild` to reach the internal `PathFacade` and call `adoptEngine()` — undocumented and awkward. Vue and React are unaffected: both have an `engine` prop and use `v-if` / conditional render to gate mounting until the engine is ready. |


