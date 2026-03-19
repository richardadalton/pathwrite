# demo-angular-course

Angular app demonstrating a 3-step **Course Wizard** with a nested **Subject Entry Sub-wizard**, built with `@pathwrite/core` and `@pathwrite/angular-adapter`.

## What it demonstrates

- `WizardFacade` provided at the component level for isolated, auto-cleaned-up wizard state.
- `toSignal(facade.state$)` for a reactive snapshot signal consumed directly in the template.
- `computed()` to derive the subjects list from the snapshot signal — no imperative getters.
- `takeUntilDestroyed()` for the event log subscription.
- `onResumeFromSubWizard` returning a patch object to merge sub-wizard results into parent args.

## Wizard flow

### Main wizard: `course-wizard`

| Step | ID | Guard |
|------|----|-------|
| 1 | `course-details` | Course name must be non-empty |
| 2 | `subjects-list` | At least one subject must have been added |
| 3 | `review` | None — Next completes the wizard |

### Sub-wizard: `subject-subwizard`

Launched from **Step 2** via the *Add Subject* button.

| Step | ID | Guard |
|------|----|-------|
| 1 | `subject-entry` | Subject name and teacher must both be non-empty |

When the sub-wizard completes, `onResumeFromSubWizard` on `subjects-list` **returns a patch**:

```typescript
onResumeFromSubWizard: (_id, subArgs, ctx) => ({
  subjects: [...getSubjects(ctx), { name: subArgs.subjectName, teacher: subArgs.subjectTeacher }]
})
```

Cancelling the sub-wizard discards the entry and returns to `subjects-list` unchanged.

## Navigation

| Button | Behaviour |
|--------|-----------|
| **Start Course Wizard** | Resets state and begins the wizard |
| **Previous** | Moves back one step (disabled when no wizard is active) |
| **Next** | Advances if the guard passes; completes the wizard on the last step |
| **Cancel** | Cancels the active wizard or sub-wizard and clears state |

## Event log

Every `WizardEngineEvent` from `facade.events$` is prepended to an on-screen log (max 20 entries):

- `stateChanged → <wizardId>/<stepId>`
- `resumed → <resumedWizardId> from <subWizardId>`
- `completed → <wizardId>`
- `cancelled → <wizardId>`

## Run

```bash
npm run demo:angular:course
```

Or directly:

```bash
npm run -w @pathwrite/demo-angular-course start
```

## Build

```bash
npm run -w @pathwrite/demo-angular-course build
```
