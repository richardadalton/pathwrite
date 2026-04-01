# @daltonr/pathwrite-react

React adapter for Pathwrite — exposes path engine state as React state via `useSyncExternalStore`, with stable action callbacks and an optional context provider.

## Installation

```bash
npm install @daltonr/pathwrite-core @daltonr/pathwrite-react
```

Peer dependencies: React 18+

---

## Quick start

```tsx
import { PathShell, usePathContext } from "@daltonr/pathwrite-react";
import type { PathDefinition, PathData } from "@daltonr/pathwrite-core";

interface SignupData extends PathData {
  name: string;
  email: string;
}

const signupPath: PathDefinition<SignupData> = {
  id: "signup",
  steps: [
    { id: "details", title: "Your Details" },
    { id: "review",  title: "Review" },
  ],
};

function DetailsStep() {
  const { snapshot, setData } = usePathContext<SignupData>();
  if (!snapshot) return null;
  return (
    <div>
      <input value={snapshot.data.name} onChange={(e) => setData("name", e.target.value)} placeholder="Name" />
      <input value={snapshot.data.email} onChange={(e) => setData("email", e.target.value)} placeholder="Email" />
    </div>
  );
}

function ReviewStep() {
  const { snapshot } = usePathContext<SignupData>();
  if (!snapshot) return null;
  return <p>Signing up as {snapshot.data.name} ({snapshot.data.email})</p>;
}

export function SignupFlow() {
  return (
    <PathShell
      path={signupPath}
      initialData={{ name: "", email: "" }}
      onComplete={(data) => console.log("Done!", data)}
      steps={{
        details: <DetailsStep />,
        review:  <ReviewStep />,
      }}
    />
  );
}
```

Step components call `usePathContext()` to access engine state — no prop drilling needed. `<PathShell>` provides the context automatically.

---

## usePath

`usePath<TData, TServices>()` creates an isolated path engine instance scoped to the calling component. Use it when you need manual control over the shell UI.

| Return value | Type | Description |
|---|---|---|
| `snapshot` | `PathSnapshot \| null` | Current snapshot. `null` when no path is active or when `completionBehaviour: "dismiss"` is used. With the default `"stayOnFinal"`, a non-null snapshot with `status === "completed"` is returned after the path finishes. Triggers re-render on change. |
| `start(definition, data?)` | function | Start or re-start a path. |
| `next()` | function | Advance one step. Completes the path on the last step. |
| `previous()` | function | Go back one step. No-op on the first step of a top-level path. |
| `cancel()` | function | Cancel the active path or sub-path. |
| `goToStep(stepId)` | function | Jump to a step by ID, bypassing guards and `shouldSkip`. |
| `goToStepChecked(stepId)` | function | Jump to a step by ID, checking the relevant navigation guard first. |
| `setData(key, value)` | function | Update a single data field. Type-checked when `TData` is provided. |
| `resetStep()` | function | Re-run `onEnter` for the current step without changing step index. |
| `startSubPath(definition, data?, meta?)` | function | Push a sub-path. `meta` is echoed back to `onSubPathComplete` / `onSubPathCancel`. |
| `suspend()` | function | Suspend an async step while work completes. |
| `retry()` | function | Retry the current step after a suspension or error. |
| `restart(definition, data?)` | function | Tear down the active path without firing hooks and start fresh. |

All returned callbacks are referentially stable — safe to pass as props or include in `useEffect` dependency arrays.

---

## PathShell props

`<PathShell>` renders a progress indicator, step content, validation messages, and navigation buttons. Step components access engine state via `usePathContext()`.

| Prop | Type | Default | Description |
|---|---|---|---|
| `path` | `PathDefinition` | required | The path to run. |
| `steps` | `Record<string, ReactNode>` | required | Map of step ID to content. Keys must exactly match step IDs. |
| `initialData` | `PathData` | `{}` | Initial data passed to `engine.start()`. |
| `onComplete` | `(data: PathData) => void` | — | Called when the path completes. |
| `onCancel` | `(data: PathData) => void` | — | Called when the path is cancelled. |
| `engine` | `PathEngine` | — | An externally-managed engine. When provided, `PathShell` skips its own `start()`. |
| `validationDisplay` | `"summary" \| "inline" \| "both"` | `"summary"` | Where `fieldErrors` are rendered. Use `"inline"` so step components render their own errors. |
| `loadingLabel` | `string` | `"Loading…"` | Label shown during async step suspension. |
| `layout` | `"wizard" \| "form" \| "auto" \| "tabs"` | `"auto"` | `"wizard"`: Back on left, Cancel+Submit on right. `"form"`: Cancel on left, Submit on right, no Back. `"tabs"`: No progress header or footer — for tabbed interfaces. `"auto"` picks `"form"` for single-step paths. |
| `hideProgress` | `boolean` | `false` | Hide the progress indicator. Also hidden automatically for single-step top-level paths. |
| `services` | `TServices` | — | Services object injected into step lifecycle hooks via `PathStepContext`. |
| `completionContent` | `ReactNode` | — | Custom content rendered when `snapshot.status === "completed"` (requires `completionBehaviour: "stayOnFinal"`, the default). If omitted, a default "All done." panel with a "Start over" button is shown. Components inside `completionContent` can call `usePathContext()` to access `restart` and `snapshot.data`. |

Step components rendered inside `<PathShell>` call `usePathContext()` to read `snapshot` and invoke actions — no prop drilling required.

---

## usePathContext

`usePathContext<TData, TServices>()` reads the engine instance provided by the nearest `<PathShell>` or `<PathProvider>` ancestor. It returns the same shape as `usePath` — `snapshot`, `next`, `previous`, `cancel`, `setData`, and the rest of the action callbacks. Pass your data type as `TData` to get typed access to `snapshot.data` and `setData`; pass `TServices` to type the `services` field on `PathStepContext`. Throws if called outside a provider.

---

## Further reading

- [React getting started guide](../../docs/getting-started/frameworks/react.md)
- [Navigation guide](../../docs/guides/navigation.md)
- [Full docs](../../docs/README.md)

---

© 2026 Devjoy Ltd. MIT License.
