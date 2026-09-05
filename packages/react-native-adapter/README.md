# @daltonr/pathwrite-react-native

React Native adapter for Pathwrite — exposes path engine state via `useSyncExternalStore` with stable callbacks, an optional context provider, and an optional `PathShell` default UI built from React Native primitives.

## Installation

```bash
npm install @daltonr/pathwrite-core @daltonr/pathwrite-react-native
```

Peer dependencies: `react-native >= 0.72.0`, `react >= 18.0.0`

---

## Quick start

```tsx
import { PathShell, usePathContext } from "@daltonr/pathwrite-react-native";
import type { PathDefinition, PathData } from "@daltonr/pathwrite-core";
import { View, Text, TextInput, TouchableOpacity } from "react-native";

interface SignupData extends PathData {
  name: string;
}

const signupPath: PathDefinition<SignupData> = {
  id: "signup",
  steps: [
    { id: "details", title: "Your Details", canMoveNext: ({ data }) => data.name.trim().length >= 2 },
    { id: "review",  title: "Review" },
  ],
};

function DetailsStep() {
  const { snapshot, setData } = usePathContext<SignupData>();
  if (!snapshot) return null;
  return (
    <TextInput
      value={snapshot.data.name}
      onChangeText={(text) => setData("name", text)}
      placeholder="Your name"
    />
  );
}

function ReviewStep() {
  const { snapshot } = usePathContext<SignupData>();
  if (!snapshot) return null;
  return <Text>Signing up as {snapshot.data.name}</Text>;
}

export function SignupFlow() {
  return (
    <PathShell
      path={signupPath}
      initialData={{ name: "" }}
      onComplete={(data) => console.log("Done!", data)}
      steps={{ details: <DetailsStep />, review: <ReviewStep /> }}
    />
  );
}
```

Step components call `usePathContext()` to access engine state — no prop drilling needed. `<PathShell>` provides the context automatically.

---

## Metro config

Metro does not follow symlinks by default, so workspace packages installed above the app root are invisible to the bundler. This is the most common setup issue when using Pathwrite in a monorepo. Create or update `metro.config.js` in your React Native or Expo app:

```js
// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
// For bare React Native: const { getDefaultConfig } = require("@react-native/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../../..");  // adjust depth to your repo

const config = getDefaultConfig(projectRoot);

// 1. Watch workspace source files outside the app root.
config.watchFolders = [workspaceRoot];

// 2. Map package names directly to their source directories.
config.resolver.extraNodeModules = {
  "@daltonr/pathwrite-core":         path.resolve(workspaceRoot, "packages/core"),
  "@daltonr/pathwrite-react-native": path.resolve(workspaceRoot, "packages/react-native-adapter"),
  // Add any other workspace packages your app imports here.
};

// 3. Restrict node_modules lookup to the app's own folder.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
];

// 4. Pin react/react-native/scheduler to the app's own copies.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === "react"        || moduleName.startsWith("react/")        ||
    moduleName === "react-native" || moduleName.startsWith("react-native/") ||
    moduleName === "scheduler"    || moduleName.startsWith("scheduler/")
  ) {
    try {
      return { filePath: require.resolve(moduleName, { paths: [projectRoot] }), type: "sourceFile" };
    } catch { /* fall through */ }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
```

Every new workspace package your app imports must be added to `extraNodeModules`. After changing this file, restart Metro with `npx expo start --clear` (or `npx react-native start --reset-cache` for bare RN).

---

## usePath / PathShell

The API is identical to `@daltonr/pathwrite-react`. `usePath` creates an engine instance scoped to the calling component; `usePathContext` reads the nearest `PathShell` or `PathProvider` ancestor.

### usePath return value

| Field | Type | Description |
|---|---|---|
| `snapshot` | `PathSnapshot \| null` | Current state. `null` when no path is active or when `completionBehaviour: "dismiss"` is used. With the default `"stayOnFinal"`, a non-null snapshot with `status === "completed"` is returned after the path finishes. |
| `start(definition, data?)` | function | Start a path. |
| `next()` | function | Advance one step. Completes on the last step. |
| `previous()` | function | Go back one step. |
| `cancel()` | function | Cancel the active path or sub-path. |
| `goToStep(stepId)` | function | Jump to a step by ID, bypassing guards. |
| `goToStepChecked(stepId)` | function | Jump to a step by ID, checking the current step's guard first. |
| `setData(key, value)` | function | Update a single data field. Type-checked when `TData` is provided. |
| `resetStep()` | function | Restore the current step's data to what it was when the step was entered. Emits `stateChanged` with cause `"resetStep"`; no hooks run. |
| `startSubPath(definition, data?, meta?)` | function | Push a sub-path. |
| `restart()` | function | Tear down any active path (without firing hooks) and restart the root path with the `initialData` from the original `start()`. Takes no arguments; throws if nothing has been started. |
| `retry()` | function | Re-run the operation that set `snapshot.error`. Increments `snapshot.error.retryCount` on repeated failure. No-op when there is no pending error. |
| `suspend()` | function | Pause the path with intent to return. Emits `suspended`; all state and data are preserved. |
| `validate()` | function | Set `snapshot.hasValidated` without navigating. Triggers all inline field errors simultaneously. Used to validate all tabs in a nested shell at once. |

All returned callbacks are referentially stable.

### PathShell props

| Prop | Type | Default | Description |
|---|---|---|---|
| `path` | `PathDefinition` | required | The path to drive. |
| `steps` | `Record<string, ReactNode>` | required | Map of step ID to content. Keys must exactly match step IDs. |
| `initialData` | `PathData` | `{}` | Initial data passed to `engine.start()`. Overridden by the stored snapshot when `restoreKey` is set. |
| `engine` | `PathEngine` | — | Externally-managed engine (e.g. from `restoreOrStart()`). When provided, `PathShell` skips its own `start()`. May be provided after mount (e.g. once an async `restoreOrStart()` resolves): the shell adopts it, re-subscribing and re-seeding from the new engine. Set `autoStart` to `false` if the shell should not start its own path in the meantime. |
| `autoStart` | `boolean` | `true` | Start the path automatically on mount. |
| `onComplete` | `(data: PathData) => void` | — | Called when the path completes. |
| `onCancel` | `(data: PathData) => void` | — | Called when the path is cancelled. |
| `onEvent` | `(event: PathEvent) => void` | — | Called for every engine event. |
| `backLabel` | `string` | `"Previous"` | Label for the back button. |
| `nextLabel` | `string` | `"Next"` | Label for the next button. |
| `completeLabel` | `string` | `"Complete"` | Label for the next button on the last step. |
| `loadingLabel` | `string` | `undefined` | Label for the Next/Complete button while an async operation is in progress. When unset, an `ActivityIndicator` spinner is shown instead. |
| `cancelLabel` | `string` | `"Cancel"` | Label for the cancel button. |
| `hideCancel` | `boolean` | `false` | Hide the cancel button. |
| `hideProgress` | `boolean` | `false` | Hide the progress header. Also hidden automatically for single-step paths. |
| `hideFooter` | `boolean` | `false` | Hide the footer (navigation buttons). The error panel is still shown on async failure. |
| `disableBodyScroll` | `boolean` | `false` | Replace the `ScrollView` body with a plain `View`. Use when a step contains a `FlatList` or other virtualized list. |
| `keyboardVerticalOffset` | `number` | `0` | Passed to the internal `KeyboardAvoidingView`. Set it to the height of any header or navigation bar above the shell (e.g. a React Navigation header). |
| `layout` | `"wizard" \| "form" \| "auto" \| "tabs"` | `"auto"` | `"wizard"`: Back on left, Cancel+Submit on right. `"form"`: Cancel on left, Submit on right, no Back. `"tabs"`: No progress header or footer — for tabbed interfaces. `"auto"` picks `"form"` for single-step paths. |
| `validationDisplay` | `"summary" \| "inline" \| "both"` | `"summary"` | Where `fieldErrors` are rendered. Use `"inline"` so step components render their own errors. |
| `renderHeader` | `(snapshot) => ReactNode` | — | Replace the default progress header entirely. A custom header is shown even for single-step paths, and hidden under `hideProgress` or `layout="tabs"`. |
| `renderFooter` | `(snapshot, actions) => ReactNode` | — | Replace the default navigation buttons. `actions` contains `next`, `previous`, `cancel`, `goToStep`, `goToStepChecked`, `setData`, `restart`, `retry`, `suspend`. |
| `completionContent` | `ReactNode` | — | Custom content rendered when `snapshot.status === "completed"` (`completionBehaviour: "stayOnFinal"`). If omitted, a default "All done." panel is shown. |
| `style` | `StyleProp<ViewStyle>` | — | Override for the root `View`. |
| `validateWhen` | `boolean` | `false` | When `true` (including already at mount), calls `validate()` on the engine so all steps show inline errors at once. Bind to the outer snapshot's `hasAttemptedNext` when this shell is nested inside a step of an outer shell. |
| `restoreKey` | `string` | — | When set, the shell automatically saves its full state (data + active step) into the nearest outer `PathShell`'s data under this key on every change, and restores from it on remount. No-op on a top-level shell. The stored value also carries the inner engine's serialized state, so a remount restores in place: no `onEnter` / `onLeave` re-run, attempted / visited state kept. |
| `services` | `unknown` | — | Arbitrary services object available to step components via `usePathContext<TData, TServices>().services`. |

The default footer's Next/Complete button is never disabled because `canMoveNext` is false — only while the engine is busy (`status !== "idle"`). Tapping it on an invalid step runs `next()`, which marks the step as attempted and surfaces `fieldErrors` without navigating.

`PathEngine` is re-exported from this package as a **type only**; import the class from `@daltonr/pathwrite-core` when you need to construct one.

### PathShellHandle and the restart() ref pattern

`PathShell` is a `forwardRef` component that exposes a `PathShellHandle`. Use a ref to call `restart()` imperatively from outside the shell — for example, from a parent screen's header button:

```tsx
import { useRef } from "react";
import { Button } from "react-native";
import { PathShell, type PathShellHandle } from "@daltonr/pathwrite-react-native";

export function OnboardingScreen() {
  const shellRef = useRef<PathShellHandle>(null);

  return (
    <>
      <Button title="Start over" onPress={() => shellRef.current?.restart()} />
      <PathShell
        ref={shellRef}
        path={myPath}
        initialData={{ name: "" }}
        onComplete={(data) => console.log(data)}
        steps={{ name: <NameStep /> }}
      />
    </>
  );
}
```

`restart()` takes no arguments — it restarts the shell's path with its original `initialData` without unmounting.

---

## Further reading

- [React Native getting started guide](../../docs/getting-started/frameworks/react-native.md)
- [Navigation guide](../../docs/developer-guide/04-navigation.md)
- [Full docs](../../docs/README.md)

---

© 2026 Devjoy Ltd. MIT License.
