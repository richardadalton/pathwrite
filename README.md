# Pathwrite

A headless, framework-agnostic path engine for the web, with first-class Angular, React, and Vue adapters.

## Packages

| Package | Description |
|---------|-------------|
| [`@pathwrite/core`](packages/core) | Deterministic path state machine with stack-based sub-path orchestration. Zero dependencies, no UI framework required. |
| [`@pathwrite/angular-adapter`](packages/angular-adapter) | Angular `@Injectable` facade over the core engine. Exposes state and events as RxJS observables; integrates with signals via `toSignal`. |
| [`@pathwrite/react-adapter`](packages/react-adapter) | React hooks over the core engine. Exposes state via `useSyncExternalStore` with stable action callbacks and an optional context provider. |
| [`@pathwrite/vue-adapter`](packages/vue-adapter) | Vue 3 composable over the core engine. Exposes state as a reactive `shallowRef` with automatic cleanup via `onScopeDispose`. |

## Apps

| App | Description |
|-----|-------------|
| [`demo-console`](apps/demo-console) | Node script showing parent path + sub-path resume in a terminal. |
| [`demo-angular`](apps/demo-angular) | Minimal Angular host rendering path state and events. |
| [`demo-angular-course`](apps/demo-angular-course) | Full Angular course-path demo with a subject-entry sub-path. |
| [`demo-lifecycle`](apps/demo-lifecycle) | Backend document lifecycle (Draft → Review → Approved → Published) with guards, sub-paths, and conditional skipping — no UI. |

## Design principles

- **Headless** — the core engine has no DOM or framework dependency; UI is entirely the host's responsibility.
- **Immutable context** — lifecycle hooks receive a snapshot copy of `data` and return a patch object; they cannot mutate internal state directly.
- **Type-safe data** — `PathDefinition<TData>`, `PathStepContext<TData>`, and `PathSnapshot<TData>` are all generic; define your data shape once and get full inference through every hook and guard.
- **Stack-based sub-paths** — calling `startSubPath()` pushes the current path onto a stack; completion or cancellation automatically restores the parent.
- **Observable + signal friendly** — the Angular adapter exposes `state$` and `events$` as `Observable`, compatible with both the `async` pipe and `toSignal`.
- **Hook friendly** — the React adapter uses `useSyncExternalStore` for tear-free reads and provides referentially stable action callbacks.
- **Composable friendly** — the Vue adapter uses `shallowRef` + `onScopeDispose` for clean, idiomatic Vue 3 integration.

## Quick start

```bash
npm install
npm test
npm run demo                 # console demo
npm run demo:lifecycle       # lifecycle state-machine demo (no UI)
npm run demo:angular         # Angular demo (localhost:4200)
npm run demo:angular:course  # course path demo (localhost:4200)
```

## Test coverage

182 tests across four packages:

| Suite | Tests |
|-------|-------|
| `PathEngine` — navigation | 8 |
| `PathEngine` — snapshot | 9 |
| `PathEngine` — setData | 4 |
| `PathEngine` — events | 8 |
| `PathEngine` — lifecycle hooks | 13 |
| `PathEngine` — sub-paths | 5 |
| `PathEngine` — subscriptions | 3 |
| `PathEngine` — shouldSkip | 9 |
| `PathEngine` — stepTitle | 3 |
| `PathEngine` — goToStep | 9 |
| `PathEngine` — stepMeta | 3 |
| `PathEngine` — progress indicator | 8 |
| `PathEngine` — async hooks and guards | 11 |
| `PathEngine` — errors | 4 |
| `PathEngine` — lifecycle patterns | 10 |
| `PathFacade` — state$ | 8 |
| `PathFacade` — snapshot() | 3 |
| `PathFacade` — events$ | 5 |
| `PathFacade` — navigation methods | 5 |
| `PathFacade` — sub-path | 2 |
| `PathFacade` — goToStep | 2 |
| `PathFacade` — ngOnDestroy | 2 |
| `usePath` (React) — snapshot | 8 |
| `usePath` (React) — events | 5 |
| `usePath` (React) — navigation | 5 |
| `usePath` (React) — sub-path | 2 |
| `usePath` (React) — goToStep | 2 |
| `PathProvider + usePathContext` | 4 |
| `usePath` (React) — cleanup | 1 |
| `usePath` (Vue) — snapshot | 8 |
| `usePath` (Vue) — events | 4 |
| `usePath` (Vue) — navigation | 4 |
| `usePath` (Vue) — sub-path | 2 |
| `usePath` (Vue) — goToStep | 1 |
| `usePath` (Vue) — scope disposal | 2 |
