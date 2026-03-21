# @daltonr/pathwrite-store-http

REST API persistence for `PathEngine`. Plugs in as a `PathObserver` — the engine emits events, the observer decides when to save. No wrappers, no two-object dance.

---

## Installation

```bash
npm install @daltonr/pathwrite-core @daltonr/pathwrite-store-http
# Plus your framework adapter:
npm install @daltonr/pathwrite-vue   # or react / angular
```

---

## Exports

```typescript
import {
  // Storage adapter
  HttpStore,                    // REST transport: save / load / delete
  
  // Observer factory
  httpPersistence,              // Returns a PathObserver that saves state
  
  // Load/restore orchestration
  restoreOrStart,               // Handles the load/restore-or-start pattern
  
  // Types
  HttpStoreOptions,
  HttpPersistenceOptions,
  RestoreOrStartOptions,
  ObserverStrategy,
  PathStore,                    // Interface that HttpStore implements
  
  // Re-exported from core
  PathData, PathDefinition, PathEvent, PathObserver,
  PathEngineOptions, PathSnapshot, PathStep,
  PathStepContext, SerializedPathState,
  matchesStrategy,
} from "@daltonr/pathwrite-store-http";
```

---

## The one-call approach — `restoreOrStart`

For most use cases, one async call is all you need:

```typescript
import { HttpStore, httpPersistence, restoreOrStart } from "@daltonr/pathwrite-store-http";

const store = new HttpStore({ baseUrl: "/api/wizard" });
const key = "user:123:onboarding";

const { engine, restored } = await restoreOrStart({
  store,
  key,
  path: onboardingWizard,
  initialData: { name: "", email: "" },
  observers: [
    httpPersistence({ store, key, strategy: "onNext" }),
  ],
});

// engine is a plain PathEngine — pass it to any adapter
const { snapshot, next } = usePath({ engine });

if (restored) {
  console.log("Welcome back! Resuming from step", engine.snapshot()?.stepId);
}
```

`restoreOrStart` returns `{ engine, restored }`:
- `engine` — a `PathEngine` pre-wired with HTTP persistence, ready to pass to `usePath({ engine })` or `<PathShell :engine="engine">`
- `restored: boolean` — `true` if state was loaded from the server, `false` if it started fresh

### Vue example

```vue
<script setup lang="ts">
import { PathShell } from "@daltonr/pathwrite-vue";
import { HttpStore, httpPersistence, restoreOrStart } from "@daltonr/pathwrite-store-http";

const store = new HttpStore({ baseUrl: "/api/wizard" });
const key = `user:${userId}:onboarding`;

const { engine } = await restoreOrStart({
  store,
  key,
  path: onboardingWizard,
  initialData: { name: "", email: "" },
  observers: [httpPersistence({ store, key })],
});
</script>

<template>
  <PathShell :path="onboardingWizard" :engine="engine" />
</template>
```

### React example

```tsx
import { HttpStore, httpPersistence, restoreOrStart } from "@daltonr/pathwrite-store-http";

const store = new HttpStore({ baseUrl: "/api/wizard" });
const key = `user:${userId}:onboarding`;

// In a route loader or equivalent — runs before the component mounts
export async function loader() {
  return restoreOrStart({
    store,
    key,
    path: onboardingWizard,
    initialData: { name: "", email: "" },
    observers: [httpPersistence({ store, key })],
  });
}

function WizardPage({ engine }: { engine: PathEngine }) {
  // engine is ready — no loading state needed
  return <PathShell engine={engine} path={onboardingWizard} steps={{ ... }} />;
}
```

---

## The observer approach — `httpPersistence`

`httpPersistence()` returns a `PathObserver` — a plain function `(event, engine) => void`. Pass it to `PathEngine` via the `observers` option:

```typescript
import { PathEngine } from "@daltonr/pathwrite-core";
import { HttpStore, httpPersistence } from "@daltonr/pathwrite-store-http";

const store = new HttpStore({ baseUrl: "/api/wizard" });

const engine = new PathEngine({
  observers: [
    httpPersistence({ store, key: "user:123:onboarding", strategy: "onNext" }),
    // add as many observers as you like — logger, analytics, SQL capture, etc.
  ],
});

await engine.start(myPath, initialData);
```

For restoration, pass observers through `fromState()`:

```typescript
import { PathEngine } from "@daltonr/pathwrite-core";

const saved = await store.load("user:123:onboarding");
const engine = saved
  ? PathEngine.fromState(saved, pathDefs, { observers: [httpPersistence({ store, key: "user:123:onboarding" })] })
  : new PathEngine({ observers: [httpPersistence({ store, key: "user:123:onboarding" })] });

if (!saved) await engine.start(myPath, initialData);
```

This is exactly what `createPersistedEngine` does internally — use it directly if you need more control over the load step or want to add other observers.

---

## Persistence strategies

| Strategy | Saves when | Best for |
|---|---|---|
| `"onNext"` *(default)* | `next()` completes navigation to a new step | Text-heavy forms — 1 save per step |
| `"onEveryChange"` | Any `stateChanged` event (data changes + navigation) | Checkbox/dropdown wizards, crash protection |
| `"onSubPathComplete"` | A sub-path finishes and the parent resumes | Wizards with nested sub-flows |
| `"onComplete"` | The entire path completes | Audit trail / record-keeping only |
| `"manual"` | Never automatically | Full control — call `store.save(key, engine.exportState()!)` yourself |

> **`"onEveryChange"` + text inputs?** Add `debounceMs: 500` to avoid saving on every keystroke.

```typescript
httpPersistence({
  store,
  key: "user:123:onboarding",
  strategy: "onEveryChange",
  debounceMs: 500,   // collapse rapid keystrokes into one save
})
```

---

## HttpStore

`HttpStore` is a thin REST transport. It has three methods:

| Method | HTTP verb | Default URL |
|---|---|---|
| `store.save(key, state)` | `PUT` | `${baseUrl}/state/${encodeURIComponent(key)}` |
| `store.load(key)` | `GET` | `${baseUrl}/state/${encodeURIComponent(key)}` |
| `store.delete(key)` | `DELETE` | `${baseUrl}/state/${encodeURIComponent(key)}` |

Returns `null` from `load()` when the server responds with 404.

### Options

```typescript
const store = new HttpStore({
  baseUrl: "/api/wizard",

  // Optional: custom URL builders
  saveUrl:   (key) => `/v2/paths/${key}`,
  loadUrl:   (key) => `/v2/paths/${key}`,
  deleteUrl: (key) => `/v2/paths/${key}`,

  // Optional: auth headers (static object or async function)
  headers: async () => ({ Authorization: `Bearer ${await getToken()}` }),

  // Optional: custom fetch (for testing, SSR, etc.)
  fetch: myCustomFetch,

  // Optional: transport-level error callback
  onError: (err, operation, key) => console.error(`${operation} failed for ${key}:`, err),
});
```

---

## Multiple observers

Observers compose freely. Each one is a plain function, independent of all others:

```typescript
import { PathEngine } from "@daltonr/pathwrite-core";
import { HttpStore, httpPersistence } from "@daltonr/pathwrite-store-http";

const store = new HttpStore({ baseUrl: "/api/wizard" });

const logger: PathObserver = (event) =>
  console.log(`[wizard] ${event.type}`, 'cause' in event ? event.cause : '');

const analytics: PathObserver = (event) => {
  if (event.type === "stateChanged" && !event.snapshot.isNavigating) {
    trackEvent("wizard_step", { stepId: event.snapshot.stepId });
  }
};

const engine = new PathEngine({
  observers: [
    httpPersistence({ store, key: "user:123:onboarding" }),
    logger,
    analytics,
  ],
});
```

---

## API server contract

Your API server must handle these three endpoints for the default URL scheme:

| Endpoint | Method | Body | Success response |
|---|---|---|---|
| `/state/:key` | `PUT` | JSON `SerializedPathState` | `200 OK` |
| `/state/:key` | `GET` | — | `200 OK` + JSON body, or `404` if not found |
| `/state/:key` | `DELETE` | — | `200 OK` or `404` |

The state is automatically deleted from the server when the path completes (except with the `"onComplete"` strategy, which saves a final record instead).

---

## Callbacks

```typescript
httpPersistence({
  store,
  key: "user:123:onboarding",
  onSaveSuccess: () => console.log("Saved ✓"),
  onSaveError:   (err) => toast.error(`Save failed: ${err.message}`),
});
```

`createPersistedEngine` accepts the same `onSaveSuccess` / `onSaveError` options and passes them through to the persistence observer.
