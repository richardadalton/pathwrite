# Installation

## Pick your packages

Every Pathwrite project needs two packages: the core engine and the adapter for your framework. The core is always `@daltonr/pathwrite-core`; choose the adapter that matches your stack.

```bash
# React
npm install @daltonr/pathwrite-core @daltonr/pathwrite-react

# Vue 3
npm install @daltonr/pathwrite-core @daltonr/pathwrite-vue

# Angular
npm install @daltonr/pathwrite-core @daltonr/pathwrite-angular

# Svelte 5
npm install @daltonr/pathwrite-core @daltonr/pathwrite-svelte

# Framework-agnostic / Node (no UI)
npm install @daltonr/pathwrite-core
```

If you want to persist wizard state to `localStorage` or a REST API, also install:

```bash
npm install @daltonr/pathwrite-store-http
```

## Peer dependencies

Each adapter has peer dependencies that must already be present in your project.

| Adapter | Required peer dependency |
|---|---|
| `@daltonr/pathwrite-react` | `react >= 18.0.0` |
| `@daltonr/pathwrite-vue` | `vue >= 3.3.0` |
| `@daltonr/pathwrite-angular` | `@angular/core >= 17.0.0`, `@angular/common >= 17.0.0`, `rxjs ^7.0.0` |
| `@daltonr/pathwrite-svelte` | `svelte >= 5.0.0` |

`@angular/forms` is an optional peer dependency of the Angular adapter (required only if you use `syncFormGroup`).

`@daltonr/pathwrite-core` has zero dependencies.

## Verify the install

The quickest confirmation is to import `PathEngine` from the core package and check that TypeScript resolves it without errors:

```ts
import { PathEngine } from "@daltonr/pathwrite-core";

// If this line compiles without errors, the package resolved correctly.
const engine = new PathEngine();
```

You do not need to call any methods — the import alone confirms the package is on your module graph. If the import fails, check that `node_modules/@daltonr/pathwrite-core/dist/index.js` exists and that your `tsconfig.json` uses `"moduleResolution": "bundler"` or `"node16"`/`"nodenext"`.

## Run a demo app

The repository includes working demo applications for every adapter. Running one is the fastest way to see Pathwrite in action before writing any code.

From the monorepo root:

```bash
npm install
npm run demo:react         # React wizard demo  (localhost:5173)
npm run demo:vue           # Vue wizard demo    (localhost:5173)
npm run demo:angular       # Angular demo       (localhost:4200)
npm run demo:svelte        # Svelte demo        (localhost:5174)
npm run demo               # Console demo (no browser needed)
```

Each demo app is a self-contained example that covers path definition, step navigation, validation, and completion handling.

© 2026 Devjoy Ltd. MIT License.
