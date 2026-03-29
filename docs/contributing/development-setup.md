# Development Setup

This guide covers how to get the monorepo running locally, how to build and test, and what to update when adding new packages.

---

## Prerequisites

- **Node.js** — any current LTS release (20.x or 22.x). The project has no hard version pin but uses ES2022 syntax and relies on features available in modern LTS Node.
- **npm** — comes with Node; no Yarn or pnpm. The workspace config uses npm workspaces.
- **Git** — standard installation.

---

## Clone and install

```bash
git clone https://github.com/richardadalton/pathwrite.git
cd pathwrite
npm install
```

`npm install` at the root installs dependencies for every workspace in a single pass. Do not run `npm install` inside individual package directories — let the root manage the lockfile.

---

## Build all packages

```bash
npm run build
```

Build order matters. The `build` script runs packages in the correct sequence:

1. `packages/core` — must be first; all adapters depend on it
2. `packages/react-adapter`, `packages/react-native-adapter`, `packages/vue-adapter`, `packages/store`, `packages/svelte-adapter`, `packages/angular-adapter` — adapters built in parallel (the script sequences them explicitly)
3. `apps/shared-workflows/demo-workflow-job-application` — built last; this shared workflow package is consumed by demo apps

Each package uses its own `tsconfig.json` extending `tsconfig.base.json` at the repo root. Angular uses `ngc`; Svelte uses `svelte-package`; all others use `tsc`.

Build output lands in `packages/*/dist/`. If a build fails partway through, run `npm run clean` and try again from scratch.

---

## Run tests

### Full suite

```bash
npm test
```

Runs all tests once via Vitest. Tests run against source (not dist) using path aliases configured in `vitest.config.mts` at the repo root.

### Watch mode

```bash
npm run test:watch
```

Starts Vitest in interactive watch mode. Useful during active development.

### Single test file

Pass the path directly to Vitest:

```bash
npx vitest run packages/core/test/path-engine.test.ts
```

Or run all tests in a package:

```bash
npx vitest run packages/core
```

Tests live in `packages/*/test/**/*.test.ts`. The core package includes both unit tests (`path-engine.test.ts`) and property-based tests (`path-engine.properties.test.ts`, `workflow-demos.properties.test.ts`) using fast-check.

---

## Run a demo app

Each demo app has a corresponding script in the root `package.json`. Start one with:

```bash
npm run demo:react:wizard
npm run demo:vue:form
npm run demo:angular:subwizard
npm run demo:svelte:stepchoice
npm run demo:rn
```

A representative list of available scripts:

| Script | App |
|--------|-----|
| `demo:react:wizard` | React wizard demo |
| `demo:react:form` | React single-step form demo |
| `demo:react:subwizard` | React sub-path (nested wizard) demo |
| `demo:react:skip` | React conditional step skip demo |
| `demo:react:stepchoice` | React step-choice branching demo |
| `demo:react:storage` | React HTTP persistence demo |
| `demo:vue:wizard` | Vue wizard demo |
| `demo:vue:course` | Vue multi-subject course builder demo |
| `demo:angular:form` | Angular form demo |
| `demo:angular:stepchoice` | Angular step-choice branching demo |
| `demo:svelte:wizard` | Svelte wizard demo |
| `demo:rn` | React Native showcase (Expo) |

The full list is in the `scripts` section of the root `package.json`.

Demo apps under `apps/` do **not** install packages from npm — they reference the local workspace packages directly (via `workspace:*` or path aliases). The packages must be built before a demo app will work correctly.

---

## Smoke test all demos

```bash
npm run smoke:demos
```

This script finds every `demo:*` script in the root `package.json`, starts each one sequentially, waits for a startup-ready signal in the process output, then kills it and moves on. At the end it prints a pass/fail summary.

Default startup timeout is 14 seconds per demo. Override it if your machine is under heavy load:

```bash
SMOKE_DEMOS_TIMEOUT_MS=25000 npm run smoke:demos
```

Run this before opening a PR that touches build configuration, Vite configs, or anything that could affect how demos start.

---

## The shared-workflows packages

Demo apps that show a realistic multi-step workflow (such as the job application demos) consume a shared workflow definition from `apps/shared-workflows/demo-workflow-job-application`. This package must be built before those demo apps can start:

```bash
npm run build
```

The root build script already handles this — `demo-workflow-job-application` is built as the last step. If you add a new shared-workflow package, add it to the `build` script in the root `package.json` and to the `workspaces` array.

---

## Adding a new workspace package

When you add a package under `packages/` or `apps/`:

1. **`package.json` workspaces** — the root `package.json` already includes `"packages/*"` and each `apps/<category>/*` glob. New packages under an existing glob are picked up automatically. If you add a new top-level directory under `apps/`, add its glob to the `workspaces` array.

2. **Build script** — add the new package to the `build` script in the root `package.json` in the correct position. If the package depends on `core`, it must come after `core`. If it is a shared workflow consumed by demo apps, it must come last.

3. **React Native Metro config** — if any React Native demo app (`apps/react-native-demos/`) needs to resolve the new package, add it to the Metro config's `watchFolders` and `resolver.extraNodeModules`. Metro does not follow symlinks the same way Node does and needs the paths registered explicitly. See the existing Metro config in `apps/react-native-demos/` for the pattern.

4. **Changeset ignore list** — if the package should never be published (demos, internal tooling), add it to the `ignore` array in `.changeset/config.json`.

---

© 2026 Devjoy Ltd. MIT License.
