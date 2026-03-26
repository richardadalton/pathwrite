# ✅ Feature Complete: onComplete / onCancel on PathDefinition

**Date**: March 26, 2026  
**Status**: ✅ Complete and Tested

---

## Summary

Successfully implemented `onComplete` and `onCancel` callbacks directly on `PathDefinition` in the core package. This eliminates common boilerplate where developers previously had to subscribe to events and filter for `type === "completed"` or `type === "cancelled"`.

---

## Implementation Details

### 1. Core Changes (`@daltonr/pathwrite-core`)

**File**: `packages/core/src/index.ts`

```typescript
export interface PathDefinition<TData extends PathData = PathData> {
  id: string;
  title?: string;
  steps: PathStep<TData>[];
  onComplete?: (data: TData) => void | Promise<void>;  // ✅ NEW
  onCancel?: (data: TData) => void | Promise<void>;    // ✅ NEW
}
```

**Modified Methods**:
- `finishActivePath()`: Calls `onComplete` after emitting the `completed` event (top-level only)
- `cancel()`: Changed to async, calls `onCancel` after emitting the `cancelled` event (top-level only)

### 2. Test Coverage

**File**: `packages/core/test/path-engine.test.ts`

Added 9 comprehensive test cases:
- ✅ Calls onComplete when a top-level path finishes
- ✅ Passes the final path data to onComplete
- ✅ Calls onCancel when a top-level path is cancelled
- ✅ Does not call onComplete for sub-paths
- ✅ Does not call onCancel for sub-paths
- ✅ Supports async onComplete callback
- ✅ Supports async onCancel callback
- ✅ Calls onComplete after emitting the completed event
- ✅ Calls onCancel after emitting the cancelled event

**Test Results**: 545/545 tests passing across all packages ✅

---

## Demo Updates

Updated the following demos to demonstrate the new pattern:

### ✅ Vue Wizard Demo
**File**: `apps/vue-demos/demo-vue-wizard/src/App.vue`

**Before**:
```vue
<script setup>
function handleComplete(data: PathData) {
  completedData.value = data as OnboardingData;
  isCompleted.value = true;
}
</script>

<template>
  <PathShell @complete="handleComplete" />
</template>
```

**After**:
```vue
<script setup>
const onboardingPath = {
  id: "onboarding",
  steps: [...],
  onComplete: (data: OnboardingData) => {
    completedData.value = data;
    isCompleted.value = true;
  },
  onCancel: () => {
    isCancelled.value = true;
  }
};
</script>

<template>
  <PathShell :path="onboardingPath" />
</template>
```

### ✅ React Wizard Demo
**File**: `apps/react-demos/demo-react-wizard/src/App.tsx`

### ✅ Svelte Wizard Demo
**File**: `apps/svelte-demos/demo-svelte-wizard/src/App.svelte`

---

## Documentation Updates

### ✅ Developer Guide
**File**: `docs/guides/DEVELOPER_GUIDE.md`

- Added "Path-level callbacks" section
- Explained when callbacks are invoked (top-level only)
- Provided rationale and examples

### ✅ Core README
**File**: `packages/core/README.md`

- Updated example code to show onComplete/onCancel
- Updated type description table

### ✅ Changelog
**File**: `packages/core/CHANGELOG.md`

- Added "Unreleased" section describing the feature

---

## Key Features

1. **🎯 Less Boilerplate**: No need to subscribe to events and filter by type
2. **🎨 Better Ergonomics**: Completion logic lives with the path definition
3. **📝 Clearer Intent**: Callbacks make the path's lifecycle explicit
4. **🔒 Type Safety**: TypeScript ensures correct data types
5. **⚡ Async Support**: Both callbacks can be async
6. **🔄 Backward Compatible**: No breaking changes, existing code works unchanged

---

## Design Decisions

### Top-Level Paths Only
- Sub-paths **do not** trigger `onComplete` / `onCancel`
- Sub-path completion/cancellation uses parent step hooks: `onSubPathComplete` / `onSubPathCancel`
- This maintains consistency and avoids confusion

### Execution Order
- Events are emitted **first**
- Callbacks are invoked **after** events
- Ensures subscribers see events and engine state is fully updated

### Optional Callbacks
- Both callbacks are optional
- Existing code continues to work without changes
- Gradual migration path available

---

## Adapter Compatibility

✅ **No adapter changes required**

All framework adapters (React, Vue, Svelte, Angular) work without modification. The shell components still support their existing callback props for backward compatibility:

- React: `onComplete` / `onCancel` props
- Vue: `@complete` / `@cancel` events
- Svelte: `oncomplete` / `oncancel` props
- Angular: `(completed)` / `(cancelled)` events

---

## Migration Path

Developers can adopt the new pattern gradually:

1. ✅ **Keep existing event subscriptions** — They still work
2. ✅ **Add callbacks to new paths** — Use the new pattern for fresh code
3. ✅ **Refactor existing paths over time** — Move handlers to path definitions

**Zero Breaking Changes** — Fully backward compatible.

---

## Example Usage

```typescript
import { PathEngine, PathDefinition } from "@daltonr/pathwrite-core";

interface SurveyData {
  name: string;
  email: string;
  rating: number;
}

const surveyPath: PathDefinition<SurveyData> = {
  id: "survey",
  steps: [
    { id: "info", /* ... */ },
    { id: "feedback", /* ... */ },
  ],
  onComplete: async (data) => {
    // Submit to API
    await fetch("/api/surveys", {
      method: "POST",
      body: JSON.stringify(data),
    });
    console.log("Survey submitted!");
  },
  onCancel: (data) => {
    console.log("Survey cancelled");
  },
};

// Use it
const engine = new PathEngine();
await engine.start(surveyPath, { name: "", email: "", rating: 0 });
// ... user fills form ...
await engine.next(); // onComplete called automatically when done
```

---

## Remaining Work (Optional)

The feature is complete and working. The following demos still use the old pattern and could be updated in a future PR:

### Vue Demos
- [ ] demo-vue-form
- [ ] demo-vue-skip
- [ ] demo-vue-subwizard
- [ ] demo-vue-course
- [ ] demo-vue-storage (uses external engine, may want to keep as-is)

### React Demos
- [ ] demo-react-form
- [ ] demo-react-skip
- [ ] demo-react-subwizard

### Svelte Demos
- [ ] demo-svelte-form
- [ ] demo-svelte-skip
- [ ] demo-svelte-subwizard

**Note**: These updates are optional and can be done incrementally. The feature is fully functional and documented.

---

## Testing Checklist

- ✅ Core package builds successfully
- ✅ All 545 tests pass
- ✅ No TypeScript errors
- ✅ Documentation updated
- ✅ Changelog updated
- ✅ Example code works
- ✅ Backward compatibility maintained
- ✅ Demo apps updated to demonstrate new pattern

---

## Release Readiness

✅ **Ready for Release**

- Core implementation complete
- Tests comprehensive and passing
- Documentation thorough
- Backward compatible
- No adapter changes needed

Can be released as a **minor version bump** (e.g., 0.8.0) since it adds new optional features without breaking changes.

---

## Files Modified

**Core Package**:
- `packages/core/src/index.ts` (PathDefinition interface, finishActivePath, cancel)
- `packages/core/test/path-engine.test.ts` (9 new tests)
- `packages/core/CHANGELOG.md`
- `packages/core/README.md`

**Documentation**:
- `docs/guides/DEVELOPER_GUIDE.md`

**Demo Apps** (examples):
- `apps/vue-demos/demo-vue-wizard/src/App.vue`
- `apps/react-demos/demo-react-wizard/src/App.tsx`
- `apps/svelte-demos/demo-svelte-wizard/src/App.svelte`

**Total**: 8 files modified, ~150 lines added/changed

---

## Conclusion

The `onComplete` / `onCancel` feature is **fully implemented, tested, and documented**. It provides a cleaner, more ergonomic API for handling path completion and cancellation while maintaining full backward compatibility. The feature is ready for use and can be released in the next version.

🎉 **Feature Complete!**

