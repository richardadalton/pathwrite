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
| `@daltonr/pathwrite-store-http` | `packages/store-http` | `HttpStore` + `LocalStorageStore` persistence |

## Commands

- `npm run build` - Build all packages (order matters: core first, then adapters + store-http)
- `npm test` - Run all tests (`vitest run`)
- `npm run test:watch` - Watch mode
- `npm run clean` - Remove dist/ and .tsbuildinfo artifacts
- `npm run prepublish:check` - Clean, build, test (pre-release gate)
- `npm run publish:all` - Publish all 6 packages to npm
- `npm run smoke:demos` - Smoke test all demo app startup scripts

Run a single test file: `npx vitest run packages/core/test/path-engine.test.ts`

## Test structure

Tests live in `packages/*/test/**/*.test.ts`. Vitest config at root `vitest.config.mts`. Tests run against source (not dist) via path aliases.

## Build

TypeScript 5.4, target ES2022, module ES2022, bundler resolution. Each package has its own `tsconfig.json` extending `tsconfig.base.json`. Angular uses `ngc`, Svelte uses `svelte-package`, others use `tsc`.

## Versioning

All 6 packages version together via Changesets (fixed group). Use `npm run changeset` to create a changeset, `npm run version` to bump, `npm run release` to publish.

## Key architecture notes

- `PathEngine` is the core state machine. It takes a `PathDefinition<TData>` and manages navigation, guards, validation, sub-path stacking, and lifecycle hooks.
- All adapters wrap `PathEngine` and expose framework-idiomatic reactive state (hooks/signals/observables/stores).
- Each adapter provides an optional `PathShell` UI component with shared CSS (`packages/shell.css`).
- Persistence uses the observer pattern via `subscribe()` with configurable strategies (onEveryChange, onNext, onSubPathComplete, onComplete, manual).
