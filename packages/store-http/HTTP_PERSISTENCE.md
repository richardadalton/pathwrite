# REST API Persistence for Pathwrite

**Summary:** You can persist wizard state to your own REST API using `@daltonr/pathwrite-store-http` — a storage adapter that wraps HTTP calls in the same interface as the database stores.

---

## Quick Start

### 1. Install the package

```bash
npm install @daltonr/pathwrite-store-http
```

### 2. Configure the store

```ts
import { HttpStore } from "@daltonr/pathwrite-store-http";

const store = new HttpStore({
  baseUrl: "/api/wizard",
  headers: { Authorization: `Bearer ${token}` },
});
```

### 3. Use it with PathEngine

```ts
import { PathEngine } from "@daltonr/pathwrite-core";

// Load saved state
const saved = await store.load(`user:${userId}`);
const engine = saved
  ? PathEngine.fromState(saved, myPath)
  : new PathEngine();

// Auto-save on changes
engine.subscribe(async (event) => {
  if (event.type === "stateChanged") {
    await store.save(`user:${userId}`, engine.exportState());
  }
});
```

---

## What Gets Saved

The store serializes the entire PathEngine state as JSON:

```ts
{
  version: 1,
  pathId: "registration",
  currentStepIndex: 2,
  data: {
    name: "Alice",
    email: "alice@example.com",
    company: "Acme"
  },
  visitedStepIds: ["personal", "company", "review"],
  pathStack: [],  // empty unless sub-paths are active
  _isNavigating: false
}
```

This is a plain object — no functions, no class instances, fully JSON-serializable.

---

## Your Backend API

The store expects three endpoints:

| Method | URL | Request | Response |
|---|---|---|---|
| `PUT` | `{baseUrl}/state/{key}` | `SerializedPathState` JSON | 200 OK |
| `GET` | `{baseUrl}/state/{key}` | — | `SerializedPathState` or 404 |
| `DELETE` | `{baseUrl}/state/{key}` | — | 200 OK or 404 |

### Minimal Express Example

```ts
import express from "express";
const app = express();
app.use(express.json());

const states = new Map(); // Replace with your DB

app.put("/api/wizard/state/:key", (req, res) => {
  states.set(req.params.key, req.body);
  res.json({ ok: true });
});

app.get("/api/wizard/state/:key", (req, res) => {
  const state = states.get(req.params.key);
  state ? res.json(state) : res.status(404).end();
});

app.delete("/api/wizard/state/:key", (req, res) => {
  states.delete(req.params.key);
  res.json({ ok: true });
});
```

---

## Key Design Points

### 1. **No Pathwrite-specific backend code**
Your API just stores/loads JSON. It doesn't need to understand steps, guards, or hooks. The engine logic stays in the browser.

### 2. **Store key = your naming convention**
```ts
store.save("user:123", state);           // Per-user wizard
store.save("doc:456:user:123", state);   // Per-user, per-document
store.save("session:abc", state);        // Per-session
```

You control the key structure. The store just passes it through.

### 3. **Headers = auth + custom metadata**
```ts
new HttpStore({
  baseUrl: "/api/wizard",
  headers: async () => ({
    Authorization: `Bearer ${await getToken()}`,
    "X-Document-Version": documentVersion,
  }),
});
```

Headers can be static or async (for token refresh).

### 4. **Custom URL patterns**
```ts
new HttpStore({
  baseUrl: "https://api.example.com",
  saveUrl: (key) => `/v2/users/${userId}/wizard/${key}`,
  loadUrl: (key) => `/v2/users/${userId}/wizard/${key}`,
  deleteUrl: (key) => `/v2/users/${userId}/wizard/${key}`,
});
```

Default is `{baseUrl}/state/{key}`, but you can override per-operation.

---

## Multi-User Scenario (Approval Workflow)

For the scenario where multiple users work on the same document:

### Client-side (each user)
```ts
const documentId = "doc-123";
const userId = "user-b";

// Load the shared document data
const docState = await store.load(`document:${documentId}`);

// Load this user's navigation state
const navState = await store.load(`nav:${documentId}:${userId}`);

// When this user saves, send a patch
const patch = compare(originalData, engine.snapshot().data);
await fetch(`/api/documents/${documentId}/patch`, {
  method: "POST",
  body: JSON.stringify({ patch, version: docState.version }),
});
```

### Backend
```ts
// Document endpoint — handles conflict resolution
app.post("/api/documents/:id/patch", async (req, res) => {
  const { patch, version } = req.body;
  const doc = await db.getDocument(req.params.id);

  if (doc.version !== version) {
    // Optimistic lock failed — try auto-merge
    const canMerge = noPathOverlap(doc.pendingPatches, patch);
    if (!canMerge) {
      return res.status(409).json({ error: "Conflict", currentVersion: doc.version });
    }
    // Apply both patches...
  }

  applyPatch(doc.data, patch);
  doc.version++;
  await db.saveDocument(doc);
  res.json({ version: doc.version });
});

// Navigation endpoint — no conflicts, per-user
app.put("/api/wizard/state/nav::docId::userId", (req, res) => {
  // Just save it — navigation state doesn't conflict
  await db.saveNavState(req.params.docId, req.params.userId, req.body);
  res.json({ ok: true });
});
```

See `DEVELOPER_GUIDE.md` → Multi-User Wizards for the full pattern.

---

## Comparison to Other Stores

| Store | Use Case | Dependencies |
|---|---|---|
| `store-http` | Browser apps with custom backend | None (uses `fetch`) |
| `store-memory` | Testing, prototypes | None |
| `store-mongodb` | Node.js server-side | `mongodb` peer dep |
| `store-redis` | Node.js server-side, sessions | `redis` peer dep |
| `store-firestore` | Firebase apps | `firebase-admin` peer dep |
| `store-fs` | Node.js local persistence | None (uses `fs`) |

`store-http` is the **only client-side store** — the others are for server environments where you have direct database access.

---

## Prerequisites

This all depends on `exportState()` / `fromState()` being added to `@daltonr/pathwrite-core`. That's the foundation piece. Once that lands:

1. `HttpStore` is just a thin wrapper around `fetch()`
2. The Vue/React adapters need to expose `exportState()` and accept `fromState` or an engine
3. Everything else is just wiring

---

## Implementation Status

- [ ] Core: `exportState()` / `fromState()` (#1 priority)
- [ ] HttpStore: `/packages/store-http/` (ready to build once core lands)
- [ ] Vue adapter: expose `exportState`, accept `fromState`
- [ ] React adapter: expose `exportState`, accept `fromState`
- [ ] Angular adapter: expose `exportState`, accept `fromState`
- [ ] Docs: multi-user + persistence patterns in DEVELOPER_GUIDE.md

The HttpStore implementation is straightforward. The hard dependency is the core serialization API.

