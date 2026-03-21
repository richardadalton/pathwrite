# Migration Guide: Adding HTTP Persistence to an Existing Wizard

This guide shows what changes when you add REST API persistence to a wizard that currently only lives in memory.

---

## Before: Memory-only wizard

```vue
<script setup>
import { usePath } from "@daltonr/pathwrite-vue";
import { registrationPath } from "./paths";

const { snapshot, start, next, previous } = usePath();

// Start immediately
start(registrationPath, { name: "", email: "" });
</script>

<template>
  <div v-if="snapshot">
    <h2>{{ snapshot.stepTitle }}</h2>
    <!-- Step content based on snapshot.stepId -->
    <button @click="next">Next</button>
  </div>
</template>
```

**Lifetime:** The wizard state lives only as long as the component is mounted. Refresh the page = start over.

---

## After: Persistent wizard

```vue
<script setup>
import { ref, onMounted, watchEffect } from "vue";
import { PathEngine } from "@daltonr/pathwrite-core";
import { HttpStore } from "@daltonr/pathwrite-store-http";
import { registrationPath } from "./paths";

const userId = getCurrentUser().id;
const snapshot = ref(null);

// Create the store
const store = new HttpStore({
  baseUrl: "/api/wizard",
  headers: { Authorization: `Bearer ${getToken()}` },
});

let engine = null;

// Load on mount
onMounted(async () => {
  const saved = await store.load(`user:${userId}`);
  
  if (saved) {
    // Resume from saved state
    engine = PathEngine.fromState(saved, registrationPath);
  } else {
    // Start fresh
    engine = new PathEngine();
    await engine.start(registrationPath, { name: "", email: "" });
  }
  
  // Subscribe to updates
  engine.subscribe((event) => {
    if (event.type === "stateChanged") {
      snapshot.value = event.snapshot;
    }
  });
  
  snapshot.value = engine.snapshot();
});

// Auto-save on changes
watchEffect(() => {
  if (!snapshot.value || !engine) return;
  
  const state = engine.exportState();
  store.save(`user:${userId}`, state);
});

const next = () => engine?.next();
const previous = () => engine?.previous();
</script>

<template>
  <div v-if="snapshot">
    <h2>{{ snapshot.stepTitle }}</h2>
    <!-- Same step content -->
    <button @click="next">Next</button>
  </div>
</template>
```

**Lifetime:** The wizard state persists across page refreshes, browser restarts, and even device changes (if synced server-side).

---

## What changed

### 1. Added imports
```diff
+ import { PathEngine } from "@daltonr/pathwrite-core";
+ import { HttpStore } from "@daltonr/pathwrite-store-http";
+ import { ref, onMounted, watchEffect } from "vue";
```

### 2. Created the store
```ts
const store = new HttpStore({
  baseUrl: "/api/wizard",
  headers: { Authorization: `Bearer ${getToken()}` },
});
```

### 3. Load-or-start pattern in `onMounted`
```ts
const saved = await store.load(`user:${userId}`);

if (saved) {
  engine = PathEngine.fromState(saved, registrationPath);
} else {
  engine = new PathEngine();
  await engine.start(registrationPath, { name: "", email: "" });
}
```

### 4. Auto-save on changes
```ts
watchEffect(() => {
  if (!snapshot.value || !engine) return;
  store.save(`user:${userId}`, engine.exportState());
});
```

### 5. Backend API (new)
```ts
app.put("/api/wizard/state/:key", (req, res) => {
  db.save(req.params.key, req.body);
  res.json({ ok: true });
});

app.get("/api/wizard/state/:key", (req, res) => {
  const state = db.load(req.params.key);
  state ? res.json(state) : res.status(404).end();
});
```

---

## Template changes

**None.** The template is unchanged — it still reads from `snapshot` and calls `next()` / `previous()`. The persistence layer is invisible to the UI.

---

## Improvements to consider

### Debounce saves (avoid chatty API calls)
```ts
import { debounce } from "lodash-es";

const debouncedSave = debounce((state) => {
  store.save(`user:${userId}`, state);
}, 500);

watchEffect(() => {
  if (snapshot.value && engine) {
    debouncedSave(engine.exportState());
  }
});
```

### Show save status
```vue
<script setup>
const saveStatus = ref("saved"); // "saving" | "saved" | "error"

watchEffect(async () => {
  if (!snapshot.value || !engine) return;
  
  saveStatus.value = "saving";
  try {
    await store.save(`user:${userId}`, engine.exportState());
    saveStatus.value = "saved";
  } catch (error) {
    saveStatus.value = "error";
  }
});
</script>

<template>
  <div class="save-status">
    <span v-if="saveStatus === 'saving'">Saving...</span>
    <span v-if="saveStatus === 'saved'">✓ Saved</span>
    <span v-if="saveStatus === 'error'">⚠️ Save failed</span>
  </div>
</template>
```

### Clear saved state on completion
```ts
engine.subscribe(async (event) => {
  if (event.type === "completed") {
    await store.delete(`user:${userId}`);
  }
});
```

---

## Migration checklist

- [ ] Add `@daltonr/pathwrite-store-http` to package.json
- [ ] Create `HttpStore` instance with your API URL
- [ ] Add load-or-start pattern in `onMounted`
- [ ] Add auto-save in `watchEffect` (or on `stateChanged` event)
- [ ] Implement backend endpoints (PUT/GET/DELETE)
- [ ] Test refresh behavior — should resume where you left off
- [ ] Consider debouncing saves
- [ ] Consider showing save status
- [ ] Consider clearing state on completion

---

## Testing the migration

1. **Start the wizard** — should work as before
2. **Advance to step 2** — should auto-save
3. **Refresh the browser** — should resume on step 2
4. **Open dev tools → Network** — should see PUT to `/api/wizard/state/...`
5. **Complete the wizard** — should clear saved state (if you implemented that)
6. **Start again** — should start from step 1 (not resume)

---

## Rollback plan

If something goes wrong, you can revert to memory-only:

```diff
- const saved = await store.load(...);
- if (saved) { ... }
+ // Just start fresh every time
+ engine = new PathEngine();
+ await engine.start(registrationPath, initialData);
```

Remove the `watchEffect` save logic, and you're back to the original behavior.

---

## Common issues

### "Cannot read property 'exportState' of null"
Engine isn't initialized yet. Guard the save call:
```ts
if (engine) {
  await store.save(..., engine.exportState());
}
```

### "HTTP 401 Unauthorized"
Auth token is missing or expired. Pass it in headers:
```ts
const store = new HttpStore({
  headers: async () => ({
    Authorization: `Bearer ${await getToken()}`,
  }),
});
```

### Saves are too chatty (100+ requests per minute)
Add debouncing:
```ts
const debouncedSave = debounce(save, 500);
```

### User loses progress when completing the wizard
Clear the saved state on completion:
```ts
if (event.type === "completed") {
  await store.delete(`user:${userId}`);
}
```

---

## Summary

**Migration is additive.** You add the store, the load-or-start pattern, and the auto-save logic. The template and path definition don't change. If you hit issues, you can revert to memory-only by removing the persistence layer — the wizard still works.

