# Chapter 9: Persistence

Most multi-step flows are not completed in a single sitting. A loan application interrupted by a phone call, an onboarding wizard closed on a laptop and resumed on a phone, a configuration flow where the user needs to fetch information before answering step four — all of these require the engine to remember where the user was and what they had entered. Pathwrite handles this through a persistence layer that is deliberately decoupled from the engine itself. The engine knows how to run a path; persistence is a separate concern, wired in by the application.

---

## The observer pattern

The engine emits a `PathEvent` for every state transition — navigation, data changes, completion, sub-path boundaries, and more. A persistence observer is a function that receives those events and decides when to write to storage. The engine has no knowledge of storage: it does not know whether its state is being saved to a database, a browser, a mobile device, or nowhere at all.

The `persistence()` function from `@daltonr/pathwrite-store` is a factory that returns a `PathObserver` configured with a store, a key, and a save strategy. Pass it to `PathEngine` via the `observers` option and it runs for the engine's entire lifetime.

```typescript
import { PathEngine } from "@daltonr/pathwrite-core";
import { LocalStorageStore, persistence } from "@daltonr/pathwrite-store";

const store = new LocalStorageStore();

const engine = new PathEngine({
  observers: [
    persistence({ store, key: "user:123:onboarding", strategy: "onNext" }),
  ],
});

await engine.start(onboardingPath, { name: "", email: "" });
```

Observers are registered before the first event fires, so persistence sees every event from the initial `stateChanged` emitted by `start()`.

Multiple observers are supported and run independently. Each receives the same events in registration order. This makes it straightforward to combine persistence with logging or analytics:

```typescript
const engine = new PathEngine({
  observers: [
    persistence({ store, key: "user:123:onboarding" }),
    (event) => analytics.track(`wizard.${event.type}`),
  ],
});
```

---

## Save strategies

The `strategy` option answers the question: "on which event should I write to the store?" Choosing the right strategy is a balance between how many network calls you are willing to make and how much work the user might lose in the event of a crash.

### `"onNext"` — the default

```typescript
persistence({ store, key: "user:123:wizard" })
// strategy defaults to "onNext"
```

Saves once, after `next()` has successfully navigated to a new step. Data typed within a step is *not* saved until the user clicks Next. This is the right default for most forms: one save per step, no flooding the API, and the risk — data entered on the current step but not yet submitted — is limited to the current screen's worth of work.

### `"onEveryChange"`

```typescript
persistence({
  store,
  key: "user:123:wizard",
  strategy: "onEveryChange",
  debounceMs: 500,
})
```

Saves on every `setData` call and on every navigation. Without `debounceMs`, five keystrokes produce five saves before the user even clicks Next. That is rarely what you want. Adding `debounceMs: 500` collapses rapid events into a single save after the user pauses for half a second — dramatically reducing the call count while still providing crash protection for mid-step data. Use this strategy when users are filling in long, text-heavy forms where losing the current step's work would be genuinely painful.

### `"onSubPathComplete"`

```typescript
persistence({ store, key: "user:123:wizard", strategy: "onSubPathComplete" })
```

Saves when a sub-path finishes and the parent path resumes. This is the natural checkpoint for wizards structured as a series of sub-flows: save at the end of each sub-flow rather than on every step. It produces fewer saves than `"onNext"` and maps cleanly to the meaningful milestones in the workflow.

### `"onComplete"`

```typescript
persistence({ store, key: "user:123:wizard", strategy: "onComplete" })
```

Saves a single record when the path completes — nothing mid-flow. Use this when you only want to capture the final submitted state for audit purposes, not to enable resumption. Unlike every other strategy, `"onComplete"` does *not* delete the record after saving, since the record is the point.

### `"manual"`

```typescript
persistence({ store, key: "user:123:wizard", strategy: "manual" })

// Later, when the user clicks "Save draft":
await store.save(key, engine.exportState()!);
```

Never auto-saves. You call `store.save()` yourself at exactly the points you choose. Use this for explicit "Save draft" buttons, where auto-saving would be surprising or where the user needs to opt in.

---

## The PathStore interface

Any persistence backend implements three methods. The interface lives in `@daltonr/pathwrite-core` and is re-exported from `@daltonr/pathwrite-store`:

```typescript
interface PathStore {
  save(key: string, state: SerializedPathState): Promise<void>;
  load(key: string): Promise<SerializedPathState | null>;
  delete(key: string): Promise<void>;
}
```

`save` receives the full serialised engine state as a plain JSON object. `load` returns the saved state or `null` when nothing is stored under that key. `delete` is called automatically when a path completes, so that a returning user starts fresh rather than restoring a finished wizard.

The `SerializedPathState` that flows through these methods looks like this:

```typescript
{
  version: 1,
  pathId: string,
  currentStepIndex: number,
  data: PathData,            // all accumulated field values
  visitedStepIds: string[],
  pathStack: [...],          // sub-path stack, populated when sub-paths are in use
  _status: "idle",
}
```

It is plain JSON with no functions, no class instances, and no Pathwrite-specific encoding. A backend that stores and returns this object verbatim requires no Pathwrite knowledge at all.

---

## Built-in stores

### HttpStore

`HttpStore` persists state to a REST API. Configure it with a base URL and optional auth headers, then implement three endpoints on the server side.

```typescript
import { HttpStore } from "@daltonr/pathwrite-store";

const store = new HttpStore({
  baseUrl: "/api/wizard",
  headers: { Authorization: `Bearer ${token}` },
});
```

By default the store derives URLs from `baseUrl`:

```
PUT    {baseUrl}/state/{key}   — save
GET    {baseUrl}/state/{key}   — load  (return 404 when not found)
DELETE {baseUrl}/state/{key}   — delete
```

The server does not need any Pathwrite-specific logic. Any backend that stores a JSON document and returns it on request is sufficient. A minimal Express handler:

```typescript
app.put("/api/wizard/state/:key",    (req, res) => { db.save(req.params.key, req.body); res.json({ ok: true }); });
app.get("/api/wizard/state/:key",    (req, res) => { const s = db.load(req.params.key); s ? res.json(s) : res.status(404).end(); });
app.delete("/api/wizard/state/:key", (req, res) => { db.delete(req.params.key); res.json({ ok: true }); });
```

When your API uses a different URL shape, pass custom builder functions:

```typescript
new HttpStore({
  saveUrl:   (key) => `/v2/sessions/${userId}/wizard/${encodeURIComponent(key)}`,
  loadUrl:   (key) => `/v2/sessions/${userId}/wizard/${encodeURIComponent(key)}`,
  deleteUrl: (key) => `/v2/sessions/${userId}/wizard/${encodeURIComponent(key)}`,
});
```

When your access tokens rotate during a long session, pass a function for `headers` instead of a static object. It is called on every request:

```typescript
new HttpStore({
  baseUrl: "/api/wizard",
  headers: async () => ({
    Authorization: `Bearer ${await getAccessToken()}`,
  }),
});
```

Use `onError` to capture failures without letting them surface as unhandled rejections:

```typescript
new HttpStore({
  baseUrl: "/api/wizard",
  onError: (error, operation, key) => {
    Sentry.captureException(error, { extra: { operation, key } });
  },
});
```

### LocalStorageStore

`LocalStorageStore` persists to browser `localStorage`. It requires no server and works for anonymous sessions, draft state, and any scenario where server-side persistence is not needed.

```typescript
import { LocalStorageStore } from "@daltonr/pathwrite-store";

const store = new LocalStorageStore();                          // default localStorage
const store = new LocalStorageStore({ storage: sessionStorage }); // sessionStorage
const store = new LocalStorageStore({ prefix: "myapp:wizard:" }); // custom key prefix
const store = new LocalStorageStore({ storage: null });          // in-memory (tests)
```

In Node and test environments, `LocalStorageStore` falls back to an in-memory store automatically — you do not need to guard the import.

### AsyncStorageStore

`AsyncStorageStore` persists to any async key-value store. On React Native the standard choice is `@react-native-async-storage/async-storage`, but any object satisfying the `AsyncStorageAdapter` interface works.

```typescript
import { AsyncStorageStore } from "@daltonr/pathwrite-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const store = new AsyncStorageStore({
  storage: AsyncStorage,
  prefix: "myapp:wizard:",
});
```

---

## restoreOrStart()

The most common persistence pattern is: attempt to load a saved session; if one exists, resume it; otherwise start fresh. `restoreOrStart()` handles this in a single call.

```typescript
import { AsyncStorageStore, persistence, restoreOrStart } from "@daltonr/pathwrite-store";
import { usePath } from "@daltonr/pathwrite-react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const store = new AsyncStorageStore({ storage: AsyncStorage });
const key = `user:${userId}:onboarding`;

const { engine, restored } = await restoreOrStart({
  store,
  key,
  path: onboardingPath,
  initialData: { name: "", email: "", plan: "" },
  observers: [
    persistence({ store, key, strategy: "onNext" }),
  ],
});

// engine is a plain PathEngine — pass it to any adapter
const { snapshot, next } = usePath({ engine });

if (restored) {
  // Optionally surface a "Resuming your progress from step X" banner
}
```

Internally, `restoreOrStart` calls `store.load(key)`. When a saved state is found, it calls `PathEngine.fromState(saved, pathDefinitions, { observers })` to reconstruct the engine at the saved step with the saved data. When nothing is found, it creates a fresh `PathEngine` and calls `engine.start(path, initialData)`. Observers are wired before the first event fires in both cases, so no event is missed regardless of which path is taken.

The `pathDefinitions` option is required when the path uses sub-paths, as `fromState` needs to reconstruct the full path stack. For paths without sub-paths it defaults to `{ [path.id]: path }` automatically.

### Completion cleanup

When a path completes, the `persistence` observer automatically calls `store.delete(key)`. A user who returns after finishing the wizard starts fresh. The sole exception is the `"onComplete"` strategy, which saves a final record and deliberately leaves it in place.

---

## Offline patterns

Two separate offline concerns often get conflated, and conflating them leads to the wrong solution for each. They are handled by different parts of the architecture.

### Reference data — service layer caching (Chapter 8)

Reference data is information the workflow needs to display its UI: role lists, country selectors, product catalogues. This data is not entered by the user — it comes from the server. The offline strategy for reference data is to pre-fetch it while the device is online and serve from cache when it is not. Because this is handled entirely within the service interface (via `defineServices` with `cache: "auto"` and an explicit `prefetch()` call), the path definition and the step components never observe the difference between a live API call and a cache read.

### Captured data — local write, sync on reconnect

Captured data is what the user enters as they progress through the wizard. The engine collects it; persistence saves it. Offline captured data requires writing locally without a network and syncing to the backend when connectivity returns.

Wire `LocalStorageStore` as the primary store and use `HttpStore` as a secondary sync target. The local store never requires connectivity; the HTTP store gets a chance to save whenever the network is available:

```typescript
import { LocalStorageStore, HttpStore, persistence } from "@daltonr/pathwrite-store";

const localStore  = new LocalStorageStore({ prefix: "myapp:" });
const remoteStore = new HttpStore({
  baseUrl: "/api/wizard",
  onError: (err, operation, key) => {
    if (operation === "save") queueForSync(key, engine.exportState()!);
  },
});

const engine = new PathEngine({
  observers: [
    // Write locally on every change — never requires network
    persistence({ store: localStore, key, strategy: "onEveryChange", debounceMs: 200 }),
    // Attempt to write remotely on step advance — queue on failure
    persistence({ store: remoteStore, key, strategy: "onNext" }),
  ],
});
```

When the device comes back online, drain the sync queue:

```typescript
window.addEventListener("online", async () => {
  for (const { key, state } of await syncQueue.drain()) {
    await remoteStore.save(key, state);
  }
});
```

The path definition sees none of this. It calls `next()` and `setData()` exactly as normal. Whether writes land in `localStorage` or on a server, whether reference data comes from the network or from cache, is invisible to the workflow itself. That separation is intentional — it is what makes the same path definition usable across environments that have fundamentally different connectivity characteristics.

---

## Writing a custom store

Any object implementing the three-method `PathStore` interface is a valid store. You might write a custom store to target MongoDB, SQLite, MMKV for React Native, or IndexedDB for large browser-side payloads. Here is a complete IndexedDB implementation:

```typescript
import type { PathStore, SerializedPathState } from "@daltonr/pathwrite-core";

class IndexedDbStore implements PathStore {
  private db: IDBDatabase | null = null;

  private async open(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("pathwrite", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("states");
      req.onsuccess = () => { this.db = req.result; resolve(req.result); };
      req.onerror = () => reject(req.error);
    });
  }

  async save(key: string, state: SerializedPathState): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("states", "readwrite");
      tx.objectStore("states").put(state, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async load(key: string): Promise<SerializedPathState | null> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("states", "readonly");
      const req = tx.objectStore("states").get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async delete(key: string): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("states", "readwrite");
      tx.objectStore("states").delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
```

Pass it to `persistence()` exactly as you would a built-in store:

```typescript
const engine = new PathEngine({
  observers: [
    persistence({ store: new IndexedDbStore(), key: "user:123:wizard" }),
  ],
});
```

`HttpStore` in `@daltonr/pathwrite-store` is itself a consumer of this same interface — no special treatment, no private APIs. If you need to share the "when do I fire?" logic with other observers (logging, analytics, a MongoDB Atlas SDK), you can use `matchesStrategy` from `@daltonr/pathwrite-core` to build observers that respond to the same event conditions as the built-in persistence observer.

---

Persistence is the last piece of the single-app story. Chapter 10 takes the next step: treating the workflow itself as a publishable, versioned package that multiple apps and frameworks can share.

© 2026 Devjoy Ltd. MIT License.
