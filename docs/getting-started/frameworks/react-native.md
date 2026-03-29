# Getting Started — React Native

Pathwrite's React Native adapter exposes path state via `useSyncExternalStore` with stable action callbacks, an optional context provider, and an optional `PathShell` default UI built entirely from React Native primitives (`View`, `Text`, `Pressable`, `ScrollView`). It works with Expo (managed and bare workflow) and bare React Native projects.

## Installation

```bash
npm install @daltonr/pathwrite-core @daltonr/pathwrite-react-native
```

Peer dependencies: `react >= 18.0.0`, `react-native >= 0.72.0`.

```ts
import {
  usePath,
  usePathContext,
  PathProvider,
  PathShell,
  PathEngine,
  PathDefinition,
  PathData,
  PathSnapshot,
  PathEvent,
} from "@daltonr/pathwrite-react-native";
```

---

## Gotcha — Metro config in a monorepo or workspace

Metro does not follow symlinks by default, so workspace packages installed in a parent `node_modules` folder are invisible to the bundler unless you tell it where to look. If you are using Pathwrite in a monorepo (npm/yarn/pnpm workspaces), or if you have installed it in a folder above your app root, you must configure Metro to watch those folders and resolve the packages by their source paths.

Create or update `metro.config.js` in your React Native / Expo app:

```js
// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
// For bare React Native (no Expo), use:
// const { getDefaultConfig } = require("@react-native/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../../..");  // adjust depth to your repo

const config = getDefaultConfig(projectRoot);

// 1. Watch workspace packages so Metro picks up live source changes.
config.watchFolders = [workspaceRoot];

// 2. Map package names to their source directories so Metro resolves them
//    without following symlinks.
config.resolver.extraNodeModules = {
  "@daltonr/pathwrite-core":         path.resolve(workspaceRoot, "packages/core"),
  "@daltonr/pathwrite-react-native": path.resolve(workspaceRoot, "packages/react-native-adapter"),
  // Add any other workspace packages your app imports here.
};

// 3. Pin node_modules resolution to the app's own folder only.
//    Without this, Metro may find conflicting copies of react, react-native,
//    or scheduler from the monorepo root, causing crashes such as
//    "ReactCurrentDispatcher of undefined".
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
];

// 4. Belt-and-suspenders: always resolve react/react-native/scheduler to the
//    app's own copies, regardless of what Metro finds elsewhere.
//    This prevents the root node_modules from supplying an incompatible
//    React version if you have mixed versions across the workspace.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === "react"        || moduleName.startsWith("react/")        ||
    moduleName === "react-dom"    || moduleName.startsWith("react-dom/")    ||
    moduleName === "react-native" || moduleName.startsWith("react-native/") ||
    moduleName === "scheduler"    || moduleName.startsWith("scheduler/")
  ) {
    try {
      return {
        filePath: require.resolve(moduleName, { paths: [projectRoot] }),
        type: "sourceFile",
      };
    } catch {
      // Not found in app — fall through to normal resolution.
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
```

**Why each step is needed:**

| Step | Why |
|------|-----|
| `watchFolders` | Tells Metro to watch source files outside the app root so it can bundle them and respond to changes during development. |
| `extraNodeModules` | Maps package names directly to their source directories. Metro resolves these entries first, bypassing symlinks entirely. |
| `nodeModulesPaths` | Restricts `node_modules` lookup to the app's own folder. Without this, Metro may find duplicate copies of `react` or `react-native` in the monorepo root and bundle the wrong one. |
| `resolveRequest` override | Belt-and-suspenders guarantee that `react`, `react-native`, `react-dom`, and `scheduler` always come from the app — even if something upstream leaks through `watchFolders`. Mixed React versions cause crashes at runtime. |

After saving `metro.config.js`, restart the Metro bundler with `--reset-cache`:

```bash
npx expo start --clear
# or for bare RN:
npx react-native start --reset-cache
```

---

## `usePath()` — hook

Creates an isolated path engine instance scoped to the calling component. Cleaned up automatically when the component unmounts.

### Options

| Option | Type | Description |
|--------|------|-------------|
| `engine` | `PathEngine` | An externally-managed engine (e.g. from `restoreOrStart()`). When provided, `usePath` subscribes to it instead of creating a new one. The caller owns the engine's lifecycle. Must be a stable reference. |
| `onEvent` | `(event: PathEvent) => void` | Called for every engine event. |

### Return value

| Property | Type | Description |
|----------|------|-------------|
| `snapshot` | `PathSnapshot \| null` | Current snapshot. `null` when no path is active. Triggers a re-render on every change. |
| `start(definition, data?)` | `function` | Start or re-start a path. |
| `startSubPath(definition, data?, meta?)` | `function` | Push a sub-path. `meta` is returned unchanged to `onSubPathComplete` / `onSubPathCancel`. |
| `next()` | `function` | Advance one step. Completes the path on the last step. |
| `previous()` | `function` | Go back one step. No-op on the first step of a top-level path. |
| `cancel()` | `function` | Cancel the active path (or sub-path). |
| `goToStep(stepId)` | `function` | Jump directly to a step by ID. Calls `onLeave` / `onEnter`; bypasses guards and `shouldSkip`. |
| `goToStepChecked(stepId)` | `function` | Jump to a step by ID, checking the current step's guard first. |
| `setData(key, value)` | `function` | Update a single data value. Type-checked when `TData` is provided. |
| `resetStep()` | `function` | Restore data to the values recorded on step entry (reverts changes made since entering the current step). |
| `restart(definition, data?)` | `function` | Tear down any active path (without firing hooks) and start fresh. |

All returned callbacks are **referentially stable** — safe to pass to `Pressable.onPress` or include in `useEffect` dependency arrays without causing extra re-renders.

### Type parameter

```tsx
interface ApplicationData {
  firstName: string;
  agreed: boolean;
}

const { snapshot, setData } = usePath<ApplicationData>();
snapshot?.data.firstName;           // typed as string
setData("firstName", "Alice");      // OK
setData("firstName", 42);           // TS error
```

---

## `usePathContext()` — reading state inside step components

When using `<PathShell>` or `<PathProvider>`, child components in the tree call `usePathContext()` to access the same engine instance without prop drilling.

```tsx
import { usePathContext } from "@daltonr/pathwrite-react-native";
import { TextInput, Text, View } from "react-native";

export function DetailsStep() {
  const { snapshot, setData } = usePathContext<ApplicationData>();
  if (!snapshot) return null;

  return (
    <View>
      <TextInput
        value={snapshot.data.firstName}
        onChangeText={(text) => setData("firstName", text)}
        placeholder="First name"
      />
      {snapshot.hasAttemptedNext && snapshot.fieldErrors.firstName ? (
        <Text style={{ color: "red" }}>{snapshot.fieldErrors.firstName}</Text>
      ) : null}
    </View>
  );
}
```

`usePathContext()` throws if called outside a `<PathProvider>` or `<PathShell>`.

---

## `PathShell` — default UI component

`<PathShell>` renders a progress header (numbered step dots, current step title, progress bar), a `ScrollView` body, a validation message area, and navigation buttons — all using React Native primitives. You supply the per-step content as a `steps` map.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `path` | `PathDefinition` | required | The path to drive. |
| `steps` | `Record<string, ReactNode>` | required | Map of step ID → content. The shell renders `steps[snapshot.stepId]` for the active step. |
| `initialData` | `PathData` | `{}` | Initial data passed to `engine.start()`. |
| `engine` | `PathEngine` | — | An externally-managed engine. When provided, `PathShell` skips its own `start()`. |
| `autoStart` | `boolean` | `true` | Start the path automatically on mount. |
| `onComplete` | `(data: PathData) => void` | — | Called when the path completes. |
| `onCancel` | `(data: PathData) => void` | — | Called when the path is cancelled. |
| `onEvent` | `(event: PathEvent) => void` | — | Called for every engine event. |
| `backLabel` | `string` | `"Previous"` | Label for the back button. |
| `nextLabel` | `string` | `"Next"` | Label for the next button. |
| `completeLabel` | `string` | `"Complete"` | Label for the next button on the last step. |
| `cancelLabel` | `string` | `"Cancel"` | Label for the cancel button. |
| `hideCancel` | `boolean` | `false` | Hide the cancel button. |
| `hideProgress` | `boolean` | `false` | Hide the progress header (dots, title, progress bar). Also hidden automatically for single-step top-level paths. |
| `disableBodyScroll` | `boolean` | `false` | Replace the `ScrollView` body wrapper with a plain `View`. Use when the step content contains a `FlatList` or other virtualized list to avoid the "VirtualizedList inside ScrollView" warning. The step is then responsible for its own scrolling. |
| `footerLayout` | `"wizard" \| "form" \| "auto"` | `"auto"` | `"wizard"`: Back on left, Cancel+Submit on right. `"form"`: Cancel on left, Submit on right, no Back. |
| `renderHeader` | `(snapshot: PathSnapshot) => ReactNode` | — | Replace the default progress header entirely. |
| `renderFooter` | `(snapshot: PathSnapshot, actions: PathShellActions) => ReactNode` | — | Replace the default navigation buttons. `actions` contains `next`, `previous`, `cancel`, `goToStep`, `goToStepChecked`, `setData`, `restart`. |
| `style` | `StyleProp<ViewStyle>` | — | Override for the root `View`. |

### How step content works

The `steps` prop keys must exactly match the `id` values in your path definition:

```tsx
const myPath: PathDefinition = {
  id: "onboarding",
  steps: [
    { id: "name" },    // key "name" in steps map
    { id: "terms" },   // key "terms" in steps map
  ],
};

<PathShell
  path={myPath}
  steps={{
    name:  <NameStep />,
    terms: <TermsStep />,
  }}
/>
```

### Context sharing

`<PathShell>` wraps its content in a React Context provider. Step components rendered inside the `steps` map can call `usePathContext()` without a separate `<PathProvider>`.

---

## Complete example

A two-step onboarding flow. Step one collects the user's name with `fieldErrors` validation. Step two reads state via `usePathContext` and presents terms.

```tsx
// onboarding-path.ts
import type { PathDefinition, PathData } from "@daltonr/pathwrite-react-native";

export interface OnboardingData extends PathData {
  firstName: string;
  agreedToTerms: boolean;
}

export const onboardingPath: PathDefinition<OnboardingData> = {
  id: "onboarding",
  steps: [
    {
      id: "name",
      title: "Your Name",
      fieldErrors: ({ data }) => ({
        firstName: (data.firstName ?? "").trim().length < 2
          ? "Name must be at least 2 characters."
          : undefined,
      }),
    },
    {
      id: "terms",
      title: "Terms of Service",
      canMoveNext: ({ data }) => data.agreedToTerms === true,
    },
  ],
};
```

```tsx
// NameStep.tsx
import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { usePathContext } from "@daltonr/pathwrite-react-native";
import type { OnboardingData } from "./onboarding-path";

export function NameStep() {
  const { snapshot, setData } = usePathContext<OnboardingData>();
  if (!snapshot) return null;

  const nameError = snapshot.fieldErrors.firstName;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>First name</Text>
      <TextInput
        style={[styles.input, snapshot.hasAttemptedNext && nameError ? styles.inputError : null]}
        value={snapshot.data.firstName ?? ""}
        onChangeText={(text) => setData("firstName", text)}
        placeholder="Your name"
        autoCapitalize="words"
      />
      {snapshot.hasAttemptedNext && nameError ? (
        <Text style={styles.error}>{nameError}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  label:     { fontSize: 14, fontWeight: "600", color: "#1f2937" },
  input:     { borderWidth: 1, borderColor: "#dbe4f0", borderRadius: 8, padding: 12, fontSize: 16 },
  inputError: { borderColor: "#dc2626" },
  error:     { fontSize: 13, color: "#dc2626" },
});
```

```tsx
// TermsStep.tsx
import React from "react";
import { View, Text, Switch, StyleSheet } from "react-native";
import { usePathContext } from "@daltonr/pathwrite-react-native";
import type { OnboardingData } from "./onboarding-path";

export function TermsStep() {
  const { snapshot, setData } = usePathContext<OnboardingData>();
  if (!snapshot) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.body}>
        By continuing you agree to our Terms of Service and Privacy Policy.
      </Text>
      <View style={styles.row}>
        <Switch
          value={snapshot.data.agreedToTerms ?? false}
          onValueChange={(value) => setData("agreedToTerms", value)}
        />
        <Text style={styles.switchLabel}>I agree to the terms</Text>
      </View>
      {!snapshot.canMoveNext && snapshot.hasAttemptedNext ? (
        <Text style={styles.error}>You must agree to continue.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { gap: 16 },
  body:        { fontSize: 15, color: "#374151", lineHeight: 22 },
  row:         { flexDirection: "row", alignItems: "center", gap: 12 },
  switchLabel: { fontSize: 15, color: "#1f2937" },
  error:       { fontSize: 13, color: "#dc2626" },
});
```

```tsx
// OnboardingScreen.tsx — host screen
import React from "react";
import { PathShell } from "@daltonr/pathwrite-react-native";
import { onboardingPath, type OnboardingData } from "./onboarding-path";
import { NameStep } from "./NameStep";
import { TermsStep } from "./TermsStep";

export function OnboardingScreen() {
  function handleComplete(data: OnboardingData) {
    console.log("Onboarding complete:", data);
    // Navigate to main app
  }

  return (
    <PathShell
      path={onboardingPath}
      initialData={{ firstName: "", agreedToTerms: false }}
      onComplete={handleComplete}
      steps={{
        name:  <NameStep />,
        terms: <TermsStep />,
      }}
    />
  );
}
```

**What this demonstrates:**

- `fieldErrors` on the first step with auto-derived `canMoveNext`.
- An explicit `canMoveNext` guard on the second step (checkbox must be ticked).
- `snapshot.hasAttemptedNext` gates error display so the user is not warned before they've tried to proceed.
- `usePathContext()` inside step components — context is provided by `<PathShell>` automatically.
- React Native native components (`TextInput`, `Switch`, `StyleSheet`) throughout — no web HTML.

---

## Handling virtualized lists inside a step

`<PathShell>` wraps step content in a `ScrollView` by default. React Native warns if you nest a `FlatList` or `SectionList` inside a `ScrollView`. Set `disableBodyScroll` to replace the `ScrollView` wrapper with a plain `View`, making the step responsible for its own scrolling:

```tsx
<PathShell
  path={myPath}
  disableBodyScroll
  steps={{
    results: <SearchResultsStep />,  // contains a FlatList
  }}
/>
```

## Testing

The `usePath` and `usePathContext` hooks use only `useSyncExternalStore`, `useCallback`, and `useRef` — standard React hooks that work identically in jsdom and on-device. You can test hook behaviour with `@testing-library/react` in a jsdom environment without a simulator.

`PathShell` component tests require `@testing-library/react-native` and a React Native test environment (Jest with the `react-native` preset, or Expo's Jest preset).
