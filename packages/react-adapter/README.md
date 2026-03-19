# @pathwrite/react-adapter

React hooks over `@pathwrite/core`. Exposes wizard state as reactive React state via `useSyncExternalStore`, with stable action callbacks and an optional context provider.

## Setup

### Option A — `useWizard` hook (component-scoped)

Each call to `useWizard` creates an isolated wizard engine instance.

```tsx
import { useWizard } from "@pathwrite/react-adapter";

function MyWizardHost() {
  const { snapshot, start, next, previous, cancel, setArg } = useWizard({
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
          <button onClick={previous} disabled={snapshot.isFirstStep}>Back</button>
          <button onClick={next}>{snapshot.isLastStep ? "Finish" : "Next"}</button>
          <button onClick={cancel}>Cancel</button>
        </>
      ) : (
        <button onClick={() => start(myWizard)}>Start Wizard</button>
      )}
    </div>
  );
}
```

### Option B — `WizardProvider` + `useWizardContext` (shared across components)

Wrap a subtree so that multiple components can read and drive the same wizard instance.

```tsx
import { WizardProvider, useWizardContext } from "@pathwrite/react-adapter";

function App() {
  return (
    <WizardProvider onEvent={(e) => console.log(e)}>
      <StepDisplay />
      <NavButtons />
    </WizardProvider>
  );
}

function StepDisplay() {
  const { snapshot } = useWizardContext();
  if (!snapshot) return <p>No wizard running.</p>;
  return <h2>{snapshot.stepTitle ?? snapshot.stepId}</h2>;
}

function NavButtons() {
  const { snapshot, next, previous } = useWizardContext();
  if (!snapshot) return null;
  return (
    <>
      <button onClick={previous}>Back</button>
      <button onClick={next}>Next</button>
    </>
  );
}
```

## `useWizard` API

### Options

| Option | Type | Description |
|--------|------|-------------|
| `onEvent` | `(event: WizardEngineEvent) => void` | Called for every engine event. The callback ref is kept current — changing it does **not** re-subscribe to the engine. |

### Return value

| Property | Type | Description |
|----------|------|-------------|
| `snapshot` | `WizardSnapshot \| null` | Current snapshot. `null` when no wizard is active. Triggers a React re-render on change. |
| `start(definition, initialArgs?)` | `function` | Start or re-start a wizard. |
| `startSubWizard(definition, args?)` | `function` | Push a sub-wizard. Requires an active wizard. |
| `next()` | `function` | Advance one step. Completes the wizard on the last step. |
| `previous()` | `function` | Go back one step. Cancels the wizard from the first step. |
| `cancel()` | `function` | Cancel the active wizard (or sub-wizard). |
| `goToStep(stepId)` | `function` | Jump directly to a step by ID. Calls `onLeavingStep` / `onVisit` but bypasses guards and `shouldSkip`. |
| `setArg(key, value)` | `function` | Update a single arg; triggers re-render via `stateChanged`. |

All action callbacks are **referentially stable** — safe to pass as props or include in dependency arrays without causing unnecessary re-renders.

## Design notes

- **`useSyncExternalStore`** — the hook subscribes to the core `WizardEngine` using React 18's `useSyncExternalStore`, giving tear-free reads with no `useEffect` timing gaps.
- **Ref-based callback** — `onEvent` is stored in a ref so that a new closure on every render does not cause a re-subscription.
- **No RxJS** — unlike the Angular adapter, there is no RxJS dependency. The hook is pure React.

