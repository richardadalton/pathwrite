# Pathwrite

A headless, framework-agnostic path engine for the web and mobile, with first-class adapters for Angular, React, Vue, Svelte, and React Native — plus optional default UI shell components for rapid prototyping.

## Documentation

| | |
|---|---|
| [Getting started](docs/getting-started/installation.md) | Installation, core concepts, your first path |
| [Developer Guide](docs/developer-guide/README.md) | 11-chapter narrative guide from engine model to testing |
| [Core API reference](docs/reference/core-api.md) | Full `PathEngine`, `PathSnapshot`, and `PathStore` API |
| [Shell CSS reference](docs/reference/shell-css.md) | CSS custom properties for theming `PathShell` |
| [Contributing](docs/contributing/development-setup.md) | Build, test, run demos |

## Packages

| Package | Description |
|---|---|
| [`@daltonr/pathwrite-core`](packages/core) | Zero-dependency path state machine. Manages navigation, guards, hooks, sub-path stacking, and persistence observers. |
| [`@daltonr/pathwrite-react`](packages/react-adapter) | `usePath()` hook and `PathShell` component. Uses `useSyncExternalStore` for tear-free reads. |
| [`@daltonr/pathwrite-vue`](packages/vue-adapter) | `usePath()` composable and `PathShell` component. State as `shallowRef` with `onScopeDispose` cleanup. |
| [`@daltonr/pathwrite-angular`](packages/angular-adapter) | `PathFacade` injectable and `<pw-shell>` component. State as `Observable` and Signal. |
| [`@daltonr/pathwrite-svelte`](packages/svelte-adapter) | `usePath()` with Svelte 5 runes and `PathShell` snippets. |
| [`@daltonr/pathwrite-react-native`](packages/react-native-adapter) | `usePath()` hook and `PathShell` component for Expo and bare React Native. |
| [`@daltonr/pathwrite-store-http`](packages/store-http) | `HttpStore` and `LocalStorageStore` persistence backends with `httpPersistence` observer and `restoreOrStart`. |

## Demo apps

Each framework has a set of focused demos. Run any of them from the repo root:

```bash
# React
npm run demo:react:form        # single-step form
npm run demo:react:wizard      # multi-step wizard with validation
npm run demo:react:subwizard   # nested sub-path
npm run demo:react:skip        # conditional step skipping
npm run demo:react:stepchoice  # StepChoice — conditional form variants
npm run demo:react:storage     # persistence with LocalStorageStore / HttpStore

# Vue
npm run demo:vue:form
npm run demo:vue:wizard
npm run demo:vue:subwizard
npm run demo:vue:skip
npm run demo:vue:course        # sub-path collection (add multiple subjects)
npm run demo:vue:stepchoice
npm run demo:vue:storage

# Angular
npm run demo:angular:form
npm run demo:angular:wizard
npm run demo:angular:subwizard
npm run demo:angular:skip
npm run demo:angular:stepchoice
npm run demo:angular:storage

# Svelte
npm run demo:svelte:form
npm run demo:svelte:wizard
npm run demo:svelte:subwizard
npm run demo:svelte:skip
npm run demo:svelte:stepchoice
npm run demo:svelte:storage

# React Native (Expo)
npm run demo:rn
```

## Quick start

```bash
npm install
npm test
```

## Default UI shell

Every adapter includes an optional shell component that renders a complete wizard UI — progress indicator, step content, and navigation buttons — with no boilerplate. You provide only the step content.

### React

```tsx
import { PathShell } from "@daltonr/pathwrite-react";
import "@daltonr/pathwrite-react/styles.css";

<PathShell
  path={myPath}
  initialData={{ name: "" }}
  onComplete={handleDone}
  steps={{
    details: <DetailsForm />,
    review:  <ReviewPanel />,
  }}
/>
```

### Vue

```vue
<script setup>
import { PathShell } from "@daltonr/pathwrite-vue";
import "@daltonr/pathwrite-vue/styles.css";
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
<pw-shell [path]="myPath" [initialData]="{ name: '' }" (complete)="onDone($event)">
  <ng-template pwStep="details"><app-details-form /></ng-template>
  <ng-template pwStep="review"><app-review-panel /></ng-template>
</pw-shell>
```

### Svelte

```svelte
<script>
  import { PathShell } from "@daltonr/pathwrite-svelte";
  import "@daltonr/pathwrite-svelte/styles.css";
</script>

<PathShell {path} initialData={{ name: "" }} oncomplete={handleDone}>
  {#snippet details()}<DetailsForm />{/snippet}
  {#snippet review()}<ReviewPanel />{/snippet}
</PathShell>
```

All visual values are CSS custom properties. Override any of them without selector battles:

```css
:root {
  --pw-color-primary: #8b5cf6;
  --pw-shell-radius: 12px;
}
```

See the [Shell CSS reference](docs/reference/shell-css.md) for the full property list.

## Design principles

- **Headless first** — `@daltonr/pathwrite-core` has zero runtime dependencies and no DOM or framework coupling. It runs identically in a browser, Node.js, a test runner, or React Native.
- **Pure-data definitions** — `PathDefinition` is a plain TypeScript object. It can be extracted into a versioned npm package and shared across a web app, mobile app, and backend worker simultaneously.
- **Immutable snapshots** — every engine action produces a new `PathSnapshot`; nothing is mutated in place.
- **Type-safe throughout** — `PathDefinition<TData>`, `PathStepContext<TData>`, and `PathSnapshot<TData>` are all generic. Define your data shape once and get full inference through every guard and hook.
- **Stack-based sub-paths** — `startSubPath()` suspends the current path and pushes a new one; completion or cancellation automatically restores the parent with merged data.
- **Batteries included, removable** — every adapter ships an optional `PathShell` component for rapid prototyping. Replace it with custom UI whenever you need full control.

---

© 2026 Devjoy Ltd. MIT License.
