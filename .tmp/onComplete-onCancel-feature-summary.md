# onComplete / onCancel Feature Summary

## Date: March 26, 2026

## Overview

Added `onComplete` and `onCancel` optional callbacks to `PathDefinition` in the core package. This eliminates common boilerplate where developers had to subscribe to events and filter for `type === "completed"` or `type === "cancelled"`.

## What Changed

### Core Package (`@daltonr/pathwrite-core`)

1. **Updated `PathDefinition` interface** to include:
   ```typescript
   export interface PathDefinition<TData extends PathData = PathData> {
     id: string;
     title?: string;
     steps: PathStep<TData>[];
     onComplete?: (data: TData) => void | Promise<void>;
     onCancel?: (data: TData) => void | Promise<void>;
   }
   ```

2. **Modified `finishActivePath()` method**:
   - Now calls `finished.definition.onComplete(finishedData)` after emitting the `completed` event
   - Only called for top-level paths (not sub-paths)

3. **Modified `cancel()` method**:
   - Changed from synchronous to async (`public async cancel(): Promise<void>`)
   - Now calls `active.definition.onCancel(cancelledData)` after emitting the `cancelled` event
   - Only called for top-level paths (not sub-paths)

4. **Added comprehensive tests** (9 new test cases):
   - Verifies callbacks are called with correct data
   - Confirms sub-paths don't trigger these callbacks
   - Tests async callback support
   - Validates callback execution order (after events)

### Demo Updates

Updated the following demos to use the new pattern:
- `demo-vue-wizard` — Moved callbacks to path definition
- `demo-react-wizard` — Moved callbacks to path definition
- `demo-svelte-wizard` — Moved callbacks to path definition

**Before:**
```typescript
function handleComplete(data: PathData) {
  completedData.value = data as OnboardingData;
  isCompleted.value = true;
}

<PathShell
  :path="onboardingPath"
  @complete="handleComplete"
  @cancel="handleCancel"
/>
```

**After:**
```typescript
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

<PathShell :path="onboardingPath" />
```

### Documentation Updates

1. **Developer Guide** (`docs/guides/DEVELOPER_GUIDE.md`):
   - Added "Path-level callbacks" section with table
   - Explained when callbacks are called (top-level only)
   - Provided rationale for the feature

2. **Core README** (`packages/core/README.md`):
   - Updated example to show `onComplete` and `onCancel`
   - Updated type description table

3. **CHANGELOG** (`packages/core/CHANGELOG.md`):
   - Added "Unreleased" section describing the feature

## Benefits

1. **Less Boilerplate**: No need to subscribe to events and filter by type
2. **Better Ergonomics**: Completion logic lives with the path definition
3. **Clearer Intent**: The callbacks make the path's lifecycle explicit
4. **Type Safety**: TypeScript ensures data types are correct
5. **Async Support**: Both callbacks can be async for API calls or other async operations

## Adapter Compatibility

✅ **No adapter changes required** — The adapters continue to work without modification. The shell components still support their existing `onComplete` / `@complete` / `oncomplete` props for backward compatibility.

## Test Results

- **Core tests**: 205 passed (9 new tests added)
- **All adapter tests**: 545 total tests passing
- **No regressions**

## Design Decisions

1. **Top-level only**: Sub-paths don't trigger these callbacks because sub-path completion/cancellation is already handled by parent step hooks (`onSubPathComplete` / `onSubPathCancel`). This avoids confusion and maintains consistency.

2. **Event then callback**: The callbacks are invoked *after* the events are emitted. This ensures:
   - Subscribers see the events first
   - The engine state is fully updated
   - Backward compatibility with existing event-based code

3. **Async support**: Both callbacks can be async, allowing developers to perform API calls or other async operations without additional wrapping.

4. **Optional**: The callbacks are optional, so existing code continues to work without changes.

## Migration Path

Developers can migrate gradually:

1. **Keep existing event subscriptions** — They still work
2. **Add callbacks to new paths** — Use the new pattern for new code
3. **Refactor existing paths** — Move event handlers to path definitions over time

No breaking changes. Fully backward compatible.

## Next Steps

- [ ] Update remaining demos (subwizard, skip, form demos)
- [ ] Consider adding examples to Angular demos
- [ ] Update main README.md if needed
- [ ] Prepare for next release

