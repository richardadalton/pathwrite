# @daltonr/pathwrite-react

React hooks over `@daltonr/pathwrite-core`. Exposes path state as reactive React state via `useSyncExternalStore`, with stable action callbacks and an optional context provider.

## Setup

### Option A — `usePath` hook (component-scoped)

Each call to `usePath` creates an isolated path engine instance.

```tsx
import { usePath } from "@daltonr/pathwrite-react";

function MyPathHost() {
  const { snapshot, start, next, previous, cancel, setData } = usePath({
    onEvent(event) {
      console.log(event);
    }
  });

  return (
    <div>
      {snapshot ? (
        <>
          <h2>{snapshot.stepTitle ?? snapshot.stepId}</h2>
          <p>Step {snapshot.stepIndex + 1} of {snapshot.stepCount}</p>
          <button onClick={previous} disabled={snapshot.isNavigating}>Back</button>
          <button onClick={next}     disabled={snapshot.isNavigating}>
            {snapshot.isLastStep ? "Finish" : "Next"}
          </button>
          <button onClick={cancel}>Cancel</button>
        </>
      ) : (
        <button onClick={() => start(myPath)}>Start Path</button>
      )}
    </div>
  );
}
```

### Option B — `PathProvider` + `usePathContext` (shared across components)

Wrap a subtree so that multiple components can read and drive the same path instance.

```tsx
import { PathProvider, usePathContext } from "@daltonr/pathwrite-react";

function App() {
  return (
    <PathProvider onEvent={(e) => console.log(e)}>
      <StepDisplay />
      <NavButtons />
    </PathProvider>
  );
}

function StepDisplay() {
  const { snapshot } = usePathContext();
  if (!snapshot) return <p>No path running.</p>;
  return <h2>{snapshot.stepTitle ?? snapshot.stepId}</h2>;
}

function NavButtons() {
  const { snapshot, next, previous } = usePathContext();
  if (!snapshot) return null;
  return (
    <>
      <button onClick={previous}>Back</button>
      <button onClick={next}>Next</button>
    </>
  );
}
```

## `usePath` API

### Options

| Option | Type | Description |
|--------|------|-------------|
| `onEvent` | `(event: PathEvent) => void` | Called for every engine event. The callback ref is kept current — changing it does **not** re-subscribe to the engine. |

### Return value

| Property | Type | Description |
|----------|------|-------------|
| `snapshot` | `PathSnapshot \| null` | Current snapshot. `null` when no path is active. Triggers a React re-render on change. |
| `start(definition, data?)` | `function` | Start or re-start a path. |
| `startSubPath(definition, data?)` | `function` | Push a sub-path. Requires an active path. |
| `next()` | `function` | Advance one step. Completes the path on the last step. |
| `previous()` | `function` | Go back one step. No-op when already on the first step of a top-level path. |
| `cancel()` | `function` | Cancel the active path (or sub-path). |
| `goToStep(stepId)` | `function` | Jump directly to a step by ID. Calls `onLeave` / `onEnter` but bypasses guards and `shouldSkip`. |
| `goToStepChecked(stepId)` | `function` | Jump to a step by ID, checking `canMoveNext` (forward) or `canMovePrevious` (backward) first. Navigation is blocked if the guard returns false. |
| `setData(key, value)` | `function` | Update a single data value; triggers re-render via `stateChanged`. When `TData` is specified, `key` and `value` are type-checked against your data shape. |

All action callbacks are **referentially stable** — safe to pass as props or include in dependency arrays without causing unnecessary re-renders.

### Typed snapshot data

`usePath` and `usePathContext` accept an optional generic so that `snapshot.data` is typed:

```tsx
interface FormData extends PathData {
  name: string;
  age: number;
}

const { snapshot } = usePath<FormData>();
snapshot?.data.name;  // string
snapshot?.data.age;   // number
```

The generic is a **type-level assertion** — it narrows `snapshot.data` for convenience but is not enforced at runtime. Define your data shape once in a `PathDefinition<FormData>` and the types will stay consistent throughout.

`setData` is also typed against `TData` — passing a wrong key or mismatched value type is a compile-time error:

```tsx
setData("name", 42);     // ✗ TS error: number is not assignable to string
setData("typo", "x");    // ✗ TS error: "typo" is not a key of FormData
setData("name", "Alice"); // ✓
```

### Snapshot guard booleans

The snapshot includes `canMoveNext` and `canMovePrevious` — the evaluated results of the current step's navigation guards. Use them to proactively disable buttons:

```tsx
<button onClick={previous} disabled={snapshot.isNavigating || !snapshot.canMovePrevious}>Back</button>
<button onClick={next}     disabled={snapshot.isNavigating || !snapshot.canMoveNext}>Next</button>
```

These update automatically when data changes (e.g. after `setData`). Async guards default to `true` optimistically.

## Context sharing

### `PathProvider` + `usePathContext`

Wrap a subtree in `<PathProvider>` so multiple components share the same engine instance. Consume with `usePathContext()`.

---

## Default UI — `PathShell`

`<PathShell>` is a ready-made shell component that renders a progress indicator, step content, and navigation buttons. Pass a `steps` map to define per-step content.

```tsx
import { PathShell } from "@daltonr/pathwrite-react";

<PathShell
  path={myPath}
  initialData={{ name: "" }}
  onComplete={(data) => console.log("Done!", data)}
  steps={{
    details: <DetailsForm />,
    review:  <ReviewPanel />,
  }}
/>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `path` | `PathDefinition` | *required* | The path to run. |
| `steps` | `Record<string, ReactNode>` | *required* | Map of step ID → content to render. |
| `initialData` | `PathData` | `{}` | Initial data passed to `engine.start()`. |
| `autoStart` | `boolean` | `true` | Start the path automatically on mount. |
| `onComplete` | `(data: PathData) => void` | — | Called when the path completes. |
| `onCancel` | `(data: PathData) => void` | — | Called when the path is cancelled. |
| `onEvent` | `(event: PathEvent) => void` | — | Called for every engine event. |
| `backLabel` | `string` | `"Back"` | Back button label. |
| `nextLabel` | `string` | `"Next"` | Next button label. |
| `finishLabel` | `string` | `"Finish"` | Finish button label (last step). |
| `cancelLabel` | `string` | `"Cancel"` | Cancel button label. |
| `hideCancel` | `boolean` | `false` | Hide the Cancel button. |
| `hideProgress` | `boolean` | `false` | Hide the progress indicator. |
| `className` | `string` | — | Extra CSS class on the root element. |
| `renderHeader` | `(snapshot) => ReactNode` | — | Render prop to replace the progress header. |
| `renderFooter` | `(snapshot, actions) => ReactNode` | — | Render prop to replace the navigation footer. |

### Customising the header and footer

Use `renderHeader` and `renderFooter` to replace the built-in progress bar or navigation buttons with your own UI. Both receive the current `PathSnapshot`; `renderFooter` also receives a `PathShellActions` object with all navigation callbacks.

```tsx
<PathShell
  path={myPath}
  steps={{ details: <DetailsForm />, review: <ReviewPanel /> }}
  renderHeader={(snapshot) => (
    <p>{snapshot.stepIndex + 1} / {snapshot.stepCount} — {snapshot.stepTitle}</p>
  )}
  renderFooter={(snapshot, actions) => (
    <div>
      <button onClick={actions.previous} disabled={snapshot.isFirstStep}>Back</button>
      <button onClick={actions.next}     disabled={!snapshot.canMoveNext}>
        {snapshot.isLastStep ? "Finish" : "Next"}
      </button>
    </div>
  )}
/>
```

`PathShellActions` contains: `next`, `previous`, `cancel`, `goToStep`, `goToStepChecked`, `setData`.

### Context sharing

`<PathShell>` provides a path context automatically — step components rendered inside it can call `usePathContext()` without a separate `<PathProvider>`:

```tsx
function DetailsForm() {
  const { snapshot, setData } = usePathContext();
  return (
    <input
      value={String(snapshot?.data.name ?? "")}
      onChange={(e) => setData("name", e.target.value)}
    />
  );
}

<PathShell
  path={myPath}
  initialData={{ name: "" }}
  onComplete={handleDone}
  steps={{ details: <DetailsForm />, review: <ReviewPanel /> }}
/>
```

---

## Styling

`<PathShell>` renders structural HTML with BEM-style `pw-shell__*` CSS classes but ships with no embedded styles. Import the optional stylesheet for sensible defaults:

```ts
import "@daltonr/pathwrite-react/styles.css";
```

All visual values are CSS custom properties (`--pw-*`), so you can theme without overriding selectors:

```css
:root {
  --pw-color-primary: #8b5cf6;
  --pw-shell-radius: 12px;
}
```

---

## Design notes

- **`useSyncExternalStore`** — the hook subscribes to the core `PathEngine` using React 18's `useSyncExternalStore`, giving tear-free reads with no `useEffect` timing gaps.
- **Ref-based callback** — `onEvent` is stored in a ref so that a new closure on every render does not cause a re-subscription.
- **No RxJS** — unlike the Angular adapter, there is no RxJS dependency. The hook is pure React.

