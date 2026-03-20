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
| `previous()` | `function` | Go back one step. Cancels the path from the first step. |
| `cancel()` | `function` | Cancel the active path (or sub-path). |
| `goToStep(stepId)` | `function` | Jump directly to a step by ID. Calls `onLeave` / `onEnter` but bypasses guards and `shouldSkip`. |
| `setData(key, value)` | `function` | Update a single data value; triggers re-render via `stateChanged`. |

All action callbacks are **referentially stable** — safe to pass as props or include in dependency arrays without causing unnecessary re-renders.

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

### `PathShell` context

`<PathShell>` also provides context automatically. Step children rendered inside `<PathShell>` can call `usePathContext()` without a separate `<PathProvider>`:

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

<PathShell path={myPath} initialData={{ name: "" }} onComplete={handleDone}>
  <PathStep id="details"><DetailsForm /></PathStep>
  <PathStep id="review"><ReviewPanel /></PathStep>
</PathShell>
```

## Design notes

- **`useSyncExternalStore`** — the hook subscribes to the core `PathEngine` using React 18's `useSyncExternalStore`, giving tear-free reads with no `useEffect` timing gaps.
- **Ref-based callback** — `onEvent` is stored in a ref so that a new closure on every render does not cause a re-subscription.
- **No RxJS** — unlike the Angular adapter, there is no RxJS dependency. The hook is pure React.

