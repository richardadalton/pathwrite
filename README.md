# Pathwrite

A headless, framework-agnostic path engine for multi-step flows. Define your steps, guards, and validation as pure TypeScript — then render them in React, Vue, Angular, Svelte, or React Native.

```bash
npm install @daltonr/pathwrite-core @daltonr/pathwrite-react
```

## The idea

Most multi-step form libraries couple business logic to UI components. Pathwrite separates them: your flow is a plain TypeScript object (`PathDefinition`) that the engine (`PathEngine`) executes. The framework adapter subscribes to the engine and exposes its state using the framework's own reactivity. Your components read state and call actions — they never own the flow logic.

```tsx
import { PathShell } from "@daltonr/pathwrite-react";
import "@daltonr/pathwrite-react/styles.css";

const signupPath = {
  id: "signup",
  steps: [
    {
      id: "details",
      fieldErrors: ({ data }) => ({
        name:  !data.name  ? "Name is required."  : undefined,
        email: !data.email ? "Email is required." : undefined,
      }),
    },
    { id: "review" },
  ],
  onComplete: async (data) => {
    await api.createAccount(data);
  },
};

function App() {
  return (
    <PathShell
      path={signupPath}
      initialData={{ name: "", email: "" }}
      onComplete={() => navigate("/welcome")}
      steps={{
        details: <DetailsForm />,
        review:  <ReviewPanel />,
      }}
    />
  );
}
```

`PathShell` renders a progress indicator, step content, and navigation buttons. Swap it for your own UI whenever you need full control — `usePath()` gives you the raw snapshot and action functions.

## Install

Every project needs the core engine and an adapter for your framework:

```bash
# React
npm install @daltonr/pathwrite-core @daltonr/pathwrite-react

# Vue 3
npm install @daltonr/pathwrite-core @daltonr/pathwrite-vue

# Angular
npm install @daltonr/pathwrite-core @daltonr/pathwrite-angular

# Svelte 5
npm install @daltonr/pathwrite-core @daltonr/pathwrite-svelte

# React Native
npm install @daltonr/pathwrite-core @daltonr/pathwrite-react-native

# Framework-agnostic / Node
npm install @daltonr/pathwrite-core
```

To persist flow state to localStorage or a REST API:

```bash
npm install @daltonr/pathwrite-store-http
```

## Packages

| Package | Description |
|---|---|
| [`@daltonr/pathwrite-core`](packages/core) | Zero-dependency path state machine. Manages navigation, guards, hooks, sub-path stacking, and persistence observers. |
| [`@daltonr/pathwrite-react`](packages/react-adapter) | `usePath()` hook and `PathShell` component. Uses `useSyncExternalStore` for tear-free reads. |
| [`@daltonr/pathwrite-vue`](packages/vue-adapter) | `usePath()` composable and `PathShell` component. State as `shallowRef` with `onScopeDispose` cleanup. |
| [`@daltonr/pathwrite-angular`](packages/angular-adapter) | `PathFacade` injectable and `<pw-shell>` component. State as `Observable` and Signal. |
| [`@daltonr/pathwrite-svelte`](packages/svelte-adapter) | `usePath()` with Svelte 5 runes and `PathShell` snippets. |
| [`@daltonr/pathwrite-react-native`](packages/react-native-adapter) | `usePath()` hook and `PathShell` for Expo and bare React Native. |
| [`@daltonr/pathwrite-store-http`](packages/store-http) | `HttpStore` and `LocalStorageStore` with `httpPersistence` observer and `restoreOrStart`. |

## Documentation

| | |
|---|---|
| [Getting started](docs/getting-started/installation.md) | Installation, core concepts, your first path |
| [Developer Guide](docs/developer-guide/README.md) | 11-chapter narrative guide from engine model to testing |
| [Core API reference](docs/reference/core-api.md) | Full `PathEngine`, `PathSnapshot`, and `PathStore` API |
| [Shell CSS reference](docs/reference/shell-css.md) | CSS custom properties for theming `PathShell` |
| [Contributing](docs/contributing/development-setup.md) | Build, test, run demos |

## Design principles

- **Headless first** — `@daltonr/pathwrite-core` has zero runtime dependencies. It runs identically in a browser, Node.js, a test runner, or React Native.
- **Workflows as artifacts** — because `PathDefinition` is a plain TypeScript object with no framework dependencies, a workflow is a first-class software artifact. Package it, version it with semver, test it without mounting anything, and share it across a web app, mobile app, and backend service simultaneously.
- **Immutable snapshots** — every engine action produces a new `PathSnapshot`; nothing is mutated in place.
- **Type-safe throughout** — `PathDefinition<TData>`, `PathStepContext<TData>`, and `PathSnapshot<TData>` are generic. Define your data shape once and get full inference through every guard and hook.
- **Stack-based sub-paths** — `startSubPath()` suspends the current path and pushes a new one; completion or cancellation automatically restores the parent with merged data.
- **Batteries included, removable** — every adapter ships an optional `PathShell` component for rapid prototyping. Replace it with custom UI whenever you need full control.

---

© 2026 Devjoy Ltd. MIT License.
