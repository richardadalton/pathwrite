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
| [SolidJS](getting-started/frameworks/solidjs.md) | `usePath` signal accessor, `steps` map |

## Developer Guide

Narrative chapters covering everything from the engine's core mental model through testing and beyond. Read in order for the full picture, or jump to a chapter as reference.

| Chapter | |
|---|---|
| [Developer Guide](developer-guide/README.md) | Table of contents and chapter overview |
| [1 — How the engine works](developer-guide/01-engine.md) | Mental model: definition, engine, snapshot, adapters |
| [2 — Defining paths](developer-guide/02-defining-paths.md) | The complete PathDefinition API |
| [3 — Navigation and guards](developer-guide/03-navigation.md) | Step transitions, canMoveNext, canMovePrevious, blockingError |
| [4 — Async patterns](developer-guide/04-async.md) | Async guards and hooks, loading states, error-and-retry |
| [5 — Sub-paths](developer-guide/05-sub-paths.md) | Branching, nesting, data merge on completion |
| [6 — Working with data](developer-guide/06-data.md) | setData, isDirty, TypeScript generics |
| [7 — Services](developer-guide/07-services.md) | Injecting async dependencies into guards and hooks |
| [8 — Persistence](developer-guide/08-persistence.md) | PathStore, save strategies, offline-resilient flows |
| [9 — Workflows as packages](developer-guide/09-workflows-as-packages.md) | Framework-agnostic workflow packages |
| [10 — Testing](developer-guide/10-testing.md) | Unit tests, guards, sub-paths, property-based testing |
| [11 — Beyond wizards](developer-guide/11-beyond-wizards.md) | Forms, carts, document lifecycles, state machines |

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
