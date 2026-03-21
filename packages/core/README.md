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
engine.restart(definition, initialData?);  // tear down stack and start fresh (no hooks, no cancelled event)
engine.startSubPath(definition, data?);    // push sub-path onto the stack (requires active path)
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
| `canMoveNext` | Before advancing — return `false` to block | — |
| `canMovePrevious` | Before going back — return `false` to block | — |
| `validationMessages` | On every snapshot — return `string[]` explaining why the step is not yet valid | — |

### Snapshot guard booleans

The snapshot includes `canMoveNext` and `canMovePrevious` booleans — the evaluated results of the current step's guards. Use them to proactively disable navigation buttons. Sync guards reflect their real value; async guards default to `true` (optimistic). Both update automatically when data changes via `setData`.

> **Guards run before `onEnter` on first entry.** The engine emits a snapshot to signal
> navigation has started before calling `onEnter` on the arriving step. At that point
> `data` still reflects `initialData` — fields your `onEnter` would set are not yet
> present. Write guards defensively:
>
> ```typescript
> // ❌ Throws on first snapshot when initialData = {}
> canMoveNext: (ctx) => ctx.data.name.trim().length > 0
>
> // ✅ Safe
> canMoveNext: (ctx) => (ctx.data.name as string ?? "").trim().length > 0
> ```
>
> If a guard or `validationMessages` hook throws, Pathwrite catches the error, emits a
> `console.warn` (with the step ID and thrown value), and returns the safe default
> (`true` / `[]`) so the UI remains operable.

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
