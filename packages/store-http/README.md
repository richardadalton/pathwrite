# @daltonr/pathwrite-store-http

REST API storage adapter for PathEngine state with automatic persistence support.

---

## Installation

```bash
npm install @daltonr/pathwrite-core @daltonr/pathwrite-store-http
# Plus your framework adapter:
npm install @daltonr/pathwrite-vue
# or
npm install @daltonr/pathwrite-react
# or
npm install @daltonr/pathwrite-angular
```

---

## Exported Types

This package exports:

**Store-specific:**
- `HttpStore` — REST API storage adapter class
- `HttpStoreOptions` — Configuration for HttpStore
- `PathEngineWithStore` — Wrapper with automatic persistence
- `PathEngineWithStoreOptions` — Configuration options
- `PersistenceStrategy` — Type for persistence strategies

**Re-exported from core (for convenience):**
```typescript
import { 
  HttpStore,              // Store-specific
  PathEngineWithStore,    // Store-specific
  PersistenceStrategy,    // Store-specific
  PathData,               // Re-exported from core
  PathDefinition,         // Re-exported from core
  PathEvent,              // Re-exported from core
  PathSnapshot,           // Re-exported from core
  PathStep,               // Re-exported from core
  PathStepContext,        // Re-exported from core
  SerializedPathState     // Re-exported from core
} from "@daltonr/pathwrite-store-http";
```

---

## Quick Start: Auto-Persistence

The easiest way to use the store is with `PathEngineWithStore`, which automatically persists wizard state as users navigate:

```typescript
import { PathEngineWithStore } from "@daltonr/pathwrite-store-http";
import { HttpStore } from "@daltonr/pathwrite-store-http";

const store = new HttpStore({
  baseUrl: "/api/wizard",
  headers: { Authorization: `Bearer ${token}` },
});

const wrapper = new PathEngineWithStore({
  key: "user:123:onboarding",
  store,
  persistenceStrategy: "onNext", // Default: saves on forward navigation
  debounceMs: 500, // Optional: debounce rapid changes
});

// Start fresh or restore from saved state
await wrapper.startOrRestore(myPath, { "my-path": myPath });

// Get the engine and use normally
const engine = wrapper.getEngine();
await engine.next();
await engine.setData("name", "Alice");

// State is automatically persisted based on strategy
```

### Persistence Strategies

| Strategy | When it saves | Use case |
|---|---|---|
| `onNext` **(default)** | On successful `next()` navigation | Best balance of safety and performance for most wizards |
| `onEveryChange` | Every `stateChanged` or `resumed` event | Maximum safety - never lose data. **Requires debouncing for text inputs!** |
| `onSubPathComplete` | When sub-paths complete and return to parent | Multi-step wizards with sub-flows |
| `onComplete` | Only when the entire wizard completes | Keep final results as a record, don't save progress |
| `manual` | Never auto-saves | You control when to call `wrapper.save()` |

**Why `onNext` is the default:**
- ✅ Saves progress at natural checkpoints (when users click Next)
- ✅ Minimal API calls (1 save per step)
- ✅ No debouncing needed for text inputs
- ✅ Users intuitively expect "save on next" behavior
- ✅ Still protects against navigation loss

**When to use `onEveryChange`:**
- Forms with only dropdowns/checkboxes (no rapid typing)
- When you need crash protection even before clicking Next
- **Always use with `debounceMs: 500` if forms have text inputs**

### Debouncing (Only Needed with `onEveryChange`)

**With the default `onNext` strategy, debouncing is not needed** because saves only happen on navigation, not during typing.

**If you use `onEveryChange`**, typing "Hello" in a text field would trigger **5 saves** (one per keystroke) without debouncing.

**With debouncing**, rapid changes are batched and only the final value is saved:

```typescript
const wrapper = new PathEngineWithStore({
  key: "user:123:onboarding",
  store,
  persistenceStrategy: "onEveryChange", // Only use if you need crash protection
  debounceMs: 500, // REQUIRED for text inputs!
});

// User types "Hello" rapidly
engine.setData("name", "H");    // Timer starts
engine.setData("name", "He");   // Timer resets
engine.setData("name", "Hel");  // Timer resets
engine.setData("name", "Hell"); // Timer resets
engine.setData("name", "Hello");// Timer resets
// ... 500ms pass with no new changes ...
// → Only 1 save with "Hello" 🎉
```

**When to use debouncing:**
- ✅ Always use with `onEveryChange` + text inputs
- ❌ Not needed with `onNext` (default)
- ❌ Not needed with forms that only have dropdowns/checkboxes

### Choosing the Right Strategy

Here's how different strategies behave when a user types "Hello" and clicks Next:

| Strategy | Saves triggered | When |
|---|---|---|
| **`onNext` (default)** | **1 save** ✅ | Next button only |
| `onEveryChange` (no debounce) | **6 saves** ❌ | H, He, Hel, Hell, Hello, Next button |
| `onEveryChange` (500ms debounce) | **2 saves** ⚠️ | Hello (after 500ms idle), Next button |
| `manual` | **0 saves** | Only when you call `wrapper.save()` |

**Best practices:**
- **Most wizards**: Use `onNext` (default) - simple and efficient
- **Crash protection needed**: Use `onEveryChange` + `debounceMs: 500`
- **Dropdowns/checkboxes only**: Use `onEveryChange` (no debounce needed)
- **Record-keeping only**: Use `onComplete`

---

## HttpStore API

The `HttpStore` class handles HTTP requests to your backend.

### Your Backend API Contract

The store expects these endpoints:

| Method | Endpoint | Request Body | Response | Notes |
|---|---|---|---|---|
| `PUT` | `/state/{key}` | `SerializedPathState` | 200 OK | Creates or updates |
| `GET` | `/state/{key}` | — | `SerializedPathState` or 404 | 404 means no saved state |
| `DELETE` | `/state/{key}` | — | 200 OK or 404 | 404 is treated as success |

### Example Express Backend

```typescript
import express from "express";

const app = express();
app.use(express.json());

// In-memory store (replace with your DB)
const states = new Map();

app.put("/api/wizard/state/:key", (req, res) => {
  const { key } = req.params;
  const state = req.body;
  
  if (!state.version || !state.pathId) {
    return res.status(400).json({ error: "Invalid state format" });
  }
  
  states.set(key, state);
  res.json({ ok: true });
});

app.get("/api/wizard/state/:key", (req, res) => {
  const { key } = req.params;
  const state = states.get(key);
  
  if (!state) {
    return res.status(404).json({ error: "Not found" });
  }
  
  res.json(state);
});

app.delete("/api/wizard/state/:key", (req, res) => {
  const { key } = req.params;
  states.delete(key);
  res.json({ ok: true });
});

app.listen(3000);
```

### HttpStore Options

```typescript
const store = new HttpStore({
  baseUrl: "/api/wizard",
  
  // Optional: custom URL builders
  saveUrl: (key) => `/v2/wizard/${key}/state`,
  loadUrl: (key) => `/v2/wizard/${key}/state`,
  deleteUrl: (key) => `/v2/wizard/${key}/state`,
  
  // Optional: auth headers (static or dynamic)
  headers: { Authorization: `Bearer ${token}` },
  // or
  headers: async () => ({
    Authorization: `Bearer ${await getToken()}`,
  }),
  
  // Optional: error handling
  onError: (error, operation, key) => {
    console.error(`Failed to ${operation} state for ${key}:`, error);
  },
  
  // Optional: custom fetch (for testing or SSR)
  fetch: customFetch,
});
```

---

## Manual Usage (Without Auto-Persistence)

If you prefer manual control, use `HttpStore` directly with `PathEngine`:

```typescript
import { PathEngine } from "@daltonr/pathwrite-core";
import { HttpStore } from "@daltonr/pathwrite-store-http";

const userId = "user-123";
const store = new HttpStore({ baseUrl: "/api/wizard" });

// Load or create engine
const saved = await store.load(`user:${userId}`);
const engine = saved
  ? PathEngine.fromState(saved, { "my-path": myPath })
  : new PathEngine();

// Manually save when needed
await engine.next();
const state = engine.exportState();
if (state) {
  await store.save(`user:${userId}`, state);
}

// Start if it's a new engine
if (!saved) {
  await engine.start(myPath, { userId });
}
```

---

## Advanced: Lifecycle Callbacks

Monitor save operations with callbacks:

```typescript
const wrapper = new PathEngineWithStore({
  key: "user:123:wizard",
  store,
  
  onSaveSuccess: () => {
    console.log("✓ State saved");
    showToast("Progress saved");
  },
  
  onSaveError: (error) => {
    console.error("✗ Save failed:", error);
    showToast("Failed to save progress", "error");
  },
});
```

---

## Advanced: Waiting for Pending Saves

Ensure all saves complete before critical operations:

```typescript
// Before navigating away
await wrapper.waitForPendingSave();
router.push("/next-page");

// Before logging out
await wrapper.waitForPendingSave();
logout();
```

---

## Advanced: Cleanup

Always cleanup when unmounting:

```typescript
// React
useEffect(() => {
  return () => wrapper.cleanup();
}, []);

// Vue
onBeforeUnmount(() => {
  wrapper.cleanup();
});
```

---

## Testing

Mock the fetch calls:

```typescript
import { vi } from "vitest";
import { HttpStore } from "@daltonr/pathwrite-store-http";

test("saves state to API", async () => {
  const mockFetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response)
  );

  const store = new HttpStore({
    baseUrl: "/api",
    fetch: mockFetch as any,
  });

  const state = { version: 1, pathId: "test", /* ... */ };
  await store.save("key-1", state);

  expect(mockFetch).toHaveBeenCalledWith("/api/state/key-1", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state),
  });
});
```

---

## Migration from Manual Approach

If you were previously using `HttpStore` directly, migrate to `PathEngineWithStore`:

**Before:**
```typescript
const engine = new PathEngine();
engine.subscribe(async (event) => {
  if (event.type === "stateChanged") {
    const state = engine.exportState();
    await store.save(key, state);
  }
});
await engine.start(path);
```

**After:**
```typescript
const wrapper = new PathEngineWithStore({
  key,
  store,
  persistenceStrategy: "onEveryChange",
});
await wrapper.startOrRestore(path, { [path.id]: path });
const engine = wrapper.getEngine();
```

---

## Framework Integration Examples

### Vue 3

```vue
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import { PathEngineWithStore, HttpStore } from "@daltonr/pathwrite-store-http";

const store = new HttpStore({ baseUrl: "/api/wizard" });
const wrapper = new PathEngineWithStore({
  key: "user:123:onboarding",
  store,
  persistenceStrategy: "onNext",
  debounceMs: 300,
});

let engine;

onMounted(async () => {
  await wrapper.startOrRestore(myPath, { "my-path": myPath });
  engine = wrapper.getEngine();
});

onBeforeUnmount(() => {
  wrapper.cleanup();
});

const handleNext = async () => {
  await engine.next();
};
</script>
```

### React

```typescript
import { useEffect, useRef } from "react";
import { PathEngineWithStore, HttpStore } from "@daltonr/pathwrite-store-http";

function MyWizard() {
  const wrapperRef = useRef<PathEngineWithStore>();
  const [engine, setEngine] = useState(null);

  useEffect(() => {
    const store = new HttpStore({ baseUrl: "/api/wizard" });
    const wrapper = new PathEngineWithStore({
      key: "user:123:onboarding",
      store,
      persistenceStrategy: "onNext",
    });

    wrapper.startOrRestore(myPath, { "my-path": myPath })
      .then(() => setEngine(wrapper.getEngine()));

    wrapperRef.current = wrapper;

    return () => wrapper.cleanup();
  }, []);

  const handleNext = async () => {
    await engine?.next();
  };

  return <button onClick={handleNext}>Next</button>;
}
```

---

The store expects these endpoints:

| Method | Endpoint | Request Body | Response | Notes |
|---|---|---|---|---|
| `PUT` | `/state/{key}` | `SerializedPathState` | 200 OK | Creates or updates |
| `GET` | `/state/{key}` | — | `SerializedPathState` or 404 | 404 means no saved state |
| `DELETE` | `/state/{key}` | — | 200 OK or 404 | 404 is treated as success |

### Example Express backend

```ts
// server.js
import express from "express";

const app = express();
app.use(express.json());

// In-memory store (replace with your DB)
const states = new Map();

app.put("/api/wizard/state/:key", (req, res) => {
  const { key } = req.params;
  const state = req.body;
  
  // Validate it's a SerializedPathState
  if (!state.version || !state.pathId) {
    return res.status(400).json({ error: "Invalid state format" });
  }
  
  states.set(key, state);
  res.json({ ok: true });
});

app.get("/api/wizard/state/:key", (req, res) => {
  const { key } = req.params;
  const state = states.get(key);
  
  if (!state) {
    return res.status(404).json({ error: "Not found" });
  }
  
  res.json(state);
});

app.delete("/api/wizard/state/:key", (req, res) => {
  const { key } = req.params;
  states.delete(key);
  res.json({ ok: true });
});

app.listen(3000);
```

---

## Usage: Vue 3

Use `PathEngineWithStore` for automatic persistence, then pass the engine to `usePath()`:

```vue
<script setup lang="ts">
import { ref, shallowRef, onMounted, onBeforeUnmount } from "vue";
import { usePath, PathShell } from "@daltonr/pathwrite-vue";
import { HttpStore, PathEngineWithStore } from "@daltonr/pathwrite-store-http";
import { myPath, pathDefs } from "./paths";

const store = new HttpStore({
  baseUrl: "/api/wizard",
  headers: () => ({ Authorization: `Bearer ${getAuthToken()}` }),
});

const wrapper = new PathEngineWithStore({
  key: "user:123:onboarding",
  store,
  persistenceStrategy: "onNext",
});

const engine = shallowRef<PathEngine | null>(null);

onMounted(async () => {
  await wrapper.startOrRestore(myPath, pathDefs);
  engine.value = wrapper.getEngine();
});

onBeforeUnmount(() => wrapper.cleanup());
</script>

<template>
  <!-- Wait for engine before rendering -->
  <PathShell v-if="engine" :path="myPath" :engine="engine" @complete="handleDone">
    <template #step1>…</template>
    <template #step2>…</template>
  </PathShell>
  <p v-else>Loading…</p>
</template>
```


---

## Usage: React

Use `PathEngineWithStore` for automatic persistence, then pass the engine to `<PathShell>` or `usePath()`:

```tsx
import { useEffect, useRef, useState } from "react";
import { PathShell, PathEngine } from "@daltonr/pathwrite-react";
import { HttpStore, PathEngineWithStore } from "@daltonr/pathwrite-store-http";
import { myPath, pathDefs } from "./paths";

function WizardPage() {
  const [engine, setEngine] = useState<PathEngine | null>(null);
  const wrapperRef = useRef<PathEngineWithStore>();

  useEffect(() => {
    const store = new HttpStore({
      baseUrl: "/api/wizard",
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    });
    const wrapper = new PathEngineWithStore({
      key: "user:123:onboarding",
      store,
      persistenceStrategy: "onNext",
    });
    wrapperRef.current = wrapper;

    wrapper.startOrRestore(myPath, pathDefs).then(() => {
      setEngine(wrapper.getEngine());
    });

    return () => wrapper.cleanup();
  }, []);

  if (!engine) return <p>Loading…</p>;

  return (
    <PathShell
      path={myPath}
      engine={engine}
      onComplete={(data) => console.log("Done!", data)}
      steps={{ step1: <Step1 />, step2: <Step2 /> }}
    />
  );
}
```

---

## Usage: Vanilla JS (direct engine)

If you're using `PathEngine` directly (not via an adapter), it's simpler:

```ts
import { PathEngine } from "@daltonr/pathwrite-core";
import { HttpStore } from "@daltonr/pathwrite-store-http";
import { myPath } from "./paths.js";

const userId = "user-123";
const store = new HttpStore({ baseUrl: "/api/wizard" });

// Load or create engine
const saved = await store.load(`user:${userId}`);
const engine = saved
  ? PathEngine.fromState(saved, myPath)
  : new PathEngine();

// Auto-save on every change
engine.subscribe(async (event) => {
  if (event.type === "stateChanged" || event.type === "resumed") {
    const state = engine.exportState();
    await store.save(`user:${userId}`, state);
  }
});

// Start if it's a new engine
if (!saved) {
  await engine.start(myPath, { userId });
}

// Wire to DOM
document.getElementById("next").addEventListener("click", () => engine.next());
document.getElementById("back").addEventListener("click", () => engine.previous());
```

---

## Advanced: Custom URL patterns

```ts
const store = new HttpStore({
  baseUrl: "https://api.example.com",
  saveUrl: (key) => `https://api.example.com/users/${userId}/wizard/${key}`,
  loadUrl: (key) => `https://api.example.com/users/${userId}/wizard/${key}`,
  deleteUrl: (key) => `https://api.example.com/users/${userId}/wizard/${key}`,
  headers: async () => {
    // Fetch fresh token on every request
    const token = await refreshAuthToken();
    return { Authorization: `Bearer ${token}` };
  },
});
```

---

## Advanced: Debounced saves

Saving on every `stateChanged` event can be chatty. Debounce it:

```ts
import { debounce } from "lodash-es"; // or write your own

const debouncedSave = debounce(async (state: SerializedPathState) => {
  await store.save(`user:${userId}`, state);
}, 500);

engine.subscribe((event) => {
  if (event.type === "stateChanged") {
    debouncedSave(engine.exportState());
  }
});
```

---

## Advanced: Optimistic updates with rollback

```ts
let lastSavedState: SerializedPathState | null = null;

engine.subscribe(async (event) => {
  if (event.type === "stateChanged") {
    const state = engine.exportState();
    
    try {
      await store.save(`user:${userId}`, state);
      lastSavedState = state; // Save succeeded
    } catch (error) {
      console.error("Failed to save, rolling back:", error);
      
      // Rollback to last known-good state
      if (lastSavedState) {
        const restored = PathEngine.fromState(lastSavedState, myPath);
        // Need to replace the current engine instance
        // This is tricky with the current API
      }
      
      alert("Failed to save your progress. Please check your connection.");
    }
  }
});
```

---


## Server-side: Document-based state (multi-user)

If multiple users work on the same wizard state (see the approval scenario), you'd key by document rather than user:

```ts
const documentId = "doc-123";
const store = new HttpStore({ baseUrl: "/api/wizard" });

// Each user loads the shared document state
const saved = await store.load(`document:${documentId}`);

// But navigation state is per-user
const userNavState = await store.load(`nav:${documentId}:${userId}`);
```

Your backend would:
- Store `data` (the document content) shared across all users
- Store `wizardState` (step index, visited steps) per user
- Merge patches to `data` when multiple users save concurrently

See `DEVELOPER_GUIDE.md` section on multi-user wizards for the full pattern.

---

## Testing

Mock the fetch calls:

```ts
import { vi } from "vitest";
import { HttpStore } from "@daltonr/pathwrite-store-http";

test("saves state to API", async () => {
  const mockFetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response)
  );

  const store = new HttpStore({
    baseUrl: "/api",
    fetch: mockFetch as any,
  });

  const state = { version: 1, pathId: "test", /* ... */ };
  await store.save("key-1", state);

  expect(mockFetch).toHaveBeenCalledWith("/api/state/key-1", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state),
  });
});
```

---







