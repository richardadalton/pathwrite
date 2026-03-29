# Pathwrite Documentation

## Getting started

| | |
|---|---|
| [Installation](getting-started/installation.md) | Install the core and your framework adapter |
| [Core concepts](getting-started/core-concepts.md) | PathDefinition, PathEngine, PathSnapshot, Adapters |
| [Your first path](getting-started/first-path.md) | Build a 3-step form end-to-end with React |

### Framework guides

| | |
|---|---|
| [React](getting-started/frameworks/react.md) | `usePath`, `usePathContext`, `PathShell` |
| [Vue](getting-started/frameworks/vue.md) | `usePath` composable, named slots |
| [Angular](getting-started/frameworks/angular.md) | `PathFacade`, `injectPath`, `<pw-shell>` |
| [Svelte](getting-started/frameworks/svelte.md) | `usePath` runes, snippets, camelCase fallback |
| [React Native](getting-started/frameworks/react-native.md) | Metro config, `AsyncStorageStore` |

## Guides

| | |
|---|---|
| [Navigation & guards](guides/navigation.md) | PathDefinition, steps, fieldErrors, canMoveNext, shouldSkip |
| [Sub-paths](guides/sub-paths.md) | Branching, stacking, completion behaviour |
| [Persistence](guides/persistence.md) | PathStore, HttpStore, save strategies, offline |
| [Services](guides/services.md) | Injecting async dependencies into guards |
| [Shared workflows](guides/shared-workflows.md) | Framework-agnostic workflow packages |
| [Testing](guides/testing.md) | Unit tests, guards, property-based testing |
| [TypeScript](guides/typescript.md) | Typed paths, typed context, typed setData |
| [Beyond wizards](guides/beyond-wizards.md) | Forms, carts, document lifecycles, state machines |

## Reference

| | |
|---|---|
| [Core API](reference/core-api.md) | PathEngine, PathSnapshot, PathEvent, PathStore |
| [Shell CSS](reference/shell-css.md) | CSS custom properties and theming |

## Contributing

| | |
|---|---|
| [Development setup](contributing/development-setup.md) | Build, test, run demos |
| [Publishing](contributing/publishing.md) | Changesets, versioning, npm release |
| [Architecture](contributing/architecture.md) | Design decisions, why headless, adapter model |
