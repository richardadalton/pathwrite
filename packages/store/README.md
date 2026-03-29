# @daltonr/pathwrite-store

HTTP, localStorage, and AsyncStorage persistence for Pathwrite.

## Installation

```bash
npm install @daltonr/pathwrite-store
```

`AsyncStorageStore` additionally requires `@react-native-async-storage/async-storage`, which is not installed automatically.

## Quick start

```typescript
import { PathEngine } from "@daltonr/pathwrite-core";
import { HttpStore, persistence, restoreOrStart } from "@daltonr/pathwrite-store";

const store = new HttpStore({
  baseUrl: "/api/wizard",
  headers: { Authorization: `Bearer ${token}` },
  // Expects these three endpoints on your backend:
  //   PUT    /api/wizard/state/{key}   — save state (body: SerializedPathState)
  //   GET    /api/wizard/state/{key}   — load state (return 404 when not found)
  //   DELETE /api/wizard/state/{key}   — delete state on completion
});

const key = `user:${userId}:onboarding`;

const { engine, restored } = await restoreOrStart({
  store,
  key,
  path: onboardingWizard,
  initialData: { name: "", email: "" },
  observers: [
    persistence({ store, key, strategy: "onNext" }),
  ],
});

// Pass the engine to any framework adapter
// e.g. const { snapshot, next } = usePath({ engine });

if (restored) {
  console.log("Resuming from saved progress.");
}
```

## Stores

| Store | Import | Use for |
|---|---|---|
| `HttpStore` | `@daltonr/pathwrite-store` | REST API backend (browser or Node). |
| `LocalStorageStore` | `@daltonr/pathwrite-store` | Browser `localStorage` or `sessionStorage`. Falls back to in-memory in Node/test environments. |
| `AsyncStorageStore` | `@daltonr/pathwrite-store` | React Native. Requires `@react-native-async-storage/async-storage` as a peer dependency. |

All three implement the `PathStore` interface from `@daltonr/pathwrite-core` (`save`, `load`, `delete`) and are interchangeable as far as `persistence()` and `restoreOrStart()` are concerned.

## Save strategies

Pass `strategy` to `persistence()` to control when saves fire.

| Strategy | When it saves | API calls (5 keystrokes + Next) |
|---|---|---|
| `"onNext"` *(default)* | After `next()` navigates to a new step | 1 |
| `"onEveryChange"` | Every settled `stateChanged` event (add `debounceMs` for text inputs) | 6 (or 2 with `debounceMs: 500`) |
| `"onSubPathComplete"` | When a sub-path finishes and the parent path resumes | varies |
| `"onComplete"` | When the path completes; does not delete the record afterward | 0 mid-flow, 1 at end |
| `"manual"` | Never — call `store.save(key, engine.exportState()!)` yourself | 0 |

## restoreOrStart()

`restoreOrStart()` handles the standard load/restore-or-start pattern in a single call. It tries `store.load(key)`; if a saved state is found it reconstructs the engine at the saved step via `PathEngine.fromState()`; if nothing is found it creates a fresh engine and calls `engine.start(path, initialData)`. Observers are wired before the first event in both cases, so the persistence observer never misses a state transition.

```typescript
const { engine, restored } = await restoreOrStart({
  store,          // any PathStore
  key,            // string session key, e.g. "user:123:signup"
  path,           // PathDefinition for the wizard
  initialData,    // used only when starting fresh (not on restore)
  observers,      // PathObserver[] — wired before the first event
  pathDefinitions // optional: required when the path uses sub-paths
});
```

`engine` is a plain `PathEngine` ready to pass to any framework adapter. `restored` is `true` when a saved session was found. When the path later completes, the `persistence` observer automatically calls `store.delete(key)` so a returning user starts fresh.

## Further reading

- [docs/guides/persistence.md](../../docs/guides/persistence.md) — strategies, offline patterns, custom stores, and the full `HttpStore` options reference
- [docs/README.md](../../docs/README.md) — documentation index
