# Auto-Persistence Feature - Implementation Summary

## ✅ Completed

Auto-persistence functionality for `@daltonr/pathwrite-store-http` has been successfully implemented and tested.

---

## What Was Implemented

### 1. PathEngineWithStore Class

A high-level wrapper that combines `PathEngine` with `HttpStore` to provide automatic state persistence.

**Key Features:**
- Automatic state persistence based on configurable strategies
- Debouncing support to reduce API calls
- Error handling with callbacks
- Lifecycle management (cleanup, waiting for pending saves)
- Seamless integration with existing PathEngine API

**API:**
```typescript
const wrapper = new PathEngineWithStore({
  key: string,                    // Storage key for this wizard
  store: HttpStore,               // HttpStore instance
  persistenceStrategy?: PersistenceStrategy,  // When to save
  debounceMs?: number,           // Debounce time in ms
  onSaveSuccess?: () => void,    // Success callback
  onSaveError?: (error: Error) => void,  // Error callback
});

await wrapper.startOrRestore(path, pathDefinitions, initialData?);
const engine = wrapper.getEngine();
await wrapper.save();              // Manual save
await wrapper.waitForPendingSave(); // Wait for pending saves
await wrapper.deleteSavedState();  // Delete saved state
wrapper.cleanup();                 // Cleanup resources
```

### 2. Persistence Strategies

Five strategies to control when wizard state is automatically saved:

| Strategy | Behavior | Use Case |
|---|---|---|
| **onNext** (default) | Saves only when user navigates forward | Best balance of safety and performance for most wizards |
| **onEveryChange** | Saves on every `stateChanged` or `resumed` event | Maximum crash protection. **⚠️ Without debouncing, saves on every keystroke!** Use `debounceMs: 500` with text inputs. |
| **onSubPathComplete** | Saves when sub-wizards complete | Multi-step flows with nested sub-paths |
| **onComplete** | Saves final state when wizard completes | Record-keeping, auditing (not for restoration) |
| **manual** | Never auto-saves | Developer controls saves explicitly |

### 3. Debouncing Support (For `onEveryChange` Strategy)

Configurable debouncing to batch rapid changes and reduce server load:

```typescript
const wrapper = new PathEngineWithStore({
  key: "user:123:wizard",
  store,
  persistenceStrategy: "onEveryChange", // Required for debouncing to be useful
  debounceMs: 500, // Wait 500ms after last change
});
```

**Critical for Form Inputs with `onEveryChange`**: Without debouncing, typing "Hello" triggers 5 saves (one per keystroke). With `debounceMs: 500`, only 1 save occurs after the user stops typing.

| Scenario | onNext (default) | onEveryChange (no debounce) | onEveryChange (500ms debounce) |
|---|---|---|---|
| User types "Hello" | 0 saves | **5 saves** ❌ | **1 save** ✅ |
| User clicks Next | **1 save** ✅ | **1 save** | **1 save** |
| **Total** | **1 save** | **6 saves** | **2 saves** |

**Note**: With the default `onNext` strategy, debouncing is unnecessary since saves only occur on navigation, not during typing.

### 4. Lifecycle Callbacks

Monitor save operations:

```typescript
const wrapper = new PathEngineWithStore({
  key: "user:123:wizard",
  store,
  onSaveSuccess: () => showToast("Saved!"),
  onSaveError: (err) => showToast(`Error: ${err.message}`, "error"),
});
```

### 5. Special Handling for Completion

- **onEveryChange, onNext, onSubPathComplete**: Deletes saved state when wizard completes (no need to restore completed wizards)
- **onComplete**: Saves final state as a record (includes `pathId` and final `data` with `currentStepIndex: -1` to indicate completion)

---

## Implementation Details

### Key Design Decisions

1. **Separate Save from Engine State**: When wizard completes, `engine.exportState()` returns `null` (no active path). For `onComplete` strategy, we build a final `SerializedPathState` from the `completed` event data.

2. **Non-blocking Saves**: Saves happen asynchronously without blocking navigation. Users can continue using the wizard even if saves fail.

3. **Promise-based performSave**: `performSave()` returns a `Promise` so `waitForPendingSave()` can properly await completion.

4. **Debounce Timer Management**: Timers are properly cleared on cleanup to avoid memory leaks.

5. **Overlapping Save Prevention**: `pendingSave` tracks in-flight saves to prevent overlapping requests.

### Bug Fixes

- **Fixed `performSave()` return type**: Changed from `void` to `Promise<void>` to enable proper awaiting
- **Fixed completion handling**: `onComplete` strategy now properly saves final state from the `completed` event instead of trying to export state after it's cleared

---

## Test Coverage

**23 comprehensive tests** covering:

### HttpStore Tests (10 tests)
- ✅ Saves state via PUT request
- ✅ Loads state via GET request
- ✅ Returns null when GET returns 404
- ✅ Deletes state via DELETE request
- ✅ Includes custom headers in requests
- ✅ Calls async header function
- ✅ Uses custom URL builders
- ✅ Calls onError when save fails
- ✅ Strips trailing slash from baseUrl
- ✅ URL-encodes keys with special characters

### PathEngineWithStore Tests (13 tests)
- ✅ Starts fresh when no saved state exists
- ✅ Restores from saved state when it exists
- ✅ Auto-saves on every change with onEveryChange strategy
- ✅ Does not auto-save with manual strategy
- ✅ Allows manual save when strategy is manual
- ✅ Debounces saves when debounceMs is set
- ✅ Calls onSaveSuccess callback on successful save
- ✅ Calls onSaveError callback when save fails
- ✅ Deletes saved state when wizard completes
- ✅ Saves on sub-path completion with onSubPathComplete strategy
- ✅ Only saves on completion with onComplete strategy
- ✅ Throws error if getEngine is called before startOrRestore
- ✅ Cleans up resources on cleanup

---

## Documentation

### Updated Files

1. **`/packages/store-http/README.md`** - Complete rewrite with:
   - Quick start guide with PathEngineWithStore
   - Persistence strategies table
   - Debouncing examples
   - Backend API contract
   - HttpStore options reference
   - Manual usage examples
   - Advanced features (callbacks, waiting for saves, cleanup)
   - Testing examples
   - Migration guide
   - Framework integration examples (Vue 3, React)

2. **`/packages/core/README.md`** - Added serialization API documentation (from previous work)

---

## Files Modified

1. `/packages/store-http/src/index.ts` - Implementation
2. `/packages/store-http/test/index.test.ts` - Tests
3. `/packages/store-http/README.md` - Documentation

---

## Build Status

✅ TypeScript compilation successful  
✅ **All 380 tests passing** across all packages:
- 182 core tests
- 23 store-http tests  
- 55 angular-adapter tests
- 35 + 30 react-adapter tests
- 28 + 27 vue-adapter tests

✅ Type definitions generated correctly  
✅ No breaking changes to existing APIs

---

## Usage Examples

### Minimal Example

```typescript
import { PathEngineWithStore, HttpStore } from "@daltonr/pathwrite-store-http";

const store = new HttpStore({ baseUrl: "/api/wizard" });
const wrapper = new PathEngineWithStore({
  key: "user:123:onboarding",
  store,
});

await wrapper.startOrRestore(myPath, { "my-path": myPath });
const engine = wrapper.getEngine();

// Use normally - saves automatically
await engine.next();
await engine.setData("name", "Alice");
```

### With All Options

```typescript
const wrapper = new PathEngineWithStore({
  key: `user:${userId}:wizard`,
  store: new HttpStore({
    baseUrl: "/api/wizard",
    headers: async () => ({
      Authorization: `Bearer ${await getToken()}`,
    }),
    onError: (err, op, key) => console.error(`${op} failed for ${key}:`, err),
  }),
  persistenceStrategy: "onNext",
  debounceMs: 500,
  onSaveSuccess: () => showToast("✓ Progress saved"),
  onSaveError: (err) => showToast(`✗ ${err.message}`, "error"),
});
```

---

## Migration Path

### From Manual Subscription

**Before:**
```typescript
const engine = new PathEngine();
engine.subscribe(async (event) => {
  if (event.type === "stateChanged") {
    const state = engine.exportState();
    if (state) await store.save(key, state);
  }
});
```

**After:**
```typescript
const wrapper = new PathEngineWithStore({ key, store });
await wrapper.startOrRestore(path, pathDefinitions);
const engine = wrapper.getEngine();
```

---

## Future Enhancements (Not Implemented)

Potential improvements for future versions:

1. **Retry Logic**: Automatic retry on save failures with exponential backoff
2. **Offline Support**: Queue saves when offline, sync when back online
3. **Conflict Resolution**: Handle concurrent edits from multiple devices/users
4. **Compression**: Optional gzip compression for large wizard states
5. **Partial Updates**: Send only changed data instead of full state
6. **Adapter Integration**: Built-in hooks for Vue/React/Angular adapters

---

## Next Steps

1. ✅ Implement serialization API in core (DONE)
2. ✅ Implement auto-persistence in store-http (DONE)
3. Update adapter packages (Vue, React, Angular) to expose `exportState()` and accept engine/state
4. Create integration examples in demo apps
5. Publish updated packages to npm

---

## Breaking Changes

**None.** This is a purely additive feature. Existing code using `HttpStore` directly continues to work unchanged.





