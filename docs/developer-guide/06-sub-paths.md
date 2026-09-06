# Chapter 6: Sub-paths

Multi-step wizards rarely follow a single straight line. Users need to add an item to a collection mid-flow, configure a setting through its own sequence of screens, or take a branch whose steps depend on their answers so far. A flat step array can handle some of this, but it quickly becomes an unmaintainable tangle of `shouldSkip` flags. Sub-paths give you a cleaner mechanism: push a complete, self-contained flow on top of the current one, let it run to completion, then resume exactly where you left off.

---

## What sub-paths are for

A sub-path is a full `PathDefinition` pushed onto a stack on top of the active path. While the sub-path is running, the parent path is paused — its step, its data, and its progress are all preserved. When the sub-path completes (or is cancelled), the stack pops and the parent resumes at precisely the step it was on.

Common use cases:

- **Collection building.** A wizard that lets the user add subjects, approvers, or line items one at a time, each through its own dedicated sub-flow.
- **Conditional deep-dives.** A parent step detects that the user chose "corporate account" and launches a 3-step company verification flow before continuing.
- **Reusable sequences.** A shared address-entry flow referenced from multiple parent paths without duplicating steps.

The key distinction from simply adding more steps is scoping: a sub-path has its own data object, its own progress bar, and its own completion lifecycle. The parent step controls what, if anything, is merged back when the sub-path finishes.

---

## The stack model

The engine maintains a path stack. Each time `startSubPath()` is called, the current path is pushed onto the stack and the new sub-path becomes the active path. Each time a sub-path completes or is cancelled, the top of the stack is popped and the parent becomes active again.

```
[ parent path: step 3 ]  ← paused here, waiting on the stack
[ sub-path: step 1 → 2 → 3 ]  ← active, engine navigates through this
```

Nesting is unlimited. A sub-path can itself launch a sub-path:

```
[ root path: step 2 ]
[ sub-path A: step 3 ]
[ sub-path B: step 1 ]  ← active
```

When sub-path B completes, sub-path A becomes active again. When sub-path A completes, the root path resumes.

---

## `startSubPath()`

```ts
engine.startSubPath(subPathDefinition, initialData?, meta?)
```

Call `startSubPath()` on the engine when you want to enter a nested flow. It requires an active path — calling it before `start()` throws. Call it from a **user action** — a button handler in the parent step's component, via the adapter context (`usePathContext().startSubPath` in React/Vue/Svelte/Solid, `facade.startSubPath` in Angular) — or, when driving the engine headlessly, after the parent step has settled (`snapshot.status === "idle"`).

> **Hooks cannot navigate.** `startSubPath()`, like every navigation method (`next`, `previous`, `goToStep`, `cancel`, …), only acts when the engine is idle. While a hook or guard is running the status is `"entering"`, `"validating"`, `"leaving"` or `"completing"`, so a `startSubPath()` call from inside `onEnter` — or a `next()` call from inside `onSubPathComplete` — is silently dropped. Hooks compute data; components (or your headless driver) decide when to move.

Here is a complete example. A course path has a "subjects" step whose component launches a 3-step subject-creation sub-path each time the user clicks "Add subject":

```ts
import { PathDefinition } from "@daltonr/pathwrite-core";

type CourseData = {
  courseName: string;
  subjects: { name: string; teacher: string }[];
};

// The sub-path runs 3 steps to collect a single subject's details.
const addSubjectPath: PathDefinition = {
  id: "add-subject",
  steps: [
    { id: "subject-name" },
    { id: "subject-teacher" },
    { id: "subject-review" },
  ],
};

const coursePath: PathDefinition<CourseData> = {
  id: "course",
  steps: [
    { id: "course-name" },
    {
      id: "subjects",
      // Merge each finished sub-path's data back into the parent.
      onSubPathComplete: (subPathId, subData, ctx) => ({
        subjects: [
          ...ctx.data.subjects,
          { name: subData.subjectName, teacher: subData.subjectTeacher },
        ],
      }),
    },
    { id: "review" },
  ],
};
```

```tsx
// The "subjects" step component (React shown; the other adapters are equivalent).
function SubjectsStep() {
  const { snapshot, startSubPath } = usePathContext<CourseData>();
  const subjects = snapshot?.data.subjects ?? [];

  return (
    <div>
      <ul>{subjects.map((s) => <li key={s.name}>{s.name} — {s.teacher}</li>)}</ul>
      <button
        type="button"
        onClick={() => startSubPath(addSubjectPath, { subjectName: "", subjectTeacher: "" })}
      >
        Add subject
      </button>
    </div>
  );
}
```

When the sub-path's last step calls `next()`, the sub-path completes, `onSubPathComplete` fires on the parent "subjects" step, and the parent path resumes on that same step — where the user can add another subject or press Next to continue. The `demo-*-subwizard` apps under `apps/` all follow this shape.

> **Angular:** Call `this.facade.startSubPath(...)` from a method bound to a template button. The `PathFacade` is available via `inject(PathFacade)` in the step component.

---

## `onSubPathComplete` and data merging

`onSubPathComplete` is a hook defined on the parent step. It fires after the sub-path's last step successfully calls `next()`. It receives four arguments:

| Argument | Type | Description |
|---|---|---|
| `subPathId` | `string` | The `id` of the completed sub-path definition |
| `subPathData` | `PathData` | The sub-path's data at the time of completion |
| `ctx` | `PathStepContext` | The parent step's context, including `ctx.data` |
| `meta` | `Record<string, unknown> \| undefined` | The correlation object passed to `startSubPath()` |

The return value is a shallow patch merged into the parent path's data. Return `undefined` or `void` to leave the parent's data unchanged.

**Spreading results into an array** is the most common pattern:

```ts
onSubPathComplete: (subPathId, subData, ctx) => ({
  subjects: [
    ...ctx.data.subjects,
    { name: subData.subjectName, teacher: subData.subjectTeacher },
  ],
}),
```

**Updating a single field** works the same way:

```ts
onSubPathComplete: (_subPathId, subData, _ctx) => ({
  selectedAddress: subData.addressId,
}),
```

---

## `onSubPathCancel`

A sub-path can be cancelled in two ways: an explicit `engine.cancel()` call, or the user pressing Back on the sub-path's first step (which treats it as an implicit cancel). In either case, `onSubPathCancel` fires on the parent step if it is defined.

`onSubPathCancel` has the same signature as `onSubPathComplete`. Its return value is a data patch for the parent. If it is not defined, cancelling a sub-path simply restores the parent's state with no data changes.

The approval workflow pattern shows both hooks together:

```ts
{
  id: "run-approvals",
  onSubPathComplete: (subPathId, subData, ctx, meta) => ({
    approvals: [
      ...ctx.data.approvals,
      { index: meta?.index, result: subData.decision },
    ],
  }),
  onSubPathCancel: (subPathId, subData, ctx, meta) => ({
    approvals: [
      ...ctx.data.approvals,
      { index: meta?.index, result: "skipped" },
    ],
  }),
}
```

Graceful cancel handling is important when the sub-path is optional. If the user declines to go through the sub-flow, `onSubPathCancel` lets you record a `"skipped"` or `"declined"` outcome rather than leaving a gap in the data.

---

## The `meta` object

`startSubPath()` accepts an optional third argument — the `meta` object. It is a plain `Record<string, unknown>` that the engine stores alongside the parent step and passes back unchanged as the fourth argument of both `onSubPathComplete` and `onSubPathCancel`.

Use `meta` to correlate a sub-path launch with its triggering context without polluting the sub-path's own data. The canonical example is a collection index:

```ts
// In the parent step's component: launch one approval sub-path for the
// reviewer the user picked (one at a time — each returns to this step).
onClick={() =>
  startSubPath(
    approvalSubPath,
    { reviewerName: reviewers[i].name },
    { index: i }  // ← meta: which reviewer this is
  )
}

// In the parent step definition:
onSubPathComplete: (subPathId, subData, ctx, meta) => {
  const approvals = [...ctx.data.approvals];
  approvals[meta!.index as number] = subData.decision;
  return { approvals };
},
```

The sub-path itself knows nothing about its position in the collection. The parent step uses `meta.index` to place the result correctly.

---

## Advancing after sub-path completion

When a sub-path finishes, the parent step is the active step again. The engine stays there — it never advances on its own — so the parent step can offer another sub-path, show what was collected, or wait for the user to press Next.

Do **not** try to advance from inside `onSubPathComplete`. The hook runs while the engine's status is `"completing"`, and `next()` (like every navigation method) is a silent no-op unless the engine is idle — the call is dropped and the patch you return is still applied, so nothing visibly breaks, but the parent never moves. The hook's job is to return the merged data; the decision to move on belongs to the user.

The idiomatic pattern is to let the parent step's `canMoveNext` guard express "all collected", and let the user click Next once it is satisfied:

```ts
{
  id: "run-approvals",
  onSubPathComplete: (subPathId, subData, ctx, meta) => {
    const approvals = [...ctx.data.approvals];
    approvals[meta!.index as number] = subData.decision;
    return { approvals };
  },
  // Next stays disabled until every reviewer has a decision.
  canMoveNext: ({ data }) => ({
    allowed: data.approvals.every((a) => a !== undefined),
    reason: "Collect every reviewer's decision before continuing.",
  }),
}
```

If you genuinely want to move on without a click, do it from outside the hook, once the engine has settled: the parent's resumption is signalled by the `resumed` event (whose `snapshot` already carries the merged data), so an `onEvent` handler on `usePath` / an `engine.subscribe()` listener can inspect it and call `next()` then.

---

## Progress bar behaviour

While a sub-path is active, the snapshot reflects the sub-path's steps: `snapshot.steps` lists the sub-path's steps, `snapshot.stepIndex` is the sub-path's current position, and `snapshot.progress` is the sub-path's progress from 0 to 1.

Two additional fields describe the nesting context:

**`snapshot.nestingLevel`** is `0` for the top-level path and increases by 1 for each nesting level. Check it to conditionally show UI elements that are only relevant at the root:

```tsx
{snapshot.nestingLevel === 0 && <GlobalNav />}
```

**`snapshot.rootProgress`** is present when `nestingLevel > 0`. It exposes the root path's progress so you can render a persistent top-level indicator while the sub-path runs:

```ts
interface RootProgress {
  pathId:    string;
  stepIndex: number;
  stepCount: number;
  progress:  number;   // 0.0 → 1.0
  steps:     StepSummary[];
}

// Available when nestingLevel > 0
snapshot.rootProgress?.progress  // root path's overall progress
```

The `PathShell` component in all adapters handles the dual-bar display automatically. Use the `progressLayout` prop to control how the root bar and sub-path bar are arranged:

| Value | Behaviour |
|---|---|
| `"merged"` | Root and sub-path bars in one card (default) |
| `"split"` | Root and sub-path bars as separate cards |
| `"rootOnly"` | Only the root bar — sub-path bar hidden |
| `"activeOnly"` | Only the active (sub-path) bar — root bar hidden |

```tsx
// React
<PathShell path={myPath} progressLayout="split" steps={...} />
```

> **Angular:** `<pw-shell [path]="myPath" progressLayout="activeOnly">`. All four values are supported across all adapters.

---

## Step ID collisions

There is no automatic namespacing of step IDs across parent and sub-paths. If a parent step and a sub-path step share the same ID, the shell matches both templates and may render them simultaneously.

Prevent this by qualifying IDs with the path name:

```ts
// Parent path uses "course-review", sub-path uses "subject-review"
// — never just "review" in both.
```

If you are building headless and dispatching on step ID manually, check both `snapshot.pathId` and `snapshot.stepId` to distinguish them:

```ts
if (snapshot.pathId === "course" && snapshot.stepId === "review") {
  // render course review
}
```

> **Angular:** All step templates for both the parent path and any sub-paths must be declared inside the same `<pw-shell>`, since the shell owns a single `PathFacade`. Name them distinctly to avoid double-rendering.

---

Sub-paths, like the main path, carry typed data. Chapter 7 covers how to type that data — and the rest of your path — with TypeScript.

© 2026 Devjoy Ltd. MIT License.
