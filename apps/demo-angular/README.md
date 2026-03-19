# demo-angular

Minimal Angular app demonstrating `@pathwrite/angular-adapter`. Shows how to wire `WizardFacade` into a standalone component using Angular DI and signals.

## What it demonstrates

- `WizardFacade` provided at the component level (`providers: [WizardFacade]`) so Angular manages its lifecycle.
- `toSignal(facade.state$)` converts the observable snapshot into a signal consumed directly in the template.
- `takeUntilDestroyed()` used for the event log subscription — no manual unsubscribe needed.
- A one-step sub-wizard launched from within the main wizard, resuming it on completion.

## Wizard flow

| Wizard | Steps |
|--------|-------|
| `create-course` | `course-details` → `lesson-details` → `review` |
| `new-lesson` (sub) | `lesson-name` |

`new-lesson` sets a `lesson` arg via `onVisit`. On completion, `lesson-details` receives it via `onResumeFromSubWizard` and merges it into the parent args.

## Run

```bash
npm run demo:angular
```

Or directly:

```bash
npm run -w @pathwrite/demo-angular start
```

## Build

```bash
npm run -w @pathwrite/demo-angular build
```
