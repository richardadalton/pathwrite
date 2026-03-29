# Pathwrite Developer Guide

Pathwrite is a headless, framework-agnostic state machine for sequential, data-collecting processes. This guide covers everything from the engine's core mental model through persistence, sub-paths, testing, and the full range of things the engine can drive beyond the typical wizard. It is written for developers building production applications with Pathwrite — in React, Vue, Angular, Svelte, or Node.js. It assumes you have a working installation; if you do not, start with [getting-started/](../getting-started/).

## How to read this guide

The chapters are written to be read in order. Each one builds on the previous: the engine model in Chapter 1 underpins the navigation mechanics in Chapter 3, which underpins the async patterns in Chapter 4, and so on. A developer who reads linearly will arrive at Chapter 9 with the full mental model needed to treat workflows as first-class, versioned artifacts — definitions that live outside your application code and can be tested, published, and shared. Chapters are also self-contained enough to use individually as reference once you know the terrain.

## Chapters

| Chapter | Title | What you'll learn |
|---|---|---|
| 1 | [How the engine works](./01-engine.md) | The core mental model: definition, engine, snapshot, and adapters — what each one is and how they relate |
| 2 | [Defining paths](./02-defining-paths.md) | The complete `PathDefinition` API: steps, titles, metadata, `onComplete`, and how all the pieces fit together |
| 3 | [Navigation and guards](./03-navigation.md) | Step boundaries, the precise sequence of events at each transition, `blockingError`, and how `canMoveNext` and `canMovePrevious` control flow |
| 4 | [Async patterns](./04-async.md) | How async guards and hooks work, the `"validating"` and `"completing"` status values, loading states, and the error-and-retry cycle |
| 5 | [Sub-paths](./05-sub-paths.md) | Branching and nested flows: how to start a sub-path, pass context, and merge data back into the parent on completion or cancellation |
| 6 | [Working with data](./06-data.md) | `setData`, `isDirty`, how the engine merges hook return values, and writing TypeScript generics that make your data type-safe throughout |
| 7 | [Services](./07-services.md) | Injecting external dependencies into hooks and guards, caching async results across steps, and structuring definitions for testability |
| 8 | [Persistence](./08-persistence.md) | `PathStore`, save strategies (`onEveryChange`, `onNext`, `onSubPathComplete`, `onComplete`, `manual`), `restoreOrStart`, and building offline-resilient flows |
| 9 | [Workflows as packages](./09-workflows-as-packages.md) | Extracting a `PathDefinition` into a versioned npm package: structure, testing, sharing across applications, and the boundary between business rules and rendering |
| 10 | [Testing](./10-testing.md) | Testing guards, hooks, and branching logic directly against the engine without mounting any UI component |
| 11 | [Beyond wizards](./11-beyond-wizards.md) | Single-page forms, multi-stage checkouts, document lifecycles, server-side orchestration, state machines, and conversational flows — the full range of what the engine drives |

## Other docs

**[getting-started/](../getting-started/)**
Installation instructions and framework-specific quick starts for React, Vue, Angular, Svelte, and React Native.

**[reference/core-api.md](../reference/core-api.md)**
Exhaustive API reference for `@daltonr/pathwrite-core`: every type, interface, method, and option with full signatures. Use this when you need the precise contract for something the guide covers at a higher level.

**[contributing/](../contributing/)**
Architecture decision records, notes on the monorepo structure, and the process for publishing packages.
