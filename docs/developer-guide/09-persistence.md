# Chapter 9: Persistence

Most multi-step flows are not completed in a single sitting. A loan application interrupted by a phone call, an onboarding flow closed on a laptop and resumed on a phone, a configuration flow where the user needs to fetch information before answering step four — all of these require the engine to remember where the user was and what they had entered. Pathwrite handles this through a persistence layer that is deliberately decoupled from the engine itself. The engine knows how to run a path; persistence is a separate concern, wired in by the application.

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
    (event) => analytics.track(`path.${event.type}`),
  ],
});
```

---

## Save strategies

The `strategy` option answers the question: "on which event should I write to the store?" Choosing the right strategy is a balance between how many network calls you are willing to make and how much work the user might lose in the event of a crash.

### `"onNext"` — the default

```typescript
persistence({ store, key: "user:123:onboarding" })
// strategy defaults to "onNext"
```

Saves once, after `next()` has successfully navigated to a new step, and whenever a sub-path returns to its parent (on completion or cancel) so the saved position never points inside a finished sub-flow. Data typed within a step is *not* saved until the user clicks Next. This is the right default for most forms: one save per step, no flooding the API, and the risk — data entered on the current step but not yet submitted — is limited to the current screen's worth of work.

### `"onEveryChange"`

```typescript
persistence({
  store,
  key: "user:123:onboarding",
  strategy: "onEveryChange",
  debounceMs: 500,
})
```

Saves on every `setData` call and on every navigation. Without `debounceMs`, five keystrokes produce five saves before the user even clicks Next. That is rarely what you want. Adding `debounceMs: 500` collapses rapid events into a single save after the user pauses for half a second — dramatically reducing the call count while still providing crash protection for mid-step data. Use this strategy when users are filling in long, text-heavy forms where losing the current step's work would be genuinely painful.

### `"onSubPathComplete"`

```typescript
persistence({ store, key: "user:123:onboarding", strategy: "onSubPathComplete" })
```

Saves when a sub-path finishes and the parent path resumes. This is the natural checkpoint for paths structured as a series of sub-flows: save at the end of each sub-flow rather than on every step. It produces fewer saves than `"onNext"` and maps cleanly to the meaningful milestones in the workflow.

### `"onComplete"`

```typescript
persistence({ store, key: "user:123:onboarding", strategy: "onComplete" })
```

Saves a single record when the path completes — nothing mid-flow. Use this when you only want to capture the final submitted state for audit purposes, not to enable resumption. Unlike every other strategy, `"onComplete"` does *not* delete the record after saving, since the record is the point. The record is a normal `SerializedPathState` with `_status: "completed"` and the final `data`; `restoreOrStart` recognises it and starts fresh rather than resuming a finished path.

### `"manual"`

```typescript
persistence({ store, key: "user:123:onboarding", strategy: "manual" })

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

`save` receives the full serialised engine state as a plain JSON object. `load` returns the saved state or `null` when nothing is stored under that key. `delete` is called automatically when a path completes, so that a returning user starts fresh rather than restoring a finished path.

The `SerializedPathState` that flows through these methods looks like this:

```typescript
{
  version: 1,
  pathId: string,
  currentStepIndex: number,
  data: PathData,            // all accumulated field values
  visitedStepIds: string[],
  attemptedStepIds: string[],  // steps where Next was pressed — restores hasAttemptedNext
  skippedStepIds: string[],    // steps shouldSkip resolved true — restores stepCount / progress
  stepEntryData: PathData,   // data as it was on entering the current step — restores resetStep()
  stepEnteredAt: number,
  pathStack: [...],          // sub-path stack, populated when sub-paths are in use
  _status: "idle",
  initialData: PathData,     // what the root path was started with — restores restart()
  hasValidated: boolean,
  blockingError: string | null,
}
```

Every field after `visitedStepIds` is optional on load, so state saved by an older version still restores; the engine falls back to sensible defaults for anything missing.

It is plain JSON with no functions, no class instances, and no Pathwrite-specific encoding. A backend that stores and returns this object verbatim requires no Pathwrite knowledge at all.

---

## Built-in stores

### HttpStore

`HttpStore` persists state to a REST API. Configure it with a base URL and optional auth headers, then implement three endpoints on the server side. It also accepts `credentials` (e.g. `"include"` for cross-origin cookies), an `AbortSignal` (`signal`) that cancels every request when aborted, and `timeoutMs`, which aborts any single request that runs longer than that; an aborted or timed-out request is reported through `onError` like any other failure.

```typescript
import { HttpStore } from "@daltonr/pathwrite-store";

const store = new HttpStore({
  baseUrl: "/api/paths",
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
app.put("/api/paths/state/:key",    (req, res) => { db.save(req.params.key, req.body); res.json({ ok: true }); });
app.get("/api/paths/state/:key",    (req, res) => { const s = db.load(req.params.key); s ? res.json(s) : res.status(404).end(); });
app.delete("/api/paths/state/:key", (req, res) => { db.delete(req.params.key); res.json({ ok: true }); });
```

When your API uses a different URL shape, pass custom builder functions:

```typescript
new HttpStore({
  saveUrl:   (key) => `/v2/sessions/${userId}/paths/${encodeURIComponent(key)}`,
  loadUrl:   (key) => `/v2/sessions/${userId}/paths/${encodeURIComponent(key)}`,
  deleteUrl: (key) => `/v2/sessions/${userId}/paths/${encodeURIComponent(key)}`,
});
```

When your access tokens rotate during a long session, pass a function for `headers` instead of a static object. It is called on every request:

```typescript
new HttpStore({
  baseUrl: "/api/paths",
  headers: async () => ({
    Authorization: `Bearer ${await getAccessToken()}`,
  }),
});
```

Use `onError` to capture failures without letting them surface as unhandled rejections:

```typescript
new HttpStore({
  baseUrl: "/api/paths",
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
const store = new LocalStorageStore({ prefix: "myapp:paths:" }); // custom key prefix
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
  prefix: "myapp:paths:",
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

Saved state that cannot be used never blocks the app. If `store.load` fails (corrupt JSON, a network error), the record's `version` is unsupported, or it references a path id that is no longer in `pathDefinitions` (a renamed path), `restoreOrStart` reports the error through the optional `onRestoreError` callback (or `console.warn` when none is given), deletes the record on a best-effort basis, and starts fresh with `restored: false` — the user is never stuck until storage is cleared by hand.

### Completion cleanup

When a path completes, the `persistence` observer automatically calls `store.delete(key)`. A user who returns after finishing the path starts fresh. The sole exception is the `"onComplete"` strategy, which saves a final record and deliberately leaves it in place — `restoreOrStart` treats any record with `_status: "completed"` as finished and starts fresh, so a leftover completed record never resumes.

### Flushing and disposing

`persistence()` returns the observer with two extra methods. `flush()` saves right now — cancelling any pending debounce window — and resolves once every queued store operation has landed; call it from a `beforeunload` or `visibilitychange` handler, or before the host component unmounts, so a debounced save is never lost. `dispose()` cancels a pending debounce window and makes the observer ignore every later event, so a timer never outlives the component that created it.

```typescript
const saver = persistence({ store, key, strategy: "onEveryChange", debounceMs: 500 });
const engine = new PathEngine({ observers: [saver] });

window.addEventListener("beforeunload", () => { void saver.flush(); });
// on unmount:
await saver.flush();
saver.dispose();
```

`HttpStore.load()` treats a `204 No Content` or an empty body as "no saved state" and returns `null`; a body that is not JSON, or JSON that is not a `SerializedPathState`, is reported through `onError` and rejected — `restoreOrStart` then starts fresh (see above).

---

## Offline patterns

Two separate offline concerns often get conflated, and conflating them leads to the wrong solution for each. They are handled by different parts of the architecture.

### Reference data — service layer caching (Chapter 8)

Reference data is information the workflow needs to display its UI: role lists, country selectors, product catalogues. This data is not entered by the user — it comes from the server. The offline strategy for reference data is to pre-fetch it while the device is online and serve from cache when it is not. Because this is handled entirely within the service interface (via `defineServices` with `cache: "auto"` and an explicit `prefetch()` call), the path definition and the step components never observe the difference between a live API call and a cache read.

### Captured data — local write, sync on reconnect

Captured data is what the user enters as they progress through the path. The engine collects it; persistence saves it. Offline captured data requires writing locally without a network and syncing to the backend when connectivity returns.

Wire `LocalStorageStore` as the primary store and use `HttpStore` as a secondary sync target. The local store never requires connectivity; the HTTP store gets a chance to save whenever the network is available:

```typescript
import { LocalStorageStore, HttpStore, persistence } from "@daltonr/pathwrite-store";

const localStore  = new LocalStorageStore({ prefix: "myapp:" });
const remoteStore = new HttpStore({
  baseUrl: "/api/paths",
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
    persistence({ store: new IndexedDbStore(), key: "user:123:onboarding" }),
  ],
});
```

`HttpStore` in `@daltonr/pathwrite-store` is itself a consumer of this same interface — no special treatment, no private APIs. If you need to share the "when do I fire?" logic with other observers (logging, analytics, a MongoDB Atlas SDK), you can use `matchesStrategy` from `@daltonr/pathwrite-core` to build observers that respond to the same event conditions as the built-in persistence observer.

---

Persistence is the last piece of the single-app story. Chapter 10 takes the next step: treating the workflow itself as a publishable, versioned package that multiple apps and frameworks can share.

© 2026 Devjoy Ltd. MIT License.
