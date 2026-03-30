# @daltonr/pathwrite-react-native

React Native adapter for Pathwrite — exposes path engine state via `useSyncExternalStore` with stable callbacks, an optional context provider, and an optional `PathShell` default UI built from React Native primitives.

## Installation

```bash
npm install @daltonr/pathwrite-core @daltonr/pathwrite-react-native
```

Peer dependencies: `react-native >= 0.73.0`, `react >= 18.0.0`

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
| `resetStep()` | function | Restore data to step-entry state. |
| `startSubPath(definition, data?, meta?)` | function | Push a sub-path. |
| `restart(definition, data?)` | function | Tear down any active path and start fresh. |

All returned callbacks are referentially stable.

### PathShell props

| Prop | Type | Default | Description |
|---|---|---|---|
| `path` | `PathDefinition` | required | The path to drive. |
| `steps` | `Record<string, ReactNode>` | required | Map of step ID to content. Keys must exactly match step IDs. |
| `initialData` | `PathData` | `{}` | Initial data passed to `engine.start()`. |
| `engine` | `PathEngine` | — | Externally-managed engine (e.g. from `restoreOrStart()`). |
| `autoStart` | `boolean` | `true` | Start the path automatically on mount. |
| `onComplete` | `(data: PathData) => void` | — | Called when the path completes. |
| `onCancel` | `(data: PathData) => void` | — | Called when the path is cancelled. |
| `onEvent` | `(event: PathEvent) => void` | — | Called for every engine event. |
| `backLabel` | `string` | `"Previous"` | Label for the back button. |
| `nextLabel` | `string` | `"Next"` | Label for the next button. |
| `completeLabel` | `string` | `"Complete"` | Label for the next button on the last step. |
| `cancelLabel` | `string` | `"Cancel"` | Label for the cancel button. |
| `hideCancel` | `boolean` | `false` | Hide the cancel button. |
| `hideProgress` | `boolean` | `false` | Hide the progress header. Also hidden automatically for single-step paths. |
| `disableBodyScroll` | `boolean` | `false` | Replace the `ScrollView` body with a plain `View`. Use when a step contains a `FlatList` or other virtualized list. |
| `footerLayout` | `"wizard" \| "form" \| "auto"` | `"auto"` | `"wizard"`: Back on left. `"form"`: Cancel on left, no Back. |
| `renderHeader` | `(snapshot) => ReactNode` | — | Replace the default progress header entirely. |
| `renderFooter` | `(snapshot, actions) => ReactNode` | — | Replace the default navigation buttons. |
| `completionContent` | `ReactNode` | — | Custom content rendered when `snapshot.status === "completed"` (`completionBehaviour: "stayOnFinal"`). If omitted, a default "All done." panel is shown. |
| `style` | `StyleProp<ViewStyle>` | — | Override for the root `View`. |

### PathShellHandle and the restart() ref pattern

`PathShell` is a `forwardRef` component that exposes a `PathShellHandle`. Use a ref to call `restart()` imperatively from outside the shell — for example, from a parent screen's header button:

```tsx
import { useRef } from "react";
import { PathShell, PathShellHandle } from "@daltonr/pathwrite-react-native";

export function OnboardingScreen() {
  const shellRef = useRef<PathShellHandle>(null);

  return (
    <PathShell
      ref={shellRef}
      path={myPath}
      initialData={{ name: "" }}
      onComplete={(data) => console.log(data)}
      steps={{ name: <NameStep /> }}
    />
  );
}
```

---

## Further reading

- [React Native getting started guide](../../docs/getting-started/frameworks/react-native.md)
- [Navigation guide](../../docs/guides/navigation.md)
- [Full docs](../../docs/README.md)

---

© 2026 Devjoy Ltd. MIT License.
