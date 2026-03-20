# Pathwrite

A headless, framework-agnostic path engine for the web, with first-class Angular, React, and Vue adapters — plus optional default UI shell components for rapid prototyping.

## Packages

| Package | Description |
|---------|-------------|
| [`@daltonr/pathwrite-core`](packages/core) | Deterministic path state machine with stack-based sub-path orchestration. Zero dependencies, no UI framework required. |
| [`@daltonr/pathwrite-angular`](packages/angular-adapter) | Angular `@Injectable` facade over the core engine. Exposes state and events as RxJS observables; integrates with signals via `toSignal`. Includes optional `<pw-shell>` component. |
| [`@daltonr/pathwrite-react`](packages/react-adapter) | React hooks over the core engine. Exposes state via `useSyncExternalStore` with stable action callbacks, an optional context provider, and an optional `<PathShell>` component. |
| [`@daltonr/pathwrite-vue`](packages/vue-adapter) | Vue 3 composable over the core engine. Exposes state as a reactive `shallowRef` with automatic cleanup via `onScopeDispose`. Includes optional `<PathShell>` component. |

## Apps

| App | Description |
|-----|-------------|
| [`demo-console`](apps/demo-console) | Node script showing parent path + sub-path resume in a terminal. |
| [`demo-angular`](apps/demo-angular) | Minimal Angular host rendering path state and events. |
| [`demo-angular-course`](apps/demo-angular-course) | Full Angular course-path demo with a subject-entry sub-path. |
| [`demo-angular-shell`](apps/demo-angular-shell) | Angular demo using the `<pw-shell>` default UI — same wizard, zero boilerplate. |
| [`demo-lifecycle`](apps/demo-lifecycle) | Backend document lifecycle (Draft → Review → Approved → Published) with guards, sub-paths, and conditional skipping — no UI. |

## Design principles

- **Headless first** — the core engine has no DOM or framework dependency; UI is entirely the host's responsibility. Default shell components are an optional convenience layer, not a requirement.
- **Immutable context** — lifecycle hooks receive a snapshot copy of `data` and return a patch object; they cannot mutate internal state directly.
- **Type-safe data** — `PathDefinition<TData>`, `PathStepContext<TData>`, and `PathSnapshot<TData>` are all generic; define your data shape once and get full inference through every hook and guard.
- **Stack-based sub-paths** — calling `startSubPath()` pushes the current path onto a stack; completion or cancellation automatically restores the parent.
- **Observable + signal friendly** — the Angular adapter exposes `state$` and `events$` as `Observable`, compatible with both the `async` pipe and `toSignal`.
- **Hook friendly** — the React adapter uses `useSyncExternalStore` for tear-free reads and provides referentially stable action callbacks.
- **Composable friendly** — the Vue adapter uses `shallowRef` + `onScopeDispose` for clean, idiomatic Vue 3 integration.
- **Batteries included, removable** — each adapter ships optional default UI shell components (`<PathShell>` / `<pw-shell>`) that render progress indicators, step content, and navigation buttons. Use them to get started quickly; replace them with custom UI whenever you need full control.

## Quick start

```bash
npm install
npm test
npm run demo                 # console demo
npm run demo:lifecycle       # lifecycle state-machine demo (no UI)
npm run demo:angular         # Angular demo (localhost:4200)
npm run demo:angular:course  # course path demo (localhost:4200)
npm run demo:angular:shell   # shell UI demo (localhost:4200)
```

## Default UI shell

Every adapter includes an optional shell component that renders a complete wizard UI — progress indicator, step content area, and navigation buttons — out of the box. You define only the step content; the shell handles the chrome.

### React

```tsx
import { PathShell } from "@daltonr/pathwrite-react";

<PathShell
  path={myPath}
  initialData={{ name: "" }}
  onComplete={handleDone}
  steps={{
    details: <DetailsForm />,
    review: <ReviewPanel />,
  }}
/>
```

### Vue

```vue
<script setup>
import { PathShell } from "@daltonr/pathwrite-vue";
</script>

<template>
  <PathShell :path="myPath" :initial-data="{ name: '' }" @complete="handleDone">
    <template #details><DetailsForm /></template>
    <template #review><ReviewPanel /></template>
  </PathShell>
</template>
```

### Angular

```html
<!-- Import PathShellComponent and PathStepDirective from @daltonr/pathwrite-angular/shell -->
<pw-shell [path]="myPath" [initialData]="{ name: '' }" (completed)="onDone($event)">
  <ng-template pwStep="details"><app-details-form /></ng-template>
  <ng-template pwStep="review"><app-review-panel /></ng-template>
</pw-shell>
```

### Styling

Import the optional stylesheet for sensible defaults. All visual values are CSS custom properties (`--pw-*`), so you can theme without overriding selectors:

```css
@import "@daltonr/pathwrite-shell.css";

:root {
  --pw-color-primary: #8b5cf6;
  --pw-shell-radius: 12px;
}
```

See the [Developer Guide](DEVELOPER_GUIDE.md) for the full list of shell props, slots, and CSS variables.

## Test coverage

235 tests across six test files:

| Suite | Tests |
|-------|-------|
| `PathEngine` — navigation | 8 |
| `PathEngine` — snapshot | 9 |
| `PathEngine` — snapshot canMoveNext / canMovePrevious | 7 |
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
| `PathShell` (React) — rendering | 7 |
| `PathShell` (React) — navigation | 6 |
| `PathShell` (React) — custom labels | 2 |
| `PathShell` (React) — progress | 3 |
| `PathShell` (React) — render props | 2 |
| `PathShell` (React) — autoStart false | 2 |
| `PathShell` (React) — context sharing | 2 |
| `usePath` (React) — snapshot | 8 |
| `usePath` (React) — events | 5 |
| `usePath` (React) — navigation | 5 |
| `usePath` (React) — sub-path | 2 |
| `usePath` (React) — goToStep | 2 |
| `PathProvider + usePathContext` | 4 |
| `usePath` (React) — cleanup | 1 |
| `PathShell` (Vue) — rendering | 7 |
| `PathShell` (Vue) — navigation | 6 |
| `PathShell` (Vue) — custom labels | 2 |
| `PathShell` (Vue) — progress | 3 |
| `PathShell` (Vue) — autoStart false | 2 |
| `PathShell` (Vue) — context sharing | 2 |
| `usePath` (Vue) — snapshot | 8 |
| `usePath` (Vue) — events | 4 |
| `usePath` (Vue) — navigation | 4 |
| `usePath` (Vue) — sub-path | 2 |
| `usePath` (Vue) — goToStep | 1 |
| `usePath` (Vue) — scope disposal | 2 |
