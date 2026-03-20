# demo-angular-course

Angular app demonstrating a 3-step **Course Path** with a nested **Subject Entry Sub-path**, built with `@daltonr/pathwrite-core` and `@daltonr/pathwrite-angular`.

## What it demonstrates

- `PathFacade` provided at the component level for isolated, auto-cleaned-up path state.
- `toSignal(facade.state$)` for a reactive snapshot signal consumed directly in the template.
- `computed()` to derive the subjects list from the snapshot signal — no imperative getters.
- `takeUntilDestroyed()` for the event log subscription.
- `onSubPathComplete` returning a patch object to merge sub-path results into parent data.

## Path flow

### Main path: `course-path`

| Step | ID | Guard |
|------|----|-------|
| 1 | `course-details` | Course name must be non-empty |
| 2 | `subjects-list` | At least one subject must have been added |
| 3 | `review` | None — Next completes the path |

### Sub-path: `subject-subpath`

Launched from **Step 2** via the *Add Subject* button.

| Step | ID | Guard |
|------|----|-------|
| 1 | `subject-entry` | Subject name and teacher must both be non-empty |

When the sub-path completes, `onSubPathComplete` on `subjects-list` **returns a patch**:

```typescript
onSubPathComplete: (_id, subData, ctx) => ({
  subjects: [...getSubjects(ctx), { name: subData.subjectName, teacher: subData.subjectTeacher }]
})
```

Cancelling the sub-path discards the entry and returns to `subjects-list` unchanged.

## Navigation

| Button | Behaviour |
|--------|-----------|
| **Start Course Path** | Resets state and begins the path |
| **Previous** | Moves back one step (disabled when no path is active) |
| **Next** | Advances if the guard passes; completes the path on the last step |
| **Cancel** | Cancels the active path or sub-path and clears state |

## Event log

Every `PathEvent` from `facade.events$` is prepended to an on-screen log (max 20 entries):

- `stateChanged → <pathId>/<stepId>`
- `resumed → <resumedPathId> from <subPathId>`
- `completed → <pathId>`
- `cancelled → <pathId>`

## Run

```bash
npm run demo:angular:course
```

Or directly:

```bash
npm run -w @daltonr/pathwrite-demo-angular-course start
```

## Build

```bash
npm run -w @daltonr/pathwrite-demo-angular-course build
```
