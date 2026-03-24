# Pathwrite

A headless, framework-agnostic path engine for the web, with first-class Angular, React, Vue, and Svelte adapters — plus optional default UI shell components for rapid prototyping.

## Documentation

📚 **[View all documentation in `/docs`](docs/README.md)**

- **[Developer Guide](docs/guides/DEVELOPER_GUIDE.md)** - Comprehensive development guide
- **[Persistence Guide](docs/guides/PERSISTENCE_STRATEGY_GUIDE.md)** - Auto-persistence strategies and implementation
- **[Publishing Guide](docs/guides/PUBLISHING.md)** - Release process and versioning

## Packages

| Package | Description |
|---------|-------------|
| [`@daltonr/pathwrite-core`](packages/core) | Deterministic path state machine with stack-based sub-path orchestration. Zero dependencies, no UI framework required. |
| [`@daltonr/pathwrite-angular`](packages/angular-adapter) | Angular `@Injectable` facade over the core engine. Exposes state and events as RxJS observables; integrates with signals via `toSignal`. Includes optional `<pw-shell>` component. |
| [`@daltonr/pathwrite-react`](packages/react-adapter) | React hooks over the core engine. Exposes state via `useSyncExternalStore` with stable action callbacks, an optional context provider, and an optional `<PathShell>` component. |
| [`@daltonr/pathwrite-vue`](packages/vue-adapter) | Vue 3 composable over the core engine. Exposes state as a reactive `shallowRef` with automatic cleanup via `onScopeDispose`. Includes optional `<PathShell>` component. |
| [`@daltonr/pathwrite-svelte`](packages/svelte-adapter) | Svelte store over the core engine. Exposes state as a Svelte store with automatic cleanup. Includes optional `<PathShell>` component. |
| [`@daltonr/pathwrite-store-http`](packages/store-http) | REST API storage adapter with auto-persistence. Configurable strategies for saving wizard state to your backend. |

## Apps

| App | Description |
|-----|-------------|
| [`demo-console`](apps/demo-console) | Node script showing parent path + sub-path resume in a terminal. |
| [`demo-angular`](apps/demo-angular) | Minimal Angular host rendering path state and events. |
| [`demo-angular-course`](apps/demo-angular-course) | Full Angular course-path demo with a subject-entry sub-path. |
| [`demo-angular-shell`](apps/demo-angular-shell) | Angular demo using the `<pw-shell>` default UI — same wizard, zero boilerplate. |
| [`demo-vue-wizard`](apps/demo-vue-wizard) | Vue 3 onboarding wizard with auto-persistence and validation. |
| [`demo-vue-storage`](apps/vue-demos/demo-vue-storage) | Vue 3 team onboarding with **switchable storage backends**: localStorage (browser-local) and API (REST server). Demonstrates `LocalStorageStore`, `httpPersistence`, and session listing. **[See HTTP Storage](#http-storage--api-mode) below.** |
| [`demo-svelte-onboarding`](apps/demo-svelte-onboarding) | Svelte onboarding wizard with PathShell component and HTTP persistence. |
| [`demo-lifecycle`](apps/demo-lifecycle) | Backend document lifecycle (Draft → Review → Approved → Published) with guards, sub-paths, and conditional skipping — no UI. |

## HTTP Storage & API Mode

The `@daltonr/pathwrite-store-http` package provides persistence adapters for saving wizard state:

- **`LocalStorageStore`** — Browser-local persistence using `localStorage` (or an in-memory fallback in Node). Includes `list()` to enumerate saved session keys and `clear()` to delete all sessions under a prefix.
- **`HttpStore`** — REST API persistence via HTTP `PUT`/`GET`/`DELETE`. Production-ready for stateless backends.

Both implement the `PathStore` interface, so they're interchangeable with `httpPersistence` and `restoreOrStart`.

### Demo: Switchable storage backends

The **[`demo-vue-storage`](apps/vue-demos/demo-vue-storage)** demonstrates localStorage and API storage side-by-side with a toggle in the UI:

- **💾 localStorage** — Sessions saved to browser storage with prefix `pathwrite-demo:`. Data survives page reloads but is private to your browser.
- **🌐 API (port 3001)** — Sessions saved to a REST server. Data is shared across tabs/browsers and persists until the server restarts.

#### Running the demo with API mode

You need two servers. Use **one** of these approaches:

**Option 1: Concurrently** (simplest)

```bash
cd apps/vue-demos/demo-vue-storage
npm install
npm run dev
```

This starts both the Express API server (port 3001) and Vite (port 5173) in one command.

**Option 2: Separate terminals**

Terminal 1 — API server:
```bash
cd apps/vue-demos/demo-vue-storage
npm run server
```

Terminal 2 — Vue dev server:
```bash
cd apps/vue-demos/demo-vue-storage
npm start
```

Open `http://localhost:5173` (or the port Vite suggests) and click the **🌐 API** toggle to switch to server-backed storage.

#### API endpoints

The Express server exposes:

```
GET    /api/state       → { keys: string[] }           # List all snapshot keys
GET    /api/state/:key  → SerializedPathState | 404   # Load a snapshot
PUT    /api/state/:key  → { success: true }           # Save a snapshot (body: SerializedPathState)
DELETE /api/state/:key  → { success: true } | 404     # Delete a snapshot
```

All endpoints support CORS for local development. The server uses in-memory storage (data is lost on restart).

#### What to test

1. **localStorage mode** — Start a session, add data, reload → session restores.
2. **API mode** — Toggle to API, start a session. Open the URL in a private/incognito window → both tabs see the same session list (shared storage).
3. **Switching modes** — Toggle between backends → each mode has independent sessions.
4. **Server offline** — With the server stopped, try switching to API mode → error banner appears with clear guidance.

See the **[demo README](apps/vue-demos/demo-vue-storage/README.md)** for full details.

### Using HTTP storage in your app

```ts
import { LocalStorageStore, httpPersistence, restoreOrStart } from "@daltonr/pathwrite-store-http";

// Browser-local storage
const store = new LocalStorageStore({ prefix: "myapp:" });

// REST API storage
import { HttpStore } from "@daltonr/pathwrite-store-http";
const store = new HttpStore({ baseUrl: "https://api.example.com" });

// Auto-persist every change (debounced)
const engine = new PathEngine({
  observers: [
    httpPersistence({
      store,
      key: "wizard-session-123",
      strategy: "onEveryChange",
      debounceMs: 500,
    }),
  ],
});

// Or restore from a snapshot if one exists
const { engine, restored } = await restoreOrStart({
  store,
  key: "wizard-session-123",
  path: myPath,
  initialData: {},
});
```

See **[Persistence Strategy Guide](docs/guides/PERSISTENCE_STRATEGY_GUIDE.md)** for persistence options (`onNext`, `onComplete`, etc.) and the **[store-http README](packages/store-http/README.md)** for full API documentation.

## Design principles

- **Headless first** — the core engine has no DOM or framework dependency; UI is entirely the host's responsibility. Default shell components are an optional convenience layer, not a requirement.
- **Immutable context** — lifecycle hooks receive a snapshot copy of `data` and return a patch object; they cannot mutate internal state directly.
- **Type-safe data** — `PathDefinition<TData>`, `PathStepContext<TData>`, and `PathSnapshot<TData>` are all generic; define your data shape once and get full inference through every hook and guard.
- **Stack-based sub-paths** — calling `startSubPath()` pushes the current path onto a stack; completion or cancellation automatically restores the parent.
- **Observable + signal friendly** — the Angular adapter exposes `state$` and `events$` as `Observable`, compatible with both the `async` pipe and `toSignal`.
- **Hook friendly** — the React adapter uses `useSyncExternalStore` for tear-free reads and provides referentially stable action callbacks.
- **Composable friendly** — the Vue adapter uses `shallowRef` + `onScopeDispose` for clean, idiomatic Vue 3 integration.
- **Store friendly** — the Svelte adapter exposes state as a Svelte store with automatic cleanup and reactivity.
- **Batteries included, removable** — each adapter ships optional default UI shell components (`<PathShell>` / `<pw-shell>`) that render progress indicators, step content, and navigation buttons. Use them to get started quickly; replace them with custom UI whenever you need full control.

## Quick start

```bash
npm install
npm test
npm run demo                  # console demo
npm run demo:lifecycle        # lifecycle state-machine demo (no UI)
npm run demo:angular          # Angular demo (localhost:4200)
npm run demo:angular:course   # course path demo (localhost:4200)
npm run demo:angular:shell    # shell UI demo (localhost:4200)
npm run demo:vue              # Vue wizard demo (localhost:5173)
npm run demo:vue:storage      # Vue storage demo with localStorage/API toggle (localhost:5173)
npm run demo:svelte           # Svelte onboarding demo (localhost:5174)
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

### Svelte

```svelte
<script>
  import { PathShell } from "@daltonr/pathwrite-svelte";
  import DetailsForm from "./DetailsForm.svelte";
  import ReviewPanel from "./ReviewPanel.svelte";
</script>

<PathShell {path} initialData={{ name: '' }} oncomplete={handleDone}>
  {#snippet details()}
    <DetailsForm />
  {/snippet}
  {#snippet review()}
    <ReviewPanel />
  {/snippet}
</PathShell>
```

Steps are declared as Svelte 5 snippets, keyed by step ID. Step components access path data via `getPathContext()` from `@daltonr/pathwrite-svelte`.

### Styling

Import the optional stylesheet from whichever adapter you are using. All visual values are CSS custom properties (`--pw-*`), so you can theme without overriding selectors:

```css
/* React / Vue / Svelte — import in your entry file or global stylesheet */
@import "@daltonr/pathwrite-react/styles.css";
/* or */
@import "@daltonr/pathwrite-vue/styles.css";
/* or */
@import "@daltonr/pathwrite-svelte/styles.css";

/* Angular — add to the styles array in angular.json */
/* "node_modules/@daltonr/pathwrite-angular/dist/index.css" */

:root {
  --pw-color-primary: #8b5cf6;
  --pw-shell-radius: 12px;
}
```

See the [Developer Guide](DEVELOPER_GUIDE.md) for the full list of shell props, slots, and CSS variables.

## Test coverage

536 tests across nine test files:

| Suite | Tests |
|-------|-------|
| `PathEngine` — navigation | 10 |
| `PathEngine` — snapshot | 9 |
| `PathEngine` — snapshot canMoveNext / canMovePrevious | 7 |
| `PathEngine` — setData | 4 |
| `PathEngine` — events | 8 |
| `PathEngine` — stateChanged cause field | 8 |
| `PathEngine` — lifecycle hooks | 13 |
| `PathEngine` — sub-paths | 5 |
| `PathEngine` — subscriptions | 3 |
| `PathEngine` — shouldSkip | 9 |
| `PathEngine` — stepTitle | 3 |
| `PathEngine` — fieldMessages | 12 |
| `PathEngine` — hasAttemptedNext | 6 |
| `PathEngine` — errors | 4 |
| `PathEngine` — async hooks and guards | 11 |
| `PathEngine` — lifecycle patterns | 10 |
| `PathEngine` — isFirstEntry | 6 |
| `PathEngine` — startSubPath meta | 4 |
| `PathEngine` — onSubPathCancel | 8 |
| `PathEngine` — guard error resilience | 6 |
| `PathEngine` — restart() | 8 |
| `PathEngine` — exportState / fromState | 19 |
| `matchesStrategy` | 19 |
| `PathFacade` — state$ | 8 |
| `PathFacade` — snapshot() | 3 |
| `PathFacade` — events$ | 5 |
| `PathFacade` — navigation methods | 5 |
| `PathFacade` — sub-path | 2 |
| `PathFacade` — goToStep | 2 |
| `PathFacade` — goToStepChecked | 7 |
| `PathFacade` — generic typing <TData> | 5 |
| `PathFacade` — fieldMessages | 6 |
| `PathFacade` — ngOnDestroy | 2 |
| `PathFacade` — stateSignal | 5 |
| `syncFormGroup` | 7 |
| `PathFacade` — adoptEngine | 6 |
| `PathShell` (React) — rendering | 10 |
| `PathShell` (React) — navigation | 7 |
| `PathShell` (React) — restart via actions | 2 |
| `PathShell` (React) — custom labels | 2 |
| `PathShell` (React) — progress | 3 |
| `PathShell` (React) — render props | 2 |
| `PathShell` (React) — autoStart false | 2 |
| `PathShell` (React) — context sharing | 2 |
| `PathShell` (React) — fieldMessages | 6 |
| `PathShell` (React) — footerLayout | 4 |
| `usePath` (React) — snapshot | 8 |
| `usePath` (React) — events | 5 |
| `usePath` (React) — navigation | 6 |
| `usePath` (React) — sub-path | 2 |
| `usePath` (React) — goToStep | 2 |
| `usePath` (React) — goToStepChecked | 3 |
| `PathProvider + usePathContext` | 4 |
| `usePath` (React) — cleanup | 1 |
| `usePath` (React) — restart() | 4 |
| `usePath` (React) — external engine | 5 |
| `PathShell` (Vue) — rendering | 10 |
| `PathShell` (Vue) — restart via component ref | 2 |
| `PathShell` (Vue) — navigation | 6 |
| `PathShell` (Vue) — restart via actions | 2 |
| `PathShell` (Vue) — custom labels | 2 |
| `PathShell` (Vue) — progress | 3 |
| `PathShell` (Vue) — autoStart false | 2 |
| `PathShell` (Vue) — context sharing | 2 |
| `PathShell` (Vue) — fieldMessages | 5 |
| `usePath` (Vue) — snapshot | 8 |
| `usePath` (Vue) — events | 4 |
| `usePath` (Vue) — navigation | 5 |
| `usePath` (Vue) — sub-path | 2 |
| `usePath` (Vue) — goToStep | 1 |
| `usePath` (Vue) — goToStepChecked | 2 |
| `usePath` (Vue) — scope disposal | 2 |
| `usePath` (Vue) — restart() | 4 |
| `usePath` (Vue) — external engine | 6 |
| `usePath` (Svelte) — snapshot | 12 |
| `usePath` (Svelte) — events | 4 |
| `usePath` (Svelte) — navigation | 5 |
| `usePath` (Svelte) — sub-path | 2 |
| `usePath` (Svelte) — goToStep | 1 |
| `usePath` (Svelte) — goToStepChecked | 2 |
| `usePath` (Svelte) — cleanup | 3 |
| `usePath` (Svelte) — restart() | 4 |
| `usePath` (Svelte) — external engine | 6 |
| `getPathContext / setPathContext` (Svelte) | 3 |
| `bindData` (Svelte) | 5 |
| `usePath` (Svelte) — guards and validation | 5 |
| `HttpStore` | 10 |
| `LocalStorageStore` | 36 |
| `httpPersistence` | 20 |
| `restoreOrStart` | 7 |

---

© 2026 Devjoy Ltd. MIT License.

