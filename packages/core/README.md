# @daltonr/pathwrite-core

Headless path engine with zero dependencies. Manages step navigation, navigation guards, lifecycle hooks, and stack-based sub-path orchestration. Works equally well driving a UI wizard or a backend document lifecycle — no framework required.

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
| `PathEvent` | Union of `stateChanged`, `completed`, `cancelled`, and `resumed`. |

## PathEngine API

```typescript
const engine = new PathEngine();

engine.start(definition, initialData?);    // start or re-start a path
engine.startSubPath(definition, data?);    // push sub-path onto the stack (requires active path)
engine.next();
engine.previous();
engine.cancel();
engine.setData(key, value);                // update a single data value; emits stateChanged
engine.goToStep(stepId);                   // jump to step by ID; bypasses guards and shouldSkip
engine.goToStepChecked(stepId);            // jump to step by ID; checks canMoveNext / canMovePrevious first
engine.snapshot();                         // returns PathSnapshot | null

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
| `canMoveNext` | Before advancing — return `false` to block | — |
| `canMovePrevious` | Before going back — return `false` to block | — |
| `validationMessages` | On every snapshot — return `string[]` explaining why the step is not yet valid | — |

### Snapshot guard booleans

The snapshot includes `canMoveNext` and `canMovePrevious` booleans — the evaluated results of the current step's guards. Use them to proactively disable navigation buttons. Sync guards reflect their real value; async guards default to `true` (optimistic). Both update automatically when data changes via `setData`.

### Example — sub-path result merged into parent data

```typescript
{
  id: "subjects-list",
  onSubPathComplete: (_id, subData, ctx) => ({
    subjects: [...(ctx.data.subjects ?? []), { name: subData.name, teacher: subData.teacher }]
  })
}
```

## Sub-path flow

```
engine.start(mainPath)          → stack: []         active: main
engine.startSubPath(subPath)    → stack: [main]     active: sub
engine.next()  // sub finishes
  → onSubPathComplete fires on the parent step
  → stack: []                                       active: main
```

Cancelling a sub-path pops it off the stack silently — `onSubPathComplete` is **not** called.

## Events

```typescript
engine.subscribe((event) => {
  switch (event.type) {
    case "stateChanged": // event.snapshot
    case "completed":    // event.pathId, event.data
    case "cancelled":    // event.pathId, event.data
    case "resumed":      // event.resumedPathId, event.fromSubPathId, event.snapshot
  }
});
```
