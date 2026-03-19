# Pathwrite

A headless, framework-agnostic wizard engine for the web, with first-class Angular and React adapters.

## Packages

| Package | Description |
|---------|-------------|
| [`@pathwrite/core`](packages/core) | Deterministic wizard state machine with stack-based sub-wizard orchestration. Zero dependencies, no UI framework required. |
| [`@pathwrite/angular-adapter`](packages/angular-adapter) | Angular `@Injectable` facade over the core engine. Exposes state and events as RxJS observables; integrates with signals via `toSignal`. |
| [`@pathwrite/react-adapter`](packages/react-adapter) | React hooks over the core engine. Exposes state via `useSyncExternalStore` with stable action callbacks and an optional context provider. |

## Apps

| App | Description |
|-----|-------------|
| [`demo-console`](apps/demo-console) | Node script showing parent wizard + sub-wizard resume in a terminal. |
| [`demo-angular`](apps/demo-angular) | Minimal Angular host rendering wizard state and events. |
| [`demo-angular-course`](apps/demo-angular-course) | Full Angular course-wizard demo with a subject-entry sub-wizard. |

## Design principles

- **Headless** — the core engine has no DOM or framework dependency; UI is entirely the host's responsibility.
- **Immutable context** — lifecycle hooks receive a snapshot copy of `args` and return a patch object; they cannot mutate internal state directly.
- **Type-safe args** — `WizardDefinition<TArgs>`, `WizardStepContext<TArgs>`, and `WizardSnapshot<TArgs>` are all generic; define your args shape once and get full inference through every hook and guard.
- **Stack-based sub-wizards** — calling `startSubWizard()` pushes the current wizard onto a stack; completion or cancellation automatically restores the parent.
- **Observable + signal friendly** — the Angular adapter exposes `state$` and `events$` as `Observable`, compatible with both the `async` pipe and `toSignal`.
- **Hook friendly** — the React adapter uses `useSyncExternalStore` for tear-free reads and provides referentially stable action callbacks.

## Quick start

```bash
npm install
npm test
npm run demo               # console demo
npm run demo:angular       # Angular demo (localhost:4200)
npm run demo:angular:course  # course wizard demo (localhost:4200)
```

## Test coverage

131 tests across three packages:

| Suite | Tests |
|-------|-------|
| `WizardEngine` — navigation | 8 |
| `WizardEngine` — snapshot | 8 |
| `WizardEngine` — setArg | 4 |
| `WizardEngine` — events | 8 |
| `WizardEngine` — lifecycle hooks | 11 |
| `WizardEngine` — sub-wizards | 5 |
| `WizardEngine` — subscriptions | 3 |
| `WizardEngine` — shouldSkip | 9 |
| `WizardEngine` — stepTitle | 3 |
| `WizardEngine` — goToStep | 9 |
| `WizardEngine` — stepMeta | 3 |
| `WizardEngine` — errors | 4 |
| `WizardFacade` — state$ | 8 |
| `WizardFacade` — snapshot() | 3 |
| `WizardFacade` — events$ | 5 |
| `WizardFacade` — navigation methods | 5 |
| `WizardFacade` — sub-wizard | 2 |
| `WizardFacade` — goToStep | 2 |
| `WizardFacade` — ngOnDestroy | 2 |
| `useWizard` — snapshot | 8 |
| `useWizard` — events | 5 |
| `useWizard` — navigation | 5 |
| `useWizard` — sub-wizard | 2 |
| `useWizard` — goToStep | 2 |
| `WizardProvider + useWizardContext` | 4 |
| `useWizard` — cleanup | 1 |
