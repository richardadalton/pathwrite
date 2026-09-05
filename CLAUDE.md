# Pathwrite

Headless, framework-agnostic path/wizard/stepper engine. Website: pathwrite.io

## Monorepo layout

npm workspaces. All publishable packages in `packages/`, demo apps in `apps/`.

| Package | Path | Notes |
|---|---|---|
| `@daltonr/pathwrite-core` | `packages/core` | Zero-dep engine, single source file `src/index.ts` |
| `@daltonr/pathwrite-react` | `packages/react-adapter` | `usePath()` hook, `PathShell` component |
| `@daltonr/pathwrite-angular` | `packages/angular-adapter` | `PathFacade` injectable, RxJS + signals |
| `@daltonr/pathwrite-vue` | `packages/vue-adapter` | `usePath()` composable |
| `@daltonr/pathwrite-svelte` | `packages/svelte-adapter` | Svelte 5 runes-based store |
| `@daltonr/pathwrite-react-native` | `packages/react-native-adapter` | `usePath()` hook, `PathShell` for React Native (Expo / bare) |
| `@daltonr/pathwrite-solid` | `packages/solid-adapter` | `usePath()` signal accessor, `PathShell` component |
| `@daltonr/pathwrite-store` | `packages/store` | `HttpStore` + `LocalStorageStore` + `AsyncStorageStore` persistence, `restoreOrStart` |

Eight published packages in total. Demo apps and `apps/shared-workflows/*` are workspaces but are never published.

## Commands

- `npm run build` - Build all packages (order matters: core first, then adapters + store)
- `npm test` - Run all tests (`vitest run`, then `npm run test:types`)
- `npm run test:types` - Type checks: `*.test-d.ts` assertions (`tsconfig.typecheck.json`), then `tsc` over every test file (`tsconfig.tests.json`; Solid separately via `packages/solid-adapter/tsconfig.tests.json` for its JSX)
- `npm run test:watch` - Watch mode
- `npm run lint` - ESLint over `packages/**/*.{ts,tsx}` (typescript-eslint recommended; `no-explicit-any` is a warning until the engine is generic)
- `npm run format` / `npm run format:check` - Prettier over code and config files (`docs/`, `*.md` and changelogs are excluded)
- `npm run check -w packages/svelte-adapter` - `svelte-check` over `.svelte` files (also runs as the first step of that package's build)
- `npm run clean` - Remove dist/ and .tsbuildinfo artifacts
- `npm run prepublish:check` - Clean, build, test (pre-release gate)
- `npm run publish:all` - Publish all 8 packages to npm
- `npm run smoke:demos` - Smoke test all demo app startup scripts

Run a single test file: `npx vitest run packages/core/test/path-engine.test.ts`

CI (`.github/workflows/ci.yml`) runs `npm ci`, `npm run build`, `npm test` on Node 22 (`.nvmrc`) for pushes to `main` and pull requests. Run the same three locally before pushing.

## Test structure

Tests live in `packages/*/test/**/*.test.ts`. Vitest config at root `vitest.config.mts`. Tests run against source (not dist) via path aliases.

## Build

TypeScript 5.4, target ES2022, module ES2022, bundler resolution. Each package has its own `tsconfig.json` extending `tsconfig.base.json`. Angular uses `ngc`, Svelte uses `svelte-package`, others use `tsc`.

## Versioning

All 8 packages version together via Changesets (fixed group). Use `npm run changeset` to create a changeset, `npm run version` to bump, `npm run release` to publish.

## Key architecture notes

- `PathEngine` is the core state machine. It takes a `PathDefinition<TData>` and manages navigation, guards, validation, sub-path stacking, and lifecycle hooks.
- All adapters wrap `PathEngine` and expose framework-idiomatic reactive state (hooks/signals/observables/stores).
- Each adapter provides an optional `PathShell` UI component with shared CSS (`packages/shell.css`).
- Persistence uses the observer pattern via `subscribe()` with configurable strategies (onEveryChange, onNext, onSubPathComplete, onComplete, manual).
