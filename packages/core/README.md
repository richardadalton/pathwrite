# @daltonr/pathwrite-core

Headless path engine with zero dependencies. Manages step navigation, navigation guards, lifecycle hooks, and stack-based sub-path orchestration. Works equally well driving a UI wizard or a backend document lifecycle — no framework required.

## Quick Reference: Common Patterns

### ✅ Write Defensive Guards
```typescript
// Guards run BEFORE onEnter - always handle undefined data
canMoveNext: (ctx) => (ctx.data.name ?? "").trim().length > 0  // ✅ Safe
canMoveNext: (ctx) => ctx.data.name.trim().length > 0          // ❌ Crashes!
```

### ✅ Use `isFirstEntry` to Prevent Data Reset
```typescript
onEnter: (ctx) => {
  if (ctx.isFirstEntry) {
    return { items: [], status: "pending" };  // Initialize only on first visit
  }
  // Don't reset when user navigates back
}
```

### ✅ Correlate Sub-Paths with `meta`
```typescript
// Starting sub-path
engine.startSubPath(subPath, initialData, { itemIndex: i });

// In parent step
onSubPathComplete: (_id, subData, ctx, meta) => {
  const index = meta?.itemIndex;  // Correlate back to collection item
  // ...
}
```

---

## Key types

```typescript
// Define your path's data shape once
interface CourseData extends PathData {
  courseName: string;
  subjects: SubjectEntry[];
}

const path: PathDefinition<CourseData> = {
  id: "course-path",
  steps: [
    {
      id: "details",
      canMoveNext: (ctx) => ctx.data.courseName.length > 0,
      onLeave: (ctx) => ({ courseName: ctx.data.courseName.trim() })
    },
    { id: "review" }
  ]
};
```

| Type | Description |
|------|-------------|
| `PathDefinition<TData>` | A path's ID, title, and ordered list of step definitions. |
| `PathStep<TData>` | A single step: guards, lifecycle hooks. |
| `PathStepContext<TData>` | Passed to every hook and guard. `data` is a **readonly snapshot copy** — return a patch to update state. |
| `PathSnapshot<TData>` | Point-in-time read of the engine: step ID, index, count, flags, and a copy of data. |
| `PathEvent` | Union of `stateChanged` (includes `cause`), `completed`, `cancelled`, and `resumed`. |
| `StateChangeCause` | Identifies the method that triggered a `stateChanged` event: `"start"` \| `"next"` \| `"previous"` \| `"goToStep"` \| `"goToStepChecked"` \| `"setData"` \| `"cancel"` \| `"restart"`. |

## PathEngine API

```typescript
const engine = new PathEngine();

engine.start(definition, initialData?);    // start or re-start a path
engine.restart(definition, initialData?);  // tear down stack and start fresh (no hooks, no cancelled event)
engine.startSubPath(definition, data?, meta?); // push sub-path onto the stack (requires active path)
engine.next();
engine.previous();
engine.cancel();
engine.setData(key, value);                // update a single data value; emits stateChanged
engine.goToStep(stepId);                   // jump to step by ID; bypasses guards and shouldSkip
engine.goToStepChecked(stepId);            // jump to step by ID; checks canMoveNext / canMovePrevious first
engine.snapshot();                         // returns PathSnapshot | null

// Serialization API (for persistence)
const state = engine.exportState();        // returns SerializedPathState | null
const restoredEngine = PathEngine.fromState(state, pathDefinitions);

const unsubscribe = engine.subscribe((event) => { ... });
unsubscribe(); // remove the listener
```

## Lifecycle hooks

All hooks are optional. Hooks that want to update data **return a partial patch** — the engine applies it automatically. Direct mutation of `ctx.data` is a no-op; the context receives a copy.

| Hook | When called | Can return patch |
|------|-------------|-----------------|
| `onEnter` | On arrival at a step (start, next, previous, resume) | ✅ |
| `onLeave` | On departure from a step (only when the guard allows) | ✅ |
| `onSubPathComplete` | On the parent step when a sub-path finishes | ✅ |
| `onSubPathCancel` | On the parent step when a sub-path is cancelled | ✅ |
| `canMoveNext` | Before advancing — return `false` to block | — |
| `canMovePrevious` | Before going back — return `false` to block | — |
| `validationMessages` | On every snapshot — return `string[]` explaining why the step is not yet valid | — |

### Using `isFirstEntry` to Avoid Data Reset

**Problem:** `onEnter` fires EVERY time you enter a step, including when navigating backward. If you initialize data in `onEnter`, you'll overwrite user input when they return to the step.

**Solution:** Use `ctx.isFirstEntry` to distinguish first visit from re-entry:

```typescript
{
  id: "user-details",
  onEnter: (ctx) => {
    // Only initialize on first entry, not on re-entry
    if (ctx.isFirstEntry) {
      return {
        name: "",
        email: "",
        preferences: { newsletter: true }
      };
    }
    // On re-entry (e.g., user pressed Back), keep existing data
  }
}
```

**Common Patterns:**

```typescript
// Initialize empty collection on first entry only
onEnter: (ctx) => {
  if (ctx.isFirstEntry) {
    return { approvals: [], comments: [] };
  }
}

// Fetch data from API only once
onEnter: async (ctx) => {
  if (ctx.isFirstEntry) {
    const userData = await fetchUserProfile(ctx.data.userId);
    return { ...userData };
  }
}

// Set defaults but preserve user changes on re-entry
onEnter: (ctx) => {
  if (ctx.isFirstEntry) {
    return {
      reviewStatus: "pending",
      lastModified: new Date().toISOString()
    };
  }
}
```

### Snapshot guard booleans

The snapshot includes `canMoveNext` and `canMovePrevious` booleans — the evaluated results of the current step's guards. Use them to proactively disable navigation buttons. Sync guards reflect their real value; async guards default to `true` (optimistic). Both update automatically when data changes via `setData`.

### ⚠️ IMPORTANT: Guards Run Before `onEnter`

**Guards are evaluated BEFORE `onEnter` runs on first entry.** This is critical to understand:

1. When a path starts, the engine creates the first snapshot immediately
2. Guards (`canMoveNext`, `validationMessages`) are evaluated to populate that snapshot
3. Only THEN does `onEnter` run to initialize data

**This means guards see `initialData`, not data that `onEnter` would set.**

#### Defensive Guard Patterns

Always write guards defensively to handle undefined/missing data:

```typescript
// ❌ WRONG - Crashes on first snapshot when initialData = {}
{
  id: "user-details",
  canMoveNext: (ctx) => ctx.data.name.trim().length > 0,  // TypeError!
  onEnter: () => ({ name: "" })  // Too late - guard already ran
}

// ✅ CORRECT - Use nullish coalescing
{
  id: "user-details",
  canMoveNext: (ctx) => (ctx.data.name ?? "").trim().length > 0,
  onEnter: () => ({ name: "" })
}

// ✅ ALSO CORRECT - Provide initialData so fields exist from the start
engine.start(path, { name: "", email: "" });
```

#### More Defensive Patterns

```typescript
// Arrays
canMoveNext: (ctx) => (ctx.data.items ?? []).length > 0

// Numbers
canMoveNext: (ctx) => (ctx.data.age ?? 0) >= 18

// Complex objects
canMoveNext: (ctx) => {
  const address = ctx.data.address ?? {};
  return (address.street ?? "").length > 0 && (address.city ?? "").length > 0;
}

// Validation messages
validationMessages: (ctx) => {
  const messages = [];
  if (!(ctx.data.email ?? "").includes("@")) {
    messages.push("Please enter a valid email");
  }
  return messages;
}
```

#### Error Handling

If a guard or `validationMessages` hook throws, Pathwrite catches the error, emits a `console.warn` (with the step ID and thrown value), and returns the safe default (`true` / `[]`) so the UI remains operable. However, **relying on error handling is not recommended** — write defensive guards instead.

### Sub-path example with meta correlation

```typescript
{
  id: "subjects-list",
  onSubPathComplete: (_id, subData, ctx, meta) => {
    // meta contains the correlation object passed to startSubPath
    const index = meta?.index as number;
    return {
      subjects: [...(ctx.data.subjects ?? []), { 
        index,
        name: subData.name, 
        teacher: subData.teacher 
      }]
    };
  },
  onSubPathCancel: (_id, ctx, meta) => {
    // Called when user cancels sub-path (e.g., Back on first step)
    const index = meta?.index as number;
    console.log(`User skipped subject ${index}`);
    // Return patch to record the skip, or return nothing to ignore
  }
}
```

## Sub-Paths: Comprehensive Guide

Sub-paths let you nest workflows — for example, running a mini-wizard for each item in a collection.

### Basic Flow

```typescript
engine.start(mainPath)          → stack: []         active: main
engine.startSubPath(subPath)    → stack: [main]     active: sub
engine.next()  // sub finishes
  → onSubPathComplete fires on the parent step
  → stack: []                   active: main (resumed)
```

### Complete Example: Document Approval Workflow

```typescript
interface ApprovalData extends PathData {
  documentTitle: string;
  approvers: Array<{ name: string; email: string }>;
  approvals: Array<{ approverIndex: number; decision: string; comments: string }>;
}

interface ApproverReviewData extends PathData {
  documentTitle: string;  // Passed from parent
  decision?: "approve" | "reject";
  comments?: string;
}

// Main path
const approvalPath: PathDefinition<ApprovalData> = {
  id: "approval-workflow",
  steps: [
    {
      id: "setup",
      onEnter: (ctx) => {
        if (ctx.isFirstEntry) {
          return { approvers: [], approvals: [] };
        }
      }
    },
    {
      id: "run-approvals",
      // Block next until all approvers have completed
      canMoveNext: (ctx) => {
        const approversCount = (ctx.data.approvers ?? []).length;
        const approvalsCount = (ctx.data.approvals ?? []).length;
        return approversCount > 0 && approvalsCount === approversCount;
      },
      validationMessages: (ctx) => {
        const approversCount = (ctx.data.approvers ?? []).length;
        const approvalsCount = (ctx.data.approvals ?? []).length;
        const remaining = approversCount - approvalsCount;
        if (remaining > 0) {
          return [`${remaining} approver(s) still need to complete their review`];
        }
        return [];
      },
      // Called when each approver sub-path completes
      onSubPathComplete: (_subPathId, subData, ctx, meta) => {
        const reviewData = subData as ApproverReviewData;
        const approverIndex = meta?.approverIndex as number;
        
        return {
          approvals: [
            ...(ctx.data.approvals ?? []),
            {
              approverIndex,
              decision: reviewData.decision!,
              comments: reviewData.comments ?? ""
            }
          ]
        };
      },
      // Called when approver cancels (presses Back on first step)
      onSubPathCancel: (_subPathId, ctx, meta) => {
        const approverIndex = meta?.approverIndex as number;
        console.log(`Approver ${approverIndex} declined to review`);
        // Could add to a "skipped" list or just ignore
      }
    },
    { id: "summary" }
  ]
};

// Sub-path for each approver
const approverReviewPath: PathDefinition<ApproverReviewData> = {
  id: "approver-review",
  steps: [
    { id: "review-document" },
    {
      id: "make-decision",
      canMoveNext: (ctx) => ctx.data.decision !== undefined
    },
    { id: "add-comments" }
  ]
};

// Usage in UI component
function ReviewStep() {
  const approvers = snapshot.data.approvers ?? [];
  const approvals = snapshot.data.approvals ?? [];
  
  const startReview = (approverIndex: number) => {
    const approver = approvers[approverIndex];
    
    // Start sub-path with meta correlation
    engine.startSubPath(
      approverReviewPath,
      {
        documentTitle: snapshot.data.documentTitle,  // Pass context from parent
        // decision and comments will be filled during sub-path
      },
      { approverIndex }  // Meta: correlates completion back to this approver
    );
  };
  
  return (
    <div>
      {approvers.map((approver, i) => (
        <div key={i}>
          {approver.name}
          {approvals.some(a => a.approverIndex === i) ? (
            <span>✓ Reviewed</span>
          ) : (
            <button onClick={() => startReview(i)}>Start Review</button>
          )}
        </div>
      ))}
    </div>
  );
}
```

### Sub-Path Key Concepts

1. **Stack-based**: Sub-paths push onto a stack. Parent is paused while sub-path is active.

2. **Meta correlation**: Pass a `meta` object to `startSubPath()` to identify which collection item triggered the sub-path. It's passed back unchanged to `onSubPathComplete` and `onSubPathCancel`.

3. **Data isolation**: Sub-path data is separate from parent data. Pass needed context (like `documentTitle`) in `initialData`.

4. **Completion vs Cancellation**:
   - **Complete**: User reaches the last step → `onSubPathComplete` fires
   - **Cancel**: User presses Back on first step → `onSubPathCancel` fires
   - `onSubPathComplete` is NOT called on cancellation

5. **Parent remains on same step**: After sub-path completes/cancels, parent resumes at the same step (not advanced automatically).

6. **Guards still apply**: Parent step's `canMoveNext` is evaluated when resuming. Use it to block until all sub-paths complete.

### What the Shell Renders During Sub-Paths

When a sub-path is active:
- Progress bar shows sub-path steps (parent steps disappear)
- Back button on sub-path's first step cancels the sub-path
- Completing the sub-path returns to parent (parent step re-renders)

### Nesting Levels

Sub-paths can themselves start sub-paths (unlimited nesting). Use `snapshot.nestingLevel` to determine depth:
- `0` = top-level path
- `1` = first-level sub-path
- `2+` = deeper nesting

## Events

```typescript
engine.subscribe((event) => {
  switch (event.type) {
    case "stateChanged": // event.cause ("start" | "next" | "previous" | ...), event.snapshot
    case "completed":    // event.pathId, event.data
    case "cancelled":    // event.pathId, event.data
    case "resumed":      // event.resumedPathId, event.fromSubPathId, event.snapshot
  }
});
```

Every `stateChanged` event includes a `cause` field (`StateChangeCause`) identifying which public method triggered it. Use this to react to specific operations — for example, the `store-http` package uses `event.cause === "next"` to implement the `onNext` persistence strategy.

## State Persistence

The engine supports exporting and restoring state for persistence scenarios (e.g., saving wizard progress to a server or localStorage).

### exportState()

Returns a plain JSON-serializable object (`SerializedPathState`) containing the current state:
- Current path ID and step index
- Path data
- Visited step IDs
- Sub-path stack (if nested paths are active)
- Navigation flags

Returns `null` if no path is active.

```typescript
const state = engine.exportState();
if (state) {
  const json = JSON.stringify(state);
  // Save to localStorage, send to server, etc.
}
```

### PathEngine.fromState()

Restores a PathEngine from previously exported state. **Important:** You must provide the same path definitions that were active when the state was exported.

```typescript
const state = JSON.parse(savedJson);
const engine = PathEngine.fromState(state, {
  "main-path": mainPathDefinition,
  "sub-path": subPathDefinition
});

// Engine is restored to the exact step and state
const snapshot = engine.snapshot();
```

Throws if:
- State references a path ID not in `pathDefinitions`
- State version is unsupported

The restored engine is fully functional — you can continue navigation, modify data, complete or cancel paths normally.
```
