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
| [Angular](getting-started/frameworks/angular.md) | `PathFacade`, `usePathContext`, `<pw-shell>` |
| [Svelte](getting-started/frameworks/svelte.md) | `usePath` runes, snippets, camelCase fallback |
| [React Native](getting-started/frameworks/react-native.md) | Metro config, `AsyncStorageStore` |
| [SolidJS](getting-started/frameworks/solidjs.md) | `usePath` signal accessor, `steps` map |

## Developer Guide

Narrative chapters covering everything from the engine's core mental model through testing and beyond. Read in order for the full picture, or jump to a chapter as reference.

| Chapter | |
|---|---|
| [Developer Guide](developer-guide/README.md) | Table of contents and chapter overview |
| [1 — How the engine works](developer-guide/01-engine.md) | Mental model: definition, engine, snapshot, adapters |
| [2 — Adapters and PathShell](developer-guide/02-adapters.md) | `usePath`, `PathShell`, `usePathContext`, writing your own adapter |
| [3 — Defining paths](developer-guide/03-defining-paths.md) | The complete PathDefinition API |
| [4 — Navigation and guards](developer-guide/04-navigation.md) | Step transitions, canMoveNext, canMovePrevious, blockingError |
| [5 — Async patterns](developer-guide/05-async.md) | Async guards and hooks, loading states, error-and-retry |
| [6 — Sub-paths](developer-guide/06-sub-paths.md) | Branching, nesting, data merge on completion |
| [7 — Working with data](developer-guide/07-data.md) | setData, isDirty, TypeScript generics |
| [8 — Services](developer-guide/08-services.md) | Injecting async dependencies into guards and hooks |
| [9 — Persistence](developer-guide/09-persistence.md) | PathStore, save strategies, `restoreOrStart`, offline-resilient flows |
| [10 — Workflows as packages](developer-guide/10-workflows-as-packages.md) | Framework-agnostic workflow packages |
| [11 — Testing](developer-guide/11-testing.md) | Unit tests, guards, sub-paths, property-based testing |
| [12 — Beyond wizards](developer-guide/12-beyond-wizards.md) | Forms, carts, document lifecycles, state machines |

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

## Proposals (not implemented)

Design notes for features that have been explored but **do not exist in any published package**. They are kept for reference and discussion only; nothing in them describes current behaviour.

| | |
|---|---|
| [Multi-user sync spec](proposals/multi-user-sync-spec.md) | Proposal for several users collaborating on one path instance |
| [Snapshot distributor architecture](proposals/snapshot-distributor-architecture.md) | Proposal for distributing engine snapshots across processes/clients |
