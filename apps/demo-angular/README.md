# demo-angular

Minimal Angular app demonstrating `@pathwrite/angular-adapter`. Shows how to wire `PathFacade` into a standalone component using Angular DI and signals.

## What it demonstrates

- `PathFacade` provided at the component level (`providers: [PathFacade]`) so Angular manages its lifecycle.
- `toSignal(facade.state$)` converts the observable snapshot into a signal consumed directly in the template.
- `takeUntilDestroyed()` used for the event log subscription — no manual unsubscribe needed.
- A one-step sub-path launched from within the main path, resuming it on completion.

## Path flow

| Path | Steps |
|------|-------|
| `create-course` | `course-details` → `lesson-details` → `review` |
| `new-lesson` (sub) | `lesson-name` |

`new-lesson` sets a `lesson` data value via `onEnter`. On completion, `lesson-details` receives it via `onSubPathComplete` and merges it into the parent data.

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
