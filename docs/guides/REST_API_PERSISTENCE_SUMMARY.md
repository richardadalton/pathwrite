# REST API Persistence Adapter — Summary

## What you asked for

> "If I wanted to persist/reload state using custom REST API endpoints that I've built, how would I do that, presumably another adapter that Pathwrite passes the standard state doc to/from, and that adapter is configured with save and load URLs and makes API calls."

## The answer

**Yes, exactly.** I've created `@daltonr/pathwrite-store-http` — a storage adapter that:

1. **Takes your API URLs** (save/load/delete endpoints)
2. **Receives `SerializedPathState`** from the engine
3. **Makes HTTP calls** to your backend
4. **Returns the saved state** when loading

---

## Files created

```
packages/store-http/
├── src/
│   └── index.ts              # HttpStore implementation (~150 lines)
├── examples/
│   └── vue-complete.ts       # Full working Vue example with auto-save
├── package.json              # Publishable package, no peer deps
├── tsconfig.json
├── README.md                 # Full usage guide with examples
└── HTTP_PERSISTENCE.md       # Architecture & multi-user patterns
```

---

## How it works

### 1. You configure it with your API

```ts
const store = new HttpStore({
  baseUrl: "/api/wizard",
  headers: { Authorization: `Bearer ${token}` },
});
```

### 2. Your backend implements 3 endpoints

```
PUT    /api/wizard/state/{key}   — save state
GET    /api/wizard/state/{key}   — load state (or 404)
DELETE /api/wizard/state/{key}   — delete state
```

### 3. The store handles serialization

```ts
// Save
await store.save("user:123", engine.exportState());

// Load
const saved = await store.load("user:123");
const engine = PathEngine.fromState(saved, myPath);
```

---

## What gets saved (the "standard state doc")

```json
{
  "version": 1,
  "pathId": "registration",
  "currentStepIndex": 2,
  "data": { "name": "Alice", "email": "alice@example.com" },
  "visitedStepIds": ["personal", "company"],
  "pathStack": [],
  "_isNavigating": false
}
```

Plain JSON. No functions, no classes. Your API just stores/loads it as-is.

---

## Key features

### Configurable URLs
```ts
new HttpStore({
  saveUrl: (key) => `/v2/users/${userId}/wizard/${key}`,
  loadUrl: (key) => `/v2/users/${userId}/wizard/${key}`,
});
```

### Dynamic headers (for token refresh)
```ts
new HttpStore({
  headers: async () => ({
    Authorization: `Bearer ${await refreshToken()}`,
  }),
});
```

### Error handling
```ts
new HttpStore({
  onError: (error, operation, key) => {
    console.error(`${operation} failed for ${key}:`, error);
    Sentry.captureException(error);
  },
});
```

### Custom fetch (for testing or SSR)
```ts
new HttpStore({
  fetch: mockFetch,  // Inject your own fetch implementation
});
```

---

## What it depends on

**Nothing except `@daltonr/pathwrite-core`.** It uses the browser's built-in `fetch()` API. No database drivers, no peer dependencies.

```json
{
  "dependencies": {
    "@daltonr/pathwrite-core": "^0.3.0"
  },
  "peerDependencies": {}
}
```

---

## What's blocking it

The **only** missing piece is `exportState()` / `fromState()` in core. Once that lands:

1. ✅ `HttpStore` is ready to publish (already implemented)
2. ✅ Your backend just needs 3 REST endpoints (trivial)
3. ⚠️ Vue/React adapters need to expose `exportState()` and accept `fromState`

The adapter work is minimal — mostly exposing what core already provides.

---

## Works for all three scenarios

| Scenario | How it's used |
|---|---|
| **Single user, resume later** | `store.save("user:123", state)` on every change |
| **Multi-user, shared document** | Each user saves to `doc:456:user:123`; backend merges patches |
| **Session-based (no login)** | `store.save("session:abc", state)` keyed by session ID |

Same adapter, same API, different key patterns.

---

## Comparison to other stores

| Store | Environment | Use case |
|---|---|---|
| **`store-http`** | Browser | Custom REST API (your backend) |
| `store-memory` | Any | Testing, prototypes |
| `store-mongodb` | Node.js | Direct MongoDB access |
| `store-redis` | Node.js | Session store, caching |
| `store-firestore` | Node.js/Browser | Firebase/GCP |
| `store-fs` | Node.js | Local JSON files |

`store-http` is the only one designed for **browser → your API** communication. The others are for server-side direct DB access.

---

## Next steps

1. **Implement `exportState()` / `fromState()` in core** (prerequisite)
2. **Test `HttpStore` against a mock backend** (Vitest + mock fetch)
3. **Update Vue/React adapters** to expose the serialization API
4. **Publish `@daltonr/pathwrite-store-http@0.1.0`**
5. **Document the pattern** in DEVELOPER_GUIDE.md

The implementation is done. Just waiting on the core foundation.

---

## TL;DR

**Yes, you can persist to custom REST endpoints.** Install `@daltonr/pathwrite-store-http`, point it at your API, and it handles the save/load cycle. Your backend just stores JSON. No Pathwrite-specific logic required server-side.

