# Persistence

This is the single authoritative guide for persisting PathEngine state across sessions.

---

## Overview

Persistence in Pathwrite is built on the **observer pattern**. The `PathEngine` emits a `PathEvent` for every state transition — navigation, data changes, completion, and more. A persistence observer is a plain function that receives those events and decides when to write to storage.

```
PathEngine → emits PathEvent → PathObserver (persistence) → PathStore.save()
```

The `persistence()` factory (from `@daltonr/pathwrite-store`) returns a `PathObserver` that closes over a store, a key, and a strategy. Pass it to `PathEngine` via the `observers` option and it runs for the engine's entire lifetime.

```typescript
import { PathEngine } from "@daltonr/pathwrite-core";
import { LocalStorageStore, persistence } from "@daltonr/pathwrite-store";

const store = new LocalStorageStore();

const engine = new PathEngine({
  observers: [
    persistence({ store, key: "user:123:onboarding", strategy: "onNext" }),
  ],
});

await engine.start(myPath, { name: "", email: "" });
```

Observers are registered before the first event fires, so persistence sees every event from the initial `stateChanged` emitted by `start()`.

Multiple observers are supported and independent — each receives the same events in registration order:

```typescript
const engine = new PathEngine({
  observers: [
    persistence({ store, key: "user:123:onboarding" }),
    (event) => console.log(`[wizard] ${event.type}`),
    analyticsObserver,
  ],
});
```

---

## The PathStore Interface

Any persistence backend must implement three methods. The interface is defined in `@daltonr/pathwrite-core` and re-exported from `@daltonr/pathwrite-store`:

```typescript
interface PathStore {
  save(key: string, state: SerializedPathState): Promise<void>;
  load(key: string): Promise<SerializedPathState | null>;
  delete(key: string): Promise<void>;
}
```

`save` receives the full serialised engine state and a string key that identifies this particular in-progress session. `load` returns the saved state or `null` if nothing is stored under that key. `delete` is called automatically when a path completes (to prevent a returning user from restoring a finished wizard).

The `SerializedPathState` shape that flows through all three methods:

```typescript
{
  version: 1,
  pathId: string,
  currentStepIndex: number,
  data: PathData,           // all data fields accumulated so far
  visitedStepIds: string[],
  pathStack: [...],         // sub-path stack, if sub-paths are in use
  _status: "idle",
}
```

This is plain JSON. No functions, no class instances. A backend that stores and returns it verbatim requires no Pathwrite-specific logic.

---

## Built-in Stores

### HttpStore

Persists to a REST API. Your backend must expose three endpoints — save (`PUT`), load (`GET`), and delete (`DELETE`) — that handle the `SerializedPathState` JSON document.

```typescript
import { HttpStore } from "@daltonr/pathwrite-store";

const store = new HttpStore({
  baseUrl: "/api/wizard",
  headers: { Authorization: `Bearer ${token}` },
});
```

By default the store derives endpoint URLs from `baseUrl`:

```
PUT    {baseUrl}/state/{key}   — save
GET    {baseUrl}/state/{key}   — load (return 404 when not found)
DELETE {baseUrl}/state/{key}   — delete
```

Keys are URL-encoded automatically. Trailing slashes on `baseUrl` are stripped.

A minimal Express backend (no Pathwrite-specific logic required):

```typescript
app.put("/api/wizard/state/:key", (req, res) => {
  db.save(req.params.key, req.body);
  res.json({ ok: true });
});

app.get("/api/wizard/state/:key", (req, res) => {
  const state = db.load(req.params.key);
  state ? res.json(state) : res.status(404).end();
});

app.delete("/api/wizard/state/:key", (req, res) => {
  db.delete(req.params.key);
  res.json({ ok: true });
});
```

See [HttpStore configuration](#httpstore-configuration) below for the full options reference.

### LocalStorageStore

Persists to browser `localStorage` (or `sessionStorage`, or any sync key-value adapter). Falls back to an in-memory store automatically in Node and test environments.

```typescript
import { LocalStorageStore } from "@daltonr/pathwrite-store";

// Default — uses browser localStorage, or in-memory in Node
const store = new LocalStorageStore();

// sessionStorage instead
const store = new LocalStorageStore({ storage: sessionStorage });

// Custom prefix to avoid collisions
const store = new LocalStorageStore({ prefix: "myapp:wizard:" });

// Force in-memory (useful in tests)
const store = new LocalStorageStore({ storage: null });
```

`LocalStorageStore` also exposes `list()` (returns all stored keys under the prefix) and `clear()` (deletes all entries under the prefix). These require the storage adapter to implement `getAllKeys()`, which the built-in `localStorage` adapter does.

### AsyncStorageStore

Persists to any async key-value store. Designed for React Native, where `@react-native-async-storage/async-storage` is the standard choice, but accepts any object that satisfies the `AsyncStorageAdapter` interface.

```typescript
import { AsyncStorageStore } from "@daltonr/pathwrite-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const store = new AsyncStorageStore({
  storage: AsyncStorage,
  prefix: "myapp:wizard:",   // optional, defaults to "@daltonr/pathwrite:"
});
```

Like `LocalStorageStore`, it exposes `list()` and `clear()`, and these require the adapter to implement `getAllKeys()` (which `@react-native-async-storage/async-storage` does).

---

## Save Strategies

The `strategy` option on `persistence()` controls which engine events trigger a save.

| Strategy | Saves when | API calls (5 keystrokes + Next) | Notes |
|---|---|---|---|
| `"onNext"` *(default)* | `next()` completes navigation to a new step | **1** | Best default for most forms |
| `"onEveryChange"` | Any settled `stateChanged` or `resumed` event | **6** (or **2** with `debounceMs`) | Add `debounceMs` for text inputs |
| `"onSubPathComplete"` | A sub-path finishes and the parent path resumes | varies | Nested sub-flow wizards |
| `"onComplete"` | The path completes | **0** mid-flow, **1** at end | Audit trail; does not delete on completion |
| `"manual"` | Never | **0** | You call `store.save()` yourself |

### `"onNext"` — the default

```typescript
persistence({ store, key: "user:123:wizard" })
// strategy defaults to "onNext"
```

Saves once, after `next()` has finished navigating to the new step. Ignores `setData`, `previous`, `start`, and all other events.

**Trace — user types "Hello" then clicks Next:**
1. "H" → `setData` → no save
2–5. More keystrokes → no save
6. Click Next → navigation settles → **1 save**

**Total: 1 save.** Ideal for multi-step forms. Risk: data typed before clicking Next is lost if the browser crashes.

### `"onEveryChange"` without debounce

```typescript
persistence({ store, key: "user:123:wizard", strategy: "onEveryChange" })
```

Saves on every settled `stateChanged` event — including each `setData` call. Five keystrokes produce five saves, plus one for navigation. Fine for dropdown-only or checkbox-only steps; unsuitable for text input without a debounce.

### `"onEveryChange"` with debounce

```typescript
persistence({
  store,
  key: "user:123:wizard",
  strategy: "onEveryChange",
  debounceMs: 500,
})
```

Collapses rapid events into a single save after the user pauses for 500 ms. Five keystrokes in quick succession produce one save when the user stops typing, plus one more when they click Next. **Total: 2 saves.** Use this when you need crash protection for text input without flooding the API.

### `"onSubPathComplete"`

```typescript
persistence({ store, key: "user:123:wizard", strategy: "onSubPathComplete" })
```

Saves when a sub-path finishes and the parent path resumes. Useful for wizards structured as a series of sub-flows, where each completion represents a meaningful checkpoint.

### `"onComplete"`

```typescript
persistence({ store, key: "user:123:wizard", strategy: "onComplete" })
```

Saves a final record when the path completes. Does not save anything mid-flow, and — uniquely — does **not** delete the saved record after completion. The record is available for audit or review. Use when you only care about the final submitted data, not the in-progress state.

### `"manual"`

```typescript
persistence({ store, key: "user:123:wizard", strategy: "manual" })
```

Never auto-saves. Trigger a save yourself at the points you choose:

```typescript
await store.save(key, engine.exportState()!);
```

### Choosing a strategy

| Wizard type | Recommended strategy | Why |
|---|---|---|
| Text-heavy forms | `"onNext"` | 1 save per step, no debounce needed |
| Dropdowns and checkboxes | `"onNext"` or `"onEveryChange"` | Each change is deliberate, no rapid-fire events |
| Crash-sensitive text input | `"onEveryChange"` + `debounceMs: 500` | Saves while typing without flooding the backend |
| Sub-flow wizards | `"onSubPathComplete"` | Save at meaningful sub-flow checkpoints |
| Audit trail only | `"onComplete"` | Record-keeping, not resumption |
| Custom save logic | `"manual"` | Full control over when saves fire |

---

## restoreOrStart()

The most common pattern is: try to load a saved session; if found, restore it; if not, start fresh. `restoreOrStart()` handles this in a single call.

```typescript
import { AsyncStorageStore, persistence, restoreOrStart } from "@daltonr/pathwrite-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const store = new AsyncStorageStore({ storage: AsyncStorage });
const key = "user:123:onboarding";

const { engine, restored } = await restoreOrStart({
  store,
  key,
  path: onboardingWizard,
  initialData: { name: "", email: "" },
  observers: [
    persistence({ store, key, strategy: "onNext" }),
  ],
});

// engine is a plain PathEngine — pass to any adapter
const { snapshot, next } = usePath({ engine });

if (restored) {
  // Optionally show a "Resuming your progress" banner
}
```

Internally, `restoreOrStart` calls `store.load(key)`. If a saved state is found, it calls `PathEngine.fromState(saved, pathDefinitions, { observers })` to reconstruct the engine at the saved step with the saved data. If nothing is found, it creates a fresh `PathEngine` and calls `engine.start(path, initialData)`. Observers are wired before the first event in both cases.

The `pathDefinitions` option (a map of `id → PathDefinition`) is required when the path uses sub-paths, so that `fromState` can reconstruct the full path stack. For simple paths with no sub-paths, it defaults to `{ [path.id]: path }`.

The framework adapter seeds its snapshot immediately from `engine.snapshot()` — the user sees the correct step and their previous data with no flash of empty state.

### Completion cleanup

When a path completes, the `persistence` observer automatically calls `store.delete(key)` to remove the saved state. A returning user will start fresh rather than restoring a completed wizard. The `"onComplete"` strategy is the only exception — it saves a final record and leaves it in place.

---

## HttpStore Configuration

Full options reference for `HttpStore`:

```typescript
interface HttpStoreOptions {
  /** Base URL for the API. Trailing slash is stripped automatically. */
  baseUrl: string;

  /** Custom URL for the save endpoint. Default: `${baseUrl}/state/${key}` */
  saveUrl?: (key: string) => string;

  /** Custom URL for the load endpoint. Default: `${baseUrl}/state/${key}` */
  loadUrl?: (key: string) => string;

  /** Custom URL for the delete endpoint. Default: `${baseUrl}/state/${key}` */
  deleteUrl?: (key: string) => string;

  /**
   * Headers for every request. Can be a static object or a function
   * (sync or async) that returns headers — useful for token refresh.
   */
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);

  /**
   * Custom fetch implementation. Defaults to the global fetch.
   * Inject a mock here for testing or to add SSR-safe fetch polyfills.
   */
  fetch?: typeof fetch;

  /** Called when any request fails. Use for logging and monitoring. */
  onError?: (error: Error, operation: "save" | "load" | "delete", key: string) => void;
}
```

### Custom URL builders

When your API paths don't follow the default `/state/{key}` convention:

```typescript
new HttpStore({
  saveUrl:   (key) => `/v2/users/${userId}/wizard/${key}`,
  loadUrl:   (key) => `/v2/users/${userId}/wizard/${key}`,
  deleteUrl: (key) => `/v2/users/${userId}/wizard/${key}`,
});
```

### Dynamic headers (token refresh)

```typescript
new HttpStore({
  baseUrl: "/api/wizard",
  headers: async () => ({
    Authorization: `Bearer ${await getAccessToken()}`,
  }),
});
```

The header function is called on every request, so tokens are always fresh.

### Error handling and logging

```typescript
new HttpStore({
  baseUrl: "/api/wizard",
  onError: (error, operation, key) => {
    console.error(`[persistence] ${operation} failed for key "${key}":`, error.message);
    Sentry.captureException(error, { extra: { operation, key } });
  },
});
```

Combined with the `persistence` observer's own callbacks:

```typescript
persistence({
  store,
  key: "user:123:wizard",
  strategy: "onEveryChange",
  debounceMs: 500,
  onSaveSuccess: () => console.log(`[${new Date().toISOString()}] Saved`),
  onSaveError:   (err) => console.error("Save failed:", err.message),
})
```

### Injecting fetch for testing

```typescript
new HttpStore({
  baseUrl: "/api/wizard",
  fetch: mockFetch,
});
```

---

## Offline Workflows

Two distinct concerns arise when the user loses connectivity. They are handled by different parts of the architecture.

### Reference data (services layer)

Data the workflow needs to display options — approver lists, country selectors, product catalogues. This is owned by the **services layer**, not by persistence. The offline strategy is: pre-fetch reference data while online, cache it, serve from cache when offline. Because the services layer exposes a typed interface, the workflow never observes the difference between an API call and a cache read.

See the [Services guide](services.md) for the full treatment, including `defineServices` caching policy and the `prefetch()` operation.

### Captured data (persistence layer)

Data the user *enters* as they progress — form fields, selections, decisions. This is owned by **Pathwrite's persistence layer**.

The strategy for offline captured data is: write locally as the user progresses, sync to the backend when connectivity returns.

**Using LocalStorageStore as a local buffer**

`LocalStorageStore` (or `AsyncStorageStore` on React Native) writes synchronously to local storage. No network is required. Wire it alongside an `HttpStore` and save locally on every change, syncing to the server when connectivity returns:

```typescript
const localStore  = new LocalStorageStore({ prefix: "myapp:" });
const remoteStore = new HttpStore({ baseUrl: "/api/wizard" });

const engine = new PathEngine({
  observers: [
    // Always save locally
    persistence({ store: localStore, key, strategy: "onEveryChange", debounceMs: 200 }),
    // Save to the API when connectivity allows
    persistence({ store: remoteStore, key, strategy: "onNext",
      onSaveError: (err) => queueForSync(key, engine.exportState()!) }),
  ],
});
```

On reconnect, drain the sync queue:

```typescript
window.addEventListener("online", async () => {
  for (const { key, state } of await syncQueue.drain()) {
    await remoteStore.save(key, state);
  }
});
```

**The two offline concerns in context**

Both concerns are transparent to the path definition and to `PathEngine`. The workflow calls `next()` and `setData()` exactly as normal. Whether data comes from an API or a local cache, whether writes land in `localStorage` or on a remote server — none of this is visible to the workflow definition or the step components.

```
Workflow package
  PathDefinition<TData>   — no connectivity awareness
  ServicesInterface        — declares what reference data the workflow needs

Application layer
  services = defineServices(…)   — configured with live API functions + cache policy
  services.prefetch(…)           — called deliberately before going offline
  LocalStorageStore              — captures workflow progress locally without network
  SyncQueue                      — flushes captured data to backend on reconnect
```

---

## Writing a Custom Store

Implement the three-method `PathStore` interface to use any backend — MongoDB, SQLite, MMKV, IndexedDB, or anything else.

```typescript
import type { PathStore, SerializedPathState } from "@daltonr/pathwrite-core";

class MyCustomStore implements PathStore {
  async save(key: string, state: SerializedPathState): Promise<void> {
    const response = await fetch(`/my-api/states/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    if (!response.ok) throw new Error(`Save failed: ${response.status}`);
  }

  async load(key: string): Promise<SerializedPathState | null> {
    const response = await fetch(`/my-api/states/${encodeURIComponent(key)}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Load failed: ${response.status}`);
    return response.json() as Promise<SerializedPathState>;
  }

  async delete(key: string): Promise<void> {
    const response = await fetch(`/my-api/states/${encodeURIComponent(key)}`, {
      method: "DELETE",
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Delete failed: ${response.status}`);
    }
  }
}
```

Pass it to `persistence()` exactly as you would a built-in store:

```typescript
const engine = new PathEngine({
  observers: [
    persistence({ store: new MyCustomStore(), key: "user:123:wizard" }),
  ],
});
```

`HttpStore` in `@daltonr/pathwrite-store` is itself a consumer of this interface — no special treatment, just the three methods above wired to a configurable REST transport.

If you need to share the "when do I fire?" logic with other observers (logging, analytics, MongoDB), use `matchesStrategy` from `@daltonr/pathwrite-core` directly:

```typescript
import { matchesStrategy, type ObserverStrategy, type PathObserver } from "@daltonr/pathwrite-core";

function mongoObserver(collection: MongoCollection, strategy: ObserverStrategy): PathObserver {
  return (event, engine) => {
    if (matchesStrategy(strategy, event)) {
      const state = engine.exportState();
      if (state) collection.replaceOne({ _id: state.pathId }, state, { upsert: true });
    }
  };
}
```

---

© 2026 Devjoy Ltd. MIT License.
