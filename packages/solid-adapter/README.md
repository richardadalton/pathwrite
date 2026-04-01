# @daltonr/pathwrite-solid

SolidJS adapter for Pathwrite — exposes path engine state as a reactive `createSignal` accessor that integrates natively with SolidJS's fine-grained reactivity model.

## Installation

```bash
npm install @daltonr/pathwrite-core @daltonr/pathwrite-solid
```

Peer dependencies: `solid-js >= 1.8.0`

---

## Quick start

```tsx
// SignupFlow.tsx
import { PathShell } from "@daltonr/pathwrite-solid";
import "@daltonr/pathwrite-solid/styles.css";
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

export function SignupFlow() {
  return (
    <PathShell
      path={signupPath}
      initialData={{ name: "", email: "" }}
      onComplete={(data) => console.log("Done!", data)}
      steps={{
        details: (snap) => <DetailsStep />,
        review:  (snap) => <ReviewStep />,
      }}
    />
  );
}
```

```tsx
// DetailsStep.tsx
import { usePathContext } from "@daltonr/pathwrite-solid";

export function DetailsStep() {
  const { snapshot, setData } = usePathContext<SignupData>();

  return (
    <div>
      <input
        value={snapshot().data.name}
        onInput={(e) => setData("name", e.currentTarget.value)}
        placeholder="Name"
      />
      <input
        value={snapshot().data.email}
        onInput={(e) => setData("email", e.currentTarget.value)}
        placeholder="Email"
      />
    </div>
  );
}
```

Step components call `usePathContext()` to access engine state. `<PathShell>` provides the context automatically via `createContext` / `useContext`.

---

## usePath

`usePath<TData>()` creates an isolated path engine instance. The composable registers an `onCleanup` handler to unsubscribe from the engine when the reactive scope is disposed — no manual cleanup needed.

| Return value | Type | Description |
|---|---|---|
| `snapshot` | `Accessor<PathSnapshot \| null>` | Current snapshot. Call `snapshot()` to read. `null` when no path is active or when `completionBehaviour: "dismiss"` is used. With the default `"stayOnFinal"`, the accessor returns a snapshot with `status === "completed"` after the path finishes. Tracked reactively when read inside JSX or effects. |
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
| `restart()` | function | Tear down the active path without firing hooks and start fresh. |
| `validate()` | function | Set `snapshot().hasValidated` without navigating. Used to trigger inline errors across all tabs in a nested shell. |

---

## PathShell props

`<PathShell>` renders a progress indicator, step content area, validation messages, and navigation buttons. Step content is provided as a **`steps` map** whose keys match each step's `id`.

```tsx
<PathShell
  path={myPath}
  steps={{
    details: (snap) => <DetailsStep />,
    review:  (snap) => <ReviewStep />,
  }}
/>
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `path` | `PathDefinition` | required | The path to run. |
| `steps` | `Record<string, (snapshot: PathSnapshot) => JSX.Element>` | — | Step render functions keyed by step ID (or `formId` for `StepChoice` steps). |
| `initialData` | `PathData` | `{}` | Initial data passed to `engine.start()`. |
| `engine` | `PathEngine` | — | An externally-managed engine. When provided, `PathShell` skips its own `start()`. |
| `autoStart` | `boolean` | `true` | Start the path automatically on mount. Ignored when `engine` is provided. |
| `validationDisplay` | `"summary" \| "inline" \| "both"` | `"summary"` | Where `fieldErrors` are rendered. Use `"inline"` to suppress the summary and handle errors inside step components. |
| `layout` | `"wizard" \| "form" \| "auto" \| "tabs"` | `"auto"` | `"wizard"`: Back on left, Cancel+Submit on right. `"form"`: Cancel on left, Submit on right, no Back. `"tabs"`: No progress header or footer — for tabbed interfaces. `"auto"` picks `"form"` for single-step paths. |
| `hideProgress` | `boolean` | `false` | Hide the progress indicator. Also hidden automatically for single-step top-level paths. |
| `hideFooter` | `boolean` | `false` | Hide the footer entirely. The error panel is still shown on async failure. |
| `hideCancel` | `boolean` | `false` | Hide the Cancel button. |
| `validateWhen` | `boolean` | `false` | When it becomes `true`, calls `validate()` on the engine. Bind to the outer shell's `hasAttemptedNext` for nested shells. |
| `services` | `object \| null` | `null` | Services object passed through context to all step components. |
| `renderHeader` | `(snapshot) => JSX.Element` | — | Replace the default progress header. |
| `renderFooter` | `(snapshot, actions) => JSX.Element` | — | Replace the default navigation buttons. |
| `completionContent` | `(snapshot: PathSnapshot) => JSX.Element` | — | Custom content rendered when `snapshot().status === "completed"` (`completionBehaviour: "stayOnFinal"`). Receives the completed snapshot. If omitted, a default "All done." panel is shown. |
| `onComplete` | `(data: PathData) => void` | — | Called when the path completes. |
| `onCancel` | `(data: PathData) => void` | — | Called when the path is cancelled. |
| `onEvent` | `(event: PathEvent) => void` | — | Called for every engine event. |

---

## usePathContext

`usePathContext<TData, TServices>()` reads the engine instance provided by the nearest `<PathShell>` ancestor. It returns the same shape as `usePath` — `snapshot`, `next`, `previous`, `cancel`, `setData`, and all other action callbacks. The `snapshot` is the same `Accessor<PathSnapshot | null>` — call `snapshot()` to read the current value.

Pass `TData` for typed access to `snapshot()?.data` and `setData`; pass `TServices` to type the `services` field. Must be called inside a component that is a descendant of `<PathShell>`. Throws a clear error if called outside one.

```tsx
import { usePathContext } from "@daltonr/pathwrite-solid";

function DetailsStep() {
  const { snapshot, setData } = usePathContext<SignupData>();

  return (
    <input
      value={snapshot()?.data.name ?? ""}
      onInput={(e) => setData("name", e.currentTarget.value)}
    />
  );
}
```

---

## Complete example

A two-step job-application form with `fieldErrors` validation.

```ts
// application-path.ts
import type { PathDefinition, PathData } from "@daltonr/pathwrite-solid";

export interface ApplicationData extends PathData {
  firstName: string;
  email: string;
  coverNote: string;
}

export const applicationPath: PathDefinition<ApplicationData> = {
  id: "job-application",
  steps: [
    {
      id: "details",
      title: "Your Details",
      fieldErrors: ({ data }) => ({
        firstName: (data.firstName ?? "").trim().length < 2
          ? "First name must be at least 2 characters."
          : undefined,
        email: !(data.email ?? "").includes("@")
          ? "A valid email address is required."
          : undefined,
      }),
    },
    {
      id: "cover-note",
      title: "Cover Note",
      fieldErrors: ({ data }) => ({
        coverNote: (data.coverNote ?? "").trim().length < 20
          ? "Cover note must be at least 20 characters."
          : undefined,
      }),
    },
  ],
};
```

```tsx
// DetailsStep.tsx
import { usePathContext } from "@daltonr/pathwrite-solid";
import type { ApplicationData } from "./application-path";

export function DetailsStep() {
  const { snapshot, setData } = usePathContext<ApplicationData>();

  return (
    <div>
      <label>First name</label>
      <input
        value={snapshot()?.data.firstName ?? ""}
        onInput={(e) => setData("firstName", e.currentTarget.value)}
      />
      <Show when={snapshot()?.hasAttemptedNext && snapshot()?.fieldErrors.firstName}>
        <p class="error">{snapshot()?.fieldErrors.firstName}</p>
      </Show>
    </div>
  );
}
```

```tsx
// CoverNoteStep.tsx
import { usePathContext } from "@daltonr/pathwrite-solid";
import type { ApplicationData } from "./application-path";

export function CoverNoteStep() {
  const { snapshot, setData } = usePathContext<ApplicationData>();

  return (
    <div>
      <label>Cover note</label>
      <textarea
        value={snapshot()?.data.coverNote ?? ""}
        onInput={(e) => setData("coverNote", e.currentTarget.value)}
        rows="6"
        placeholder="Tell us why you're a great fit..."
      />
      <Show when={snapshot()?.hasAttemptedNext && snapshot()?.fieldErrors.coverNote}>
        <p class="error">{snapshot()?.fieldErrors.coverNote}</p>
      </Show>
    </div>
  );
}
```

```tsx
// JobApplicationFlow.tsx — host component
import { PathShell } from "@daltonr/pathwrite-solid";
import "@daltonr/pathwrite-solid/styles.css";
import { applicationPath } from "./application-path";
import { DetailsStep } from "./DetailsStep";
import { CoverNoteStep } from "./CoverNoteStep";

export function JobApplicationFlow() {
  return (
    <PathShell
      path={applicationPath}
      initialData={{ firstName: "", email: "", coverNote: "" }}
      onComplete={(data) => console.log("Application submitted:", data)}
      steps={{
        "details":    (snap) => <DetailsStep />,
        "cover-note": (snap) => <CoverNoteStep />,
      }}
    />
  );
}
```

**What this demonstrates:**

- `fieldErrors` on each step with auto-derived `canMoveNext`.
- `snapshot().hasAttemptedNext` gates inline error display.
- `usePathContext()` inside step components — provided automatically by `<PathShell>`.
- The `steps` map keyed by step ID, including hyphenated IDs like `"cover-note"`.

---

## Styling

`<PathShell>` ships with no embedded styles. Import the optional stylesheet:

```ts
import "@daltonr/pathwrite-solid/styles.css";
```

All visual values are CSS custom properties:

```css
:root {
  --pw-color-primary: #8b5cf6;
  --pw-shell-radius: 12px;
}
```

---

## Resetting the path

**Option 1 — Toggle mount** (simplest):

```tsx
function App() {
  const [isActive, setIsActive] = createSignal(true);

  return (
    <Show when={isActive()} fallback={<button onClick={() => setIsActive(true)}>Try Again</button>}>
      <PathShell
        path={myPath}
        onComplete={() => setIsActive(false)}
        steps={{ ... }}
      />
    </Show>
  );
}
```

**Option 2 — `restart()` via `usePath`** (in-place, no unmount):

```tsx
function App() {
  const { snapshot, start, restart, next, previous } = usePath();

  onMount(() => start(myPath, {}));

  return (
    <Show when={snapshot()}>
      <div>
        {/* render step content */}
        <button onClick={() => restart()}>Start Over</button>
      </div>
    </Show>
  );
}
```

---

## Further reading

- [SolidJS getting started guide](../../docs/getting-started/frameworks/solidjs.md)
- [Navigation guide](../../docs/guides/navigation.md)
- [Full docs](../../docs/README.md)

---

© 2026 Devjoy Ltd. MIT License.
