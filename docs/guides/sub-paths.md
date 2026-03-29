# Sub-Paths

A sub-path is a full `PathDefinition` pushed on top of an existing active path. The parent path is paused until the sub-path completes or is cancelled. Sub-paths can themselves launch sub-paths — nesting is unlimited.

---

## What sub-paths are and when to use them

Use sub-paths when a step in your main flow needs to collect data through its own multi-step sequence before returning to the parent. Common examples:

- A course wizard where each subject is set up through a 3-step sub-flow
- An approval workflow where each reviewer goes through assign → feedback → decision
- An onboarding path that branches into a detailed configuration flow for a specific option

The key distinction from just adding steps to the main path is that sub-path data is scoped to the sub-path, and the parent step decides what (if anything) to merge back when the sub-path finishes.

---

## `startSubPath()` — pushing a sub-path

Call `startSubPath()` on the engine or facade to push a sub-path:

```typescript
engine.startSubPath(subPathDefinition, initialData?, meta?)
```

| Argument | Description |
|---|---|
| `subPathDefinition` | A `PathDefinition` — any valid path definition. |
| `initialData` | Optional initial data for the sub-path. Defaults to `{}`. |
| `meta` | Optional correlation object. Returned unchanged to `onSubPathComplete` and `onSubPathCancel`. |

```typescript
// Push a subject-creation sub-path with empty initial data
engine.startSubPath(subjectSubPath, { subjectName: "", subjectTeacher: "" });

// Push with a meta object to correlate results back to a collection index
engine.startSubPath(approvalSubPath, { approverName: approvers[i].name }, { index: i });
```

`startSubPath()` requires an active path. If called with no path running, it throws.

---

## Sub-path lifecycle

```
engine.start(mainPath)              stack: []          active: main
engine.startSubPath(subPath)        stack: [main]      active: sub
  engine.next()  // sub completes
  onSubPathComplete fires on parent step
                                    stack: []          active: main (restored)

engine.startSubPath(subPath)        stack: [main]      active: sub
  engine.cancel()  // sub cancelled
  onSubPathCancel fires on parent step (if defined)
                                    stack: []          active: main (restored)
```

When the sub-path completes, the parent path is restored exactly where it was paused. The engine emits a `resumed` event, then emits `stateChanged` for the parent's restored state.

### Entering and resuming

The engine transitions through these states when a sub-path completes:

1. Sub-path's last step calls `next()` — sub-path completes.
2. `onSubPathComplete` fires on the parent step. Its return value is merged into the parent path's data.
3. Parent path is restored (stack popped).
4. Engine emits `resumed` event, then `stateChanged`.

### Cancelling

A sub-path is cancelled in two ways:

- Calling `engine.cancel()` while the sub-path is active.
- Calling `engine.previous()` when on the sub-path's first step.

In both cases, `onSubPathCancel` fires on the parent step (if defined), the parent is restored, and `stateChanged` is emitted. Neither `cancelled` nor `resumed` events are emitted for sub-path cancellation — only for top-level path cancellation.

---

## `onSubPathComplete` hook

Define `onSubPathComplete` on the parent step that launches the sub-path. It is called when the sub-path completes naturally (not when cancelled). The hook can return a partial data patch to merge into the parent path's data.

```typescript
interface PathStep<TData> {
  onSubPathComplete?: (
    subPathId:   string,
    subPathData: PathData,
    ctx:         PathStepContext<TData>,
    meta?:       Record<string, unknown>
  ) => Partial<TData> | void | Promise<Partial<TData> | void>;
}
```

```typescript
{
  id: "subjects-list",
  onSubPathComplete: (subPathId, subData, ctx, meta) => {
    return {
      subjects: [
        ...ctx.data.subjects,
        { name: subData.subjectName, teacher: subData.subjectTeacher }
      ]
    };
  }
}
```

The return value is merged (shallow patch) into the parent path's data. Return `undefined` or `void` to leave data unchanged.

---

## `onSubPathCancel` hook

Define `onSubPathCancel` on the parent step to react when a sub-path is cancelled. It receives the same four arguments as `onSubPathComplete`. Use it to record a "skipped" or "declined" outcome.

```typescript
{
  id: "run-approvals",
  onSubPathComplete: (subPathId, subData, ctx, meta) => ({
    approvals: [...ctx.data.approvals, { index: meta?.index, result: subData.decision }]
  }),
  onSubPathCancel: (subPathId, subData, ctx, meta) => ({
    approvals: [...ctx.data.approvals, { index: meta?.index, result: "skipped" }]
  })
}
```

If `onSubPathCancel` is not defined, cancelling a sub-path simply restores the parent's state unchanged.

---

## Data merging patterns

The parent path and sub-path each have their own independent `data` objects. Data does not flow automatically between them. Merge happens explicitly in `onSubPathComplete` (or `onSubPathCancel`) by reading `subPathData` and returning a patch for the parent.

### Collecting sub-path results into an array

```typescript
onSubPathComplete: (subPathId, subData, ctx) => ({
  subjects: [...ctx.data.subjects, {
    name:    subData.subjectName,
    teacher: subData.subjectTeacher
  }]
})
```

### Using the meta object for collection correlation

Pass a `meta` object as the third argument to `startSubPath()`. It is returned unchanged as the fourth argument of both hooks, letting you identify which collection item triggered the sub-path without polluting the sub-path's own data:

```typescript
// Launch one sub-path per approver, carrying the index as meta
for (let i = 0; i < approvers.length; i++) {
  engine.startSubPath(approvalSubPath, { approverName: approvers[i].name }, { index: i });
}

// In the parent step:
onSubPathComplete: (subPathId, subData, ctx, meta) => {
  const approvals = [...(ctx.data.approvals as unknown[])];
  approvals[meta!.index as number] = subData.decision;
  return { approvals };
},
onSubPathCancel: (subPathId, subData, ctx, meta) => {
  const approvals = [...(ctx.data.approvals as unknown[])];
  approvals[meta!.index as number] = "skipped";
  return { approvals };
}
```

---

## Progress bar behaviour during sub-paths

When a sub-path is running, the snapshot reflects the sub-path's steps. The main progress bar switches to show the sub-path's step list and `snapshot.nestingLevel` increments by 1 per nesting level.

The root (top-level) progress bar remains visible above the sub-path's own bar so users never lose sight of where they are in the overall flow. All four shells (React, Vue, Angular, Svelte) render this compact bar automatically whenever `nestingLevel > 0`.

### `nestingLevel`

`snapshot.nestingLevel` is `0` for the top-level path and increases by 1 for each nested sub-path. Use it to conditionally show or hide UI elements that are only relevant at the top level.

### `rootProgress`

The snapshot exposes `rootProgress` when `nestingLevel > 0`:

```typescript
interface RootProgress {
  pathId:     string;
  stepIndex:  number;
  stepCount:  number;
  progress:   number;       // 0.0 → 1.0
  steps:      StepSummary[];
}

// Available when nestingLevel > 0
snapshot.rootProgress   // RootProgress | undefined
```

`rootProgress` always reflects the root (bottom of the stack) path, even when deeply nested. Use it in a custom header to render your own persistent top-level indicator.

### `progressLayout` prop

All shells accept a `progressLayout` prop controlling how the root bar and sub-path bar are arranged:

| Value | Behaviour |
|---|---|
| `"merged"` | Root and sub-path bars in one card (default) |
| `"split"` | Root and sub-path bars as separate cards |
| `"rootOnly"` | Only the root bar — sub-path bar hidden |
| `"activeOnly"` | Only the active (sub-path) bar — root bar hidden (pre-v0.7 behaviour) |

```tsx
// React
<PathShell path={myPath} progressLayout="split" steps={...} />

// Vue
<PathShell :path="myPath" progress-layout="rootOnly" />

// Angular
<pw-shell [path]="myPath" progressLayout="activeOnly">...</pw-shell>

// Svelte
<PathShell path={myPath} progressLayout="split" />
```

---

## The `onSubPathCompleteAction` pattern for auto-advancing

A common pattern is to advance the parent path automatically after every sub-path completes, without requiring the user to click "Next" on the parent step again. Implement this by calling `engine.next()` inside `onSubPathComplete`:

```typescript
{
  id: "run-approvals",
  onSubPathComplete: async (subPathId, subData, ctx, meta) => {
    // Merge the result
    const approvals = [...(ctx.data.approvals as unknown[])];
    approvals[meta!.index as number] = subData.decision;

    // Auto-advance the parent if all approvals are collected
    if (approvals.every(Boolean)) {
      await engine.next();
    }

    return { approvals };
  }
}
```

This is particularly useful when a parent step loops over a collection and launches a sub-path per item — once all items are processed, the parent advances automatically.

---

## Back on the first step of a sub-path

Calling `previous()` (or clicking Back in the shell) when on the first step of a sub-path cancels the sub-path and returns to the parent. `onSubPathCancel` is called if defined. `onSubPathComplete` is not called.

---

## Step ID collisions

There is no automatic namespacing of step IDs across a main path and its sub-paths. If a main path step and a sub-path step share the same ID, the shell will match both templates and may render both simultaneously.

Avoid this by:
- Using path-qualified IDs (`main-summary`, `approval-summary`), or
- Checking both `pathId` and `stepId` when conditionally rendering in headless UI:

```typescript
if (snapshot.pathId === "main-path" && snapshot.stepId === "summary") { ... }
```

The default shell components match templates by `stepId` alone, so unique step IDs across all paths used within a single shell are required.

### Angular — sub-path step templates

Because `<pw-shell>` owns a single `PathFacade` instance, all step templates for both the main path and any sub-paths must be declared inside the same `<pw-shell>`:

```html
<pw-shell [path]="mainPath">
  <!-- main path steps -->
  <ng-template pwStep="add-approvers">...</ng-template>
  <ng-template pwStep="summary">...</ng-template>

  <!-- sub-path steps — must also live here -->
  <ng-template pwStep="review-document">...</ng-template>
  <ng-template pwStep="make-decision">...</ng-template>
</pw-shell>
```
