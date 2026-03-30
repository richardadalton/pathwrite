# Chapter 1: How the Engine Works

Before writing a single step, it is worth spending ten minutes on how the engine is structured. Pathwrite has one central abstraction — a state machine that takes rules in and produces state out — and everything else is a thin layer on top of it. Developers who grasp that model find the API obvious and its edge cases predictable. Developers who skip it find themselves fighting the library. This chapter explains the model in plain English, shows it running in isolation, and clarifies what the framework adapters actually do.

---

## The three-layer model

Pathwrite has three distinct concepts, and it is important to keep them separate in your mind before writing any code.

**PathDefinition** is pure data describing a process. It is a plain TypeScript object with an ID, an ordered array of steps, and optional lifecycle callbacks. A definition has no runtime state, no mutable fields, and no framework imports. It describes *what the rules are* — which fields are required on each step, which steps can be skipped, what should happen when the flow completes — but it knows nothing about where those rules are being executed. A `PathDefinition` is as inert as a JSON schema; you can construct one at module load time, export it from a shared package, and import it into a test runner, a Node.js server, or a React component with equal ease.

**PathEngine** is the runtime state machine that consumes that definition. When you call `engine.start(myPath, initialData)`, the engine takes ownership of the definition and begins tracking mutable state: the current step index, the accumulated data object, visited step IDs, and the progress of any running async hook. The engine processes action calls (`next()`, `previous()`, `setData()`) and manages the step lifecycle — running guards, executing hooks, merging data patches, and emitting events. There is one engine instance per active flow.

**PathSnapshot** is an immutable value object representing the complete state of the engine at a single point in time. Every time something changes inside the engine, it produces a new snapshot and notifies subscribers. A snapshot tells you exactly what is true right now: which step is active, whether moving forward or backward is allowed, what data has been collected, what field errors exist, what the engine's operational status is. Snapshots are never mutated — the engine replaces them. Your UI reads a snapshot and renders from it; it never reaches into the engine's internals.

The relationship looks like this:

```
PathDefinition  →  PathEngine  →  PathSnapshot
   (your rules)     (the runtime)    (the current state)
        ↑                                    ↓
   pure TypeScript             framework adapter re-renders UI
```

If you write code professionally, you already have an analogy for this model:

| Pathwrite | Analogy |
|---|---|
| `PathDefinition` | Source code — inert, declarative, describes what should happen |
| `PathEngine` | Interpreter — reads the source and executes it |
| `PathSnapshot` | Program state — the current position, variables, and values held in memory |
| Adapters | Interface — tools that surface program state to a human (debugger, UI layer) |

Source code does nothing on its own. An interpreter reads it and executes it. At any point in time the interpreter holds program state. Tools like debuggers and UI layers surface that state to humans. The mapping is exact.

---

## What "headless" means in practice

"Headless" is often used loosely to mean "unstyled." In Pathwrite it means something more specific: the engine has no dependency on HTML, the DOM, or any UI framework. It imports nothing from React, Vue, Angular, Svelte, or SolidJS. It does not call `document.querySelector`, set CSS classes, or interact with a browser in any way.

This is not a marketing claim — it is an architectural constraint enforced by the package boundaries. `@daltonr/pathwrite-core` has zero runtime dependencies. It runs identically in a browser, a Vitest test suite, a Node.js server, or a React Native environment. You can import `PathEngine` and call `engine.start()`, `engine.next()`, and `engine.subscribe()` in plain TypeScript with no DOM present.

The practical consequence is that the shape of your UI — whether you use buttons or swipe gestures, whether you show a progress bar or a sidebar, whether you use a component library or raw HTML — is entirely decoupled from the engine's logic. The engine does not know or care. It only knows about steps, guards, hooks, and data.

---

## The subscribe/snapshot contract

The engine is not reactive by itself. It does not push state into React's `useState` or Vue's `ref`. Instead, it follows the observer pattern: you subscribe to events, and the engine calls your callback whenever something changes. This is the same contract implemented by Redux, Zustand, and other framework-agnostic state libraries.

Here is the engine running in pure TypeScript — no framework, no component:

```typescript
import { PathEngine, PathDefinition } from "@daltonr/pathwrite-core";

interface SignupData {
  name: string;
  email: string;
}

const signupPath: PathDefinition<SignupData> = {
  id: "signup",
  steps: [
    {
      id: "name",
      fieldErrors: ({ data }) => ({
        name: !data.name?.trim() ? "Name is required." : undefined,
      }),
    },
    {
      id: "email",
      fieldErrors: ({ data }) => ({
        email: !data.email?.includes("@") ? "Valid email required." : undefined,
      }),
    },
    { id: "review" },
  ],
  onComplete: (data) => {
    console.log("Signup complete:", data);
  },
};

const engine = new PathEngine();

const unsubscribe = engine.subscribe((event) => {
  if (event.type === "stateChanged") {
    const snap = event.snapshot;
    console.log(`Step: ${snap.stepId} (${snap.stepIndex + 1}/${snap.stepCount})`);
    console.log(`canMoveNext: ${snap.canMoveNext}`);
  }
  if (event.type === "completed") {
    console.log("Done. Final data:", event.data);
    unsubscribe();
  }
});

await engine.start(signupPath, { name: "", email: "" });
// → Step: name (1/3), canMoveNext: false

await engine.setData("name", "Alice");
// → Step: name (1/3), canMoveNext: true

await engine.next();
// → Step: email (2/3), canMoveNext: false

await engine.setData("email", "alice@example.com");
await engine.next();
// → Step: review (3/3), canMoveNext: true

await engine.next();
// → Done. Final data: { name: "Alice", email: "alice@example.com" }
```

Notice that nothing here is React-specific. The engine emits events; your callback receives them; you do whatever you like with the snapshot. Framework adapters are built on exactly this foundation.

---

## Why the definition is pure data

Because `PathDefinition` has no framework imports and no runtime state, it can live in its own module — or its own npm package — completely separate from any UI code. This is not just possible; it is the intended pattern.

A definition that lives independently can be:

- **Versioned separately** from the UI that renders it, so you can ship logic changes without touching components
- **Tested without mounting anything** — call the engine directly in Vitest and assert on snapshots
- **Consumed by any adapter** — the same definition object runs identically under `@daltonr/pathwrite-react`, `@daltonr/pathwrite-vue`, `@daltonr/pathwrite-svelte`, `@daltonr/pathwrite-angular`, `@daltonr/pathwrite-solid`, or `@daltonr/pathwrite-react-native`
- **Shared across products** — a business rule definition can be an internal package imported by a web app, a mobile app, and a backend worker simultaneously

This idea — extracting `PathDefinition` into a versioned, independently-testable package — is developed fully in Chapter 10.

---

## The adapter's job

Each framework adapter does exactly one thing: subscribe to a `PathEngine` and expose its snapshot using the framework's native reactive primitive.

| Adapter | Reactive primitive |
|---|---|
| `@daltonr/pathwrite-react` | `useSyncExternalStore` |
| `@daltonr/pathwrite-vue` | `shallowRef` |
| `@daltonr/pathwrite-angular` | `BehaviorSubject` + Signal |
| `@daltonr/pathwrite-svelte` | `$state` rune |
| `@daltonr/pathwrite-solid` | `createSignal` accessor |

That is the entire implementation. No additional logic, no transformation of the data, no framework-specific concepts introduced into the engine. The adapter subscribes, receives snapshots, and writes them into whatever reactive slot the framework provides. When a snapshot arrives, the framework's own change-detection does the rest.

This is why all adapters have the same API shape — `start()`, `next()`, `previous()`, `setData()`, `goToStep()` — despite being written for completely different reactive systems. Those methods delegate directly to `PathEngine`. The adapter adds no surface area of its own.

> **Angular:** `PathFacade` is the Angular equivalent of `usePath()`. It exposes the snapshot as both an `Observable<PathSnapshot>` (for use in templates with `async` pipe) and a pre-wired Signal (for use in computed values and effects).
>
> **Vue:** `usePath()` returns the snapshot as a `shallowRef`. The ref is replaced — not mutated — on each engine event, so Vue's reactivity tracks changes at the snapshot level rather than deep-watching individual properties.
>
> **Svelte:** The Svelte adapter stores the snapshot in a `$state` rune. All the same action methods are available as functions returned from `usePath()`.

---

## The complete picture

Put it all together and the data flow is a closed loop:

1. You write a `PathDefinition` — a plain TypeScript object describing rules.
2. You start the engine with that definition and initial data.
3. The engine produces a snapshot and notifies subscribers.
4. The adapter writes the snapshot into the framework's reactivity system.
5. Your component reads the snapshot and renders UI.
6. The user interacts; your component calls `setData()`, `next()`, or `previous()`.
7. The engine processes the action, produces a new snapshot, and notifies subscribers again.
8. The cycle repeats.

The engine never reaches up into the UI. The UI never reaches into the engine's internals. The adapter is the only coupling point, and it is provided for you.

Chapter 2 covers how adapters work and how to use `PathShell` and `usePath` in your framework. Chapter 3 covers the `PathDefinition` in detail — the full set of step properties, validation hooks, lifecycle callbacks, and the `StepChoice` pattern for conditional form variants.

© 2026 Devjoy Ltd. MIT License.
