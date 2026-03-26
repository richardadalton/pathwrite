# isDirty Feature Implementation Summary

**Date:** March 26, 2026  
**Feature:** Automatic Dirty Tracking via `isDirty` field on `PathSnapshot`

---

## Overview

Implemented automatic dirty tracking that detects when data has changed since entering the current step. The engine compares current data to a snapshot taken on step entry, requiring zero configuration from developers.

---

## What Changed

### Core Engine (`@daltonr/pathwrite-core`)

#### 1. PathSnapshot Interface
**File:** `packages/core/src/index.ts` (lines 210-226)

Added `isDirty: boolean` field to the `PathSnapshot` interface with comprehensive JSDoc:

```typescript
/**
 * True if any data has changed since entering this step. Automatically computed
 * by comparing the current data to the snapshot taken on step entry. Resets to
 * `false` when navigating to a new step or calling `resetStep()`.
 *
 * Useful for "unsaved changes" warnings, disabling Save buttons until changes
 * are made, or styling forms to indicate modifications.
 */
isDirty: boolean;
```

#### 2. Dirty Detection Logic
**File:** `packages/core/src/index.ts` (lines 1182-1202)

Added private `computeIsDirty()` method:

```typescript
/**
 * Compares the current step data to the snapshot taken when the step was entered.
 * Returns `true` if any data value has changed.
 *
 * Performs a shallow comparison — only top-level keys are checked. Nested objects
 * are compared by reference, not by deep equality.
 */
private computeIsDirty(active: ActivePath): boolean {
  const current = active.data;
  const entry = active.stepEntryData;
  const allKeys = new Set([...Object.keys(current), ...Object.keys(entry)]);
  for (const key of allKeys) {
    if (current[key] !== entry[key]) {
      return true;
    }
  }
  return false;
}
```

**Design decisions:**
- **Shallow comparison**: Only top-level keys checked for performance
- **Reference comparison for nested objects**: Deliberate trade-off for simplicity
- **Leverages existing stepEntryData**: Reuses snapshot from `resetStep()` feature

#### 3. Snapshot Integration
**File:** `packages/core/src/index.ts` (line 637)

Added `isDirty` computation to the `snapshot()` method:

```typescript
isDirty: this.computeIsDirty(active),
```

#### 4. Comprehensive Tests
**File:** `packages/core/test/path-engine.test.ts` (lines 2201-2308)

Added 11 tests covering all isDirty scenarios:
- ✅ is false when step first entered
- ✅ becomes true after setData changes value
- ✅ remains false if setData sets same value
- ✅ becomes false after resetStep()
- ✅ resets to false on navigation forward
- ✅ resets to false on navigation backward
- ✅ detects multiple setData calls
- ✅ becomes false if changes reverted manually
- ✅ detects new keys added
- ✅ is false after restart
- ✅ tracks independently per step

**Test Results:** All 556 tests pass (216 core + 340 adapter tests)

---

## Documentation Updates

### 1. Core README
**File:** `packages/core/README.md`

- Added Quick Reference pattern showing isDirty usage with resetStep
- Added `isDirty` to API reference with clear comment
- Example usage showing unsaved changes warning

### 2. CHANGELOG
**File:** `packages/core/CHANGELOG.md`

Added to Unreleased section:
> **Added `isDirty` field to `PathSnapshot`** — Automatically tracks whether any data has changed since entering the current step. Uses shallow comparison of top-level keys. Resets to `false` when navigating to a new step or calling `resetStep()`. Enables "unsaved changes" warnings, conditional Save button styling, or form modification indicators without manual tracking. Zero configuration required.

### 3. Developer Guide
**File:** `docs/guides/DEVELOPER_GUIDE.md`

- Added `isDirty: boolean` to PathSnapshot interface documentation
- Added dedicated section explaining isDirty behavior with examples
- Documented shallow comparison design decision
- Provided common use case examples (unsaved changes warnings, disabled Save buttons, prompts, revert changes)

---

## Demos Updated

### Vue Form Demo
**File:** `apps/vue-demos/demo-vue-form/src/ContactStep.vue`

Added:
- Yellow "unsaved changes" banner that appears when `snapshot.isDirty === true`
- Disabled state on "Clear Form" button when not dirty (`:disabled="!snapshot.isDirty"`)
- CSS styles for banner and disabled button state

### React Form Demo
**Files:** 
- `apps/react-demos/demo-react-form/src/ContactStep.tsx`
- `apps/react-demos/demo-react-form/src/style.css`

Added:
- Yellow "unsaved changes" banner that appears when `snapshot?.isDirty === true`
- "Clear Form" reset button disabled when not dirty
- CSS styles for banner and disabled button state

Both demos now visually demonstrate:
1. Banner appears immediately when user modifies any field
2. Reset button is only enabled when changes exist
3. Banner disappears after clicking reset or navigating away

---

## Technical Details

### How It Works

1. **On Step Entry**: `stepEntryData` is captured in `_enterStep()` (existing mechanism from resetStep feature)

2. **On Every Snapshot**: `computeIsDirty()` compares current data to stepEntryData:
   - Collects all unique keys from both objects
   - Compares each value with strict equality (`===`)
   - Returns `true` if any value differs

3. **Automatic Reset**: isDirty returns to `false` when:
   - `_enterStep()` is called (navigation to new step)
   - `resetStep()` is called (data reverted)
   - `restart()` is called (entire path restarted)

### Shallow vs Deep Comparison

**Why shallow?**
- Most form data is flat (strings, numbers, booleans)
- Deep equality checks are expensive for large objects
- Predictable behavior: developers know when it triggers
- Consistent with common form patterns

**Limitation:**
- Mutating nested objects won't trigger isDirty
- Example: `data.address.city = "NYC"` won't set isDirty to true
- This is acceptable because:
  - Pathwrite encourages immutable updates via `setData()`
  - Edge case for most wizard/form use cases
  - Can be documented clearly

---

## Breaking Changes

**None.** This is a purely additive feature:
- New field added to PathSnapshot interface
- No changes to existing APIs
- All existing tests continue to pass
- Backward compatible with all adapters

---

## Verification

### Build Status
✅ All 6 packages built successfully:
- `@daltonr/pathwrite-core`
- `@daltonr/pathwrite-react`
- `@daltonr/pathwrite-vue`
- `@daltonr/pathwrite-angular`
- `@daltonr/pathwrite-svelte`
- `@daltonr/pathwrite-store-http`

### Test Status
✅ All 556 tests pass:
- 216 core engine tests (including 11 new isDirty tests)
- 340 adapter tests

### Type Safety
✅ TypeScript compilation successful across all packages
✅ No type errors introduced

---

## Usage Examples

### Basic "Unsaved Changes" Warning

```typescript
// React
{snapshot?.isDirty && (
  <div className="warning">You have unsaved changes</div>
)}

// Vue
<div v-if="snapshot?.isDirty" class="warning">
  You have unsaved changes
</div>

// Angular
@if (path.snapshot()?.isDirty) {
  <div class="warning">You have unsaved changes</div>
}
```

### Conditional Save Button

```typescript
// React
<button disabled={!snapshot?.isDirty} onClick={handleSave}>
  Save
</button>

// Vue
<button :disabled="!snapshot?.isDirty" @click="handleSave">
  Save
</button>

// Angular
<button [disabled]="!path.snapshot()?.isDirty" (click)="handleSave()">
  Save
</button>
```

### Navigation Guard with Prompt

```typescript
// React
const handleNavigateAway = () => {
  if (snapshot?.isDirty && !confirm("Discard changes?")) {
    return; // Stay on page
  }
  navigate("/somewhere");
};

// Vue
const handleNavigateAway = () => {
  if (snapshot.value?.isDirty && !confirm("Discard changes?")) {
    return;
  }
  router.push("/somewhere");
};
```

### Reset Changes

```typescript
// React
<button onClick={resetStep} disabled={!snapshot?.isDirty}>
  Undo Changes
</button>

// Vue
<button @click="resetStep" :disabled="!snapshot?.isDirty">
  Undo Changes
</button>

// Angular
<button (click)="path.resetStep()" [disabled]="!path.snapshot()?.isDirty">
  Undo Changes
</button>
```

---

## Next Steps

The isDirty feature is **complete and production-ready**. Possible future enhancements (not required):

1. **Deep Comparison Option**: Add optional `isDirtyDeep` field for nested object tracking
2. **Field-Level Dirty**: Track which specific fields changed (e.g., `dirtyFields: Set<string>`)
3. **Custom Comparator**: Allow developers to provide custom equality function
4. **Demo Enhancements**: Add more demos showing isDirty with persistence strategies

However, the current implementation satisfies the backlog requirement:
> "The engine compares current step data to the data snapshot taken on entry. The snapshot gains: `isDirty: boolean; // true if any data key has changed since entering this step`"

✅ **Feature complete and ready for release.**

---

## Files Modified

### Core Package
- `packages/core/src/index.ts` (PathSnapshot interface, computeIsDirty method, snapshot integration)
- `packages/core/test/path-engine.test.ts` (11 new tests)
- `packages/core/README.md` (API docs and examples)
- `packages/core/CHANGELOG.md` (release notes)

### Documentation
- `docs/guides/DEVELOPER_GUIDE.md` (comprehensive usage guide)

### Demos
- `apps/vue-demos/demo-vue-form/src/ContactStep.vue` (banner and button)
- `apps/react-demos/demo-react-form/src/ContactStep.tsx` (banner and button)
- `apps/react-demos/demo-react-form/src/style.css` (styles)

**Total:** 7 files modified, 1 new summary document created

---

**Implementation Status:** ✅ Complete  
**Tests:** ✅ All passing (556/556)  
**Build:** ✅ Successful  
**Documentation:** ✅ Complete  
**Demos:** ✅ Updated and functional

