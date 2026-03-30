# Core Concepts

## What is Pathwrite?

Pathwrite is a **headless path engine**. It manages step-by-step navigation, data collection, validation guards, and nested sub-paths — with no dependency on any UI framework and no opinion about what your UI looks like.

The problem it solves is the one that appears whenever you need to guide a user through a sequence of steps: a sign-up wizard, an onboarding flow, a multi-step form, an approval workflow. The logic is always the same — which step comes next, can the user move forward, what data has been collected, is the flow done — but it ends up scattered across component state, router logic, and event handlers in every application that needs it. Pathwrite extracts that logic into a standalone engine and keeps it there.

## The headless model

"Headless" means Pathwrite owns no HTML. It does not render anything. You write all the markup; Pathwrite tells you:

- which step you are currently on
- whether moving forward or backward is allowed
- what data the user has entered so far
- when the flow has completed

Your UI reads that information from a **snapshot** and renders whatever it likes. The engine does not care whether your navigation buttons are `<button>` elements, icon links, swipe gestures, or keyboard shortcuts. It does not care whether you show a progress bar, a sidebar, or nothing at all. It does not care whether you use React, Vue, Angular, Svelte, or plain JavaScript.

This is a deliberate trade-off. It makes Pathwrite more work to integrate than a "batteries-included" wizard component — you have to write the markup yourself — but it means the engine works in any context and the UI is entirely under your control.

For situations where you want to get started quickly without writing navigation chrome from scratch, every framework adapter ships an optional `PathShell` component. It renders a progress indicator, step content area, and navigation buttons out of the box. You can use it while prototyping and replace it with custom UI whenever you need full control.

## The four key concepts

### PathDefinition

A `PathDefinition` is a plain object that describes your flow: an ID, an optional title, and an ordered array of steps. Each step has an ID, an optional title, and optional hooks and guards.

This is where you declare the *rules* of your flow — what validation must pass before the user can advance, what data should be initialised when a step is entered, what should happen when the flow completes. A path definition is just data; it has no runtime state.

### PathEngine

The `PathEngine` is the state machine that drives a path at runtime. You give it a `PathDefinition` and initial data, and it manages the rest: tracking the current step, running guards and lifecycle hooks, merging data patches, and emitting events.

The engine holds all mutable state. It is the single source of truth for where the user is in the flow and what data they have entered. You interact with it through action methods (`next()`, `previous()`, `setData()`, etc.) and subscribe to its events to know when things change.

### PathSnapshot

At any moment, the engine can produce a **snapshot** — a read-only, point-in-time description of the current state. A snapshot includes:

- the current step ID and title
- the step's position and the total number of visible steps
- a progress value from 0.0 to 1.0
- a summary of every step with its status (completed / current / upcoming)
- whether moving forward or backward is currently allowed
- any validation errors for the current step's fields
- a copy of all data collected so far
- the engine's current operational status (idle, entering, leaving, validating, completing)

Snapshots are immutable. The engine produces a new snapshot object every time state changes. Your UI consumes snapshots; it never mutates them.

### Adapters

An adapter is a thin wrapper around the engine that translates its event-subscription model into the reactive primitives your framework expects:

| Package | Reactive primitive |
|---|---|
| `@daltonr/pathwrite-react` | `useSyncExternalStore` — re-renders on every state change |
| `@daltonr/pathwrite-vue` | `shallowRef` — Vue 3 reactive ref |
| `@daltonr/pathwrite-angular` | `BehaviorSubject` (Observable) + pre-wired Signal |
| `@daltonr/pathwrite-svelte` | `$state` rune |
| `@daltonr/pathwrite-solid` | `createSignal` accessor |
| `@daltonr/pathwrite-react-native` | `useSyncExternalStore` (same as React adapter) |

Adapters do not add any logic of their own. They subscribe to the engine and surface the current snapshot in the idiomatic way for the framework. The `PathEngine` API is the same regardless of which adapter you use.

## How they relate

```
PathDefinition
   │
   │  describes the rules
   ▼
PathEngine  ─── action methods ───► moves between steps, runs hooks/guards
   │
   │  emits events, produces snapshots
   ▼
Adapter  ─── reactive snapshot ───► framework component re-renders
   │
   │  component reads snapshot, calls actions
   ▼
Your UI  ─── setData(), next(), previous() ───► back to PathEngine
```

The definition is written once and passed to the engine when the flow starts. The engine runs, producing snapshots as state changes. The adapter subscribes to the engine and pushes snapshots into the framework's reactivity system. Your components read the snapshot to decide what to render and call action methods to drive navigation.

## A mental model

Think of it in three layers:

```
┌────────────────────────────────┐
│            Your UI             │  Markup, styles, layout — entirely yours
│  reads snapshot, calls actions │
├────────────────────────────────┤
│           Adapter              │  Thin bridge — snapshot as reactive state
│  usePath() / PathFacade        │
├────────────────────────────────┤
│          PathEngine            │  State machine — navigation, guards, data
│  PathDefinition → snapshots    │
└────────────────────────────────┘
```

The only things that cross layer boundaries are:
- **down**: action calls (`next()`, `setData()`, etc.)
- **up**: snapshot updates triggering re-renders

The engine knows nothing about your UI. Your UI knows nothing about the engine's internals. The adapter is the only coupling point, and it is provided for you.

© 2026 Devjoy Ltd. MIT License.
