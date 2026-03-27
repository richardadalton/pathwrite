# @daltonr/pathwrite-react-native

React Native adapter for `@daltonr/pathwrite-core`. Exposes path state as reactive React state via `useSyncExternalStore`, with stable action callbacks, an optional context provider, and an optional `PathShell` default UI built from React Native primitives.

Works with Expo (managed and bare workflow) and bare React Native projects. Targets iOS and Android.

## Installation

```bash
npm install @daltonr/pathwrite-core @daltonr/pathwrite-react-native
```

Peer dependencies: `react >= 18.0.0`, `react-native >= 0.72.0`.

## Exports

```typescript
import {
  PathShell,         // React Native UI shell
  usePath,           // Hook — creates a scoped engine
  usePathContext,    // Hook — reads the nearest PathProvider
  PathProvider,      // Context provider
  // Core types re-exported for convenience:
  PathEngine,
  PathData,
  PathDefinition,
  PathEvent,
  PathSnapshot,
  PathStep,
  PathStepContext,
  StepChoice,
  SerializedPathState,
} from "@daltonr/pathwrite-react-native";
```

---

## Quick Start — PathShell

The fastest way to get started. `PathShell` manages the engine lifecycle, renders the active step, and provides navigation buttons.

```tsx
import { PathShell } from "@daltonr/pathwrite-react-native";
import { myPath, INITIAL_DATA } from "./my-path";
import { DetailsStep } from "./DetailsStep";
import { ReviewStep } from "./ReviewStep";

export function MyFlow() {
  return (
    <PathShell
      path={myPath}
      initialData={INITIAL_DATA}
      onComplete={(data) => console.log("Done!", data)}
      steps={{
        details: <DetailsStep />,
        review:  <ReviewStep />,
      }}
    />
  );
}
```

Inside step components, use `usePathContext()` to read state and dispatch actions:

```tsx
import { usePathContext } from "@daltonr/pathwrite-react-native";
import type { MyData } from "./my-path";

export function DetailsStep() {
  const { snapshot, setData } = usePathContext<MyData>();
  const name = snapshot?.data.name ?? "";

  return (
    <TextInput
      value={name}
      onChangeText={(text) => setData("name", text)}
      placeholder="Your name"
    />
  );
}
```

---

## Option A — `usePath` hook (component-scoped)

Each call creates an isolated engine. Good when a single screen owns the path.

```tsx
import { usePath } from "@daltonr/pathwrite-react-native";
import { myPath } from "./my-path";

function MyScreen() {
  const { snapshot, start, next, previous, setData } = usePath({
    onEvent(event) {
      if (event.type === "completed") console.log("Done!", event.data);
    }
  });

  useEffect(() => {
    start(myPath, { name: "" });
  }, []);

  if (!snapshot) return null;

  return (
    <View>
      <Text>{snapshot.stepTitle ?? snapshot.stepId}</Text>
      <Text>Step {snapshot.stepIndex + 1} of {snapshot.stepCount}</Text>
      <Pressable onPress={previous} disabled={snapshot.isNavigating}>
        <Text>Back</Text>
      </Pressable>
      <Pressable onPress={next} disabled={snapshot.isNavigating || !snapshot.canMoveNext}>
        <Text>{snapshot.isLastStep ? "Complete" : "Next"}</Text>
      </Pressable>
    </View>
  );
}
```

## Option B — `PathProvider` + `usePathContext` (tree-scoped)

Share one engine across a component tree — step components read state without prop-drilling.

```tsx
import { PathProvider } from "@daltonr/pathwrite-react-native";

// Root — start the path once, then render children
function WizardRoot() {
  const { snapshot, start, next } = usePathContext();
  useEffect(() => { start(myPath, {}); }, []);
  return (
    <View>
      {snapshot && <Text>Step {snapshot.stepIndex + 1}</Text>}
      <Pressable onPress={next}><Text>Next</Text></Pressable>
    </View>
  );
}

// Wrap in the provider at the navigation/screen level
export function WizardScreen() {
  return (
    <PathProvider>
      <WizardRoot />
    </PathProvider>
  );
}
```

---

## Path definition

Path definitions are plain objects — no classes, no decorators, framework-agnostic.

```typescript
import type { PathDefinition } from "@daltonr/pathwrite-react-native";

interface MyData {
  name: string;
  agreed: boolean;
}

export const myPath: PathDefinition<MyData> = {
  id: "onboarding",
  steps: [
    {
      id: "name",
      title: "Your Name",
      canMoveNext: ({ data }) => data.name.trim().length >= 2,
    },
    {
      id: "terms",
      title: "Terms",
      canMoveNext: ({ data }) => data.agreed,
    },
    {
      id: "done",
      title: "All Done",
    },
  ],
};
```

---

## Conditional steps — `shouldSkip`

Steps with a `shouldSkip` guard are removed from the flow when the guard returns `true`. The progress indicator updates automatically.

```typescript
{
  id: "address-details",
  shouldSkip: ({ data }) => data.deliveryMethod !== "postal",
}
```

---

## Conditional forms — `StepChoice`

A `StepChoice` step selects one inner step at runtime based on current data. Useful for showing different form variants without branching the path definition.

```typescript
{
  id: "address",
  select: ({ data }) => data.country === "US" ? "address-us" : "address-ie",
  steps: [
    { id: "address-us", title: "US Address" },
    { id: "address-ie", title: "Irish Address" },
  ],
}
```

The snapshot exposes both `stepId` (the outer choice id, `"address"`) and `formId` (the selected inner step, `"address-us"`). When using `PathShell`, pass both inner step IDs as keys in the `steps` map — the shell resolves the correct one automatically:

```tsx
<PathShell
  path={myPath}
  steps={{
    name:       <NameStep />,
    "address-us": <USAddressStep />,
    "address-ie": <IrishAddressStep />,
    done:       <DoneStep />,
  }}
/>
```

---

## Sub-paths

Push a sub-path onto the stack from within a step. The parent path resumes from the same step when the sub-path completes.

```typescript
const { startSubPath } = usePathContext();

function handleStartSubWizard() {
  startSubPath(subWizardPath, {});
}
```

---

## PathShell props

| Prop | Type | Default | Description |
|---|---|---|---|
| `path` | `PathDefinition` | required | The path to drive. |
| `steps` | `Record<string, ReactNode>` | required | Map of step ID → content. |
| `initialData` | `PathData` | `{}` | Initial data passed to `engine.start()`. |
| `engine` | `PathEngine` | — | Externally managed engine (e.g., from `restoreOrStart()`). |
| `autoStart` | `boolean` | `true` | Start the path automatically on mount. |
| `onComplete` | `(data) => void` | — | Called when the path completes. |
| `onCancel` | `(data) => void` | — | Called when the path is cancelled. |
| `onEvent` | `(event) => void` | — | Called for every engine event. |
| `backLabel` | `string` | `"Previous"` | Label for the back button. |
| `nextLabel` | `string` | `"Next"` | Label for the next button. |
| `completeLabel` | `string` | `"Complete"` | Label for the next button on the last step. |
| `cancelLabel` | `string` | `"Cancel"` | Label for the cancel button. |
| `hideCancel` | `boolean` | `false` | Hide the cancel button. |
| `hideProgress` | `boolean` | `false` | Hide the progress dots/bar. |
| `footerLayout` | `"wizard" \| "form" \| "auto"` | `"auto"` | `"wizard"` puts back on the left; `"form"` puts cancel on the left. |
| `renderHeader` | `(snapshot) => ReactNode` | — | Replace the default progress area. |
| `renderFooter` | `(snapshot, actions) => ReactNode` | — | Replace the default nav buttons. |
| `style` | `StyleProp<ViewStyle>` | — | Override for the root `View`. |

---

## usePath options and return value

```typescript
usePath(options?: {
  engine?: PathEngine;       // Use an externally-managed engine
  onEvent?: (event: PathEvent) => void;
})
```

Returns `UsePathReturn<TData>`:

| Field | Type | Description |
|---|---|---|
| `snapshot` | `PathSnapshot<TData> \| null` | Current state. `null` when no path is active. |
| `start` | `(path, data?) => void` | Start a path. |
| `startSubPath` | `(path, data?, meta?) => void` | Push a sub-path. |
| `next` | `() => void` | Advance. Completes on the last step. |
| `previous` | `() => void` | Go back. |
| `cancel` | `() => void` | Cancel the active path. |
| `goToStep` | `(stepId) => void` | Jump to a step (no guard check). |
| `goToStepChecked` | `(stepId) => void` | Jump to a step (checks current step guard first). |
| `setData` | `(key, value) => void` | Update one data field. |
| `resetStep` | `() => void` | Restore data to step-entry state. |
| `restart` | `(path, data?) => void` | Tear down and restart fresh. |

---

## Testing

Hook tests (`usePath`, `usePathContext`) use `@testing-library/react` in a jsdom environment — no device or simulator required. The hooks are pure React (they use only `useSyncExternalStore`, `useCallback`, `useRef`) and work identically in both RN and web contexts.

PathShell component tests require `@testing-library/react-native` and a React Native test environment (e.g., Jest with `react-native` preset or Expo's Jest preset).
