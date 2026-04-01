# Getting Started — React

Pathwrite's React adapter wraps `@daltonr/pathwrite-core` and exposes path state as React state via `useSyncExternalStore`. All action callbacks are referentially stable, so you can pass them as props or include them in dependency arrays safely.

## Installation

```bash
npm install @daltonr/pathwrite-core @daltonr/pathwrite-react
```

All core types are re-exported from the React package, so you rarely need to import directly from `@daltonr/pathwrite-core`:

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
} from "@daltonr/pathwrite-react";
```

---

## `usePath()` — hook

Creates an isolated path engine instance scoped to the calling component. Cleaned up automatically when the component unmounts.

### Options

| Option | Type | Description |
|--------|------|-------------|
| `engine` | `PathEngine` | An externally-managed engine (e.g. from `createPersistedEngine()`). When provided, `usePath` subscribes to it instead of creating a new one. The caller owns the engine's lifecycle. Must be a stable reference. |
| `onEvent` | `(event: PathEvent) => void` | Called for every engine event. The callback ref is kept current — changing it does not re-subscribe to the engine. |

### Return value

| Property | Type | Description |
|----------|------|-------------|
| `snapshot` | `PathSnapshot \| null` | Current snapshot. `null` when no path is active. Triggers a React re-render on every change. |
| `start(definition, data?)` | `function` | Start or re-start a path. |
| `startSubPath(definition, data?, meta?)` | `function` | Push a sub-path onto the stack. Requires an active path. `meta` is returned unchanged to `onSubPathComplete` / `onSubPathCancel` on the parent step. |
| `next()` | `function` | Advance one step. Completes the path when called on the last step. |
| `previous()` | `function` | Go back one step. No-op on the first step of a top-level path. |
| `cancel()` | `function` | Cancel the active path (or sub-path). |
| `goToStep(stepId)` | `function` | Jump directly to a step by ID. Calls `onLeave` / `onEnter` but bypasses guards and `shouldSkip`. |
| `goToStepChecked(stepId)` | `function` | Jump to a step by ID, checking the current step's guard first. Blocked if the guard returns false. |
| `setData(key, value)` | `function` | Update a single data value. When `TData` is specified, `key` and `value` are type-checked against your data shape. |
| `restart(definition, data?)` | `function` | Tear down any active path (without firing hooks) and start fresh. Safe to call at any time. |

All returned callbacks are **referentially stable** — safe to pass as props or add to `useEffect` dependency arrays without causing unnecessary re-renders.

### Type parameter

Pass your data type as a generic to get typed access to `snapshot.data` and `setData`:

```tsx
interface RegistrationData extends PathData {
  name: string;
  email: string;
}

const { snapshot, setData } = usePath<RegistrationData>();
snapshot?.data.name;          // typed as string
setData("name", "Alice");     // OK
setData("name", 42);          // TS error: number is not assignable to string
setData("typo", "x");         // TS error: "typo" is not a key of RegistrationData
```

---

## `usePathContext()` — reading state inside step components

When you use `<PathShell>` or `<PathProvider>`, child components anywhere in the tree can access the same engine instance by calling `usePathContext()`. This avoids prop drilling.

```tsx
import { usePathContext } from "@daltonr/pathwrite-react";

function DetailsForm() {
  const { snapshot, setData } = usePathContext<RegistrationData>();
  if (!snapshot) return null;

  return (
    <input
      value={snapshot.data.name}
      onChange={(e) => setData("name", e.target.value)}
      placeholder="Full name"
    />
  );
}
```

`usePathContext()` throws if called outside a `<PathProvider>` or `<PathShell>`.

---

## `PathShell` — default UI component

`<PathShell>` renders a progress indicator, step content area, validation messages, and navigation buttons. You supply the per-step content as a `steps` map; the shell handles the chrome.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `path` | `PathDefinition` | required | The path to run. |
| `steps` | `Record<string, ReactNode>` | required | Map of step ID → content node. |
| `initialData` | `PathData` | `{}` | Initial data passed to `engine.start()`. |
| `engine` | `PathEngine` | — | An externally-managed engine. When provided, `PathShell` skips its own `start()`. |
| `autoStart` | `boolean` | `true` | Start the path automatically on mount. |
| `onComplete` | `(data: PathData) => void` | — | Called when the path completes. |
| `onCancel` | `(data: PathData) => void` | — | Called when the path is cancelled. |
| `onEvent` | `(event: PathEvent) => void` | — | Called for every engine event. |
| `backLabel` | `string` | `"Previous"` | Previous button label. |
| `nextLabel` | `string` | `"Next"` | Next button label. |
| `completeLabel` | `string` | `"Complete"` | Complete button label (last step). |
| `cancelLabel` | `string` | `"Cancel"` | Cancel button label. |
| `hideCancel` | `boolean` | `false` | Hide the Cancel button. |
| `hideProgress` | `boolean` | `false` | Hide the progress indicator. Also hidden automatically for single-step top-level paths. |
| `layout` | `"wizard" \| "form" \| "auto" \| "tabs"` | `"auto"` | `"wizard"`: Back on left, Cancel+Submit on right. `"form"`: Cancel on left, Submit on right, no Back. `"tabs"`: No progress header or footer — for tabbed interfaces. `"auto"` picks `"form"` for single-step paths. |
| `validationDisplay` | `"summary" \| "inline" \| "both"` | `"summary"` | Where the shell renders `fieldErrors`. `"inline"` suppresses the shell's list so step components can render errors themselves. |
| `className` | `string` | — | Extra CSS class on the root element. |
| `renderHeader` | `(snapshot: PathSnapshot) => ReactNode` | — | Render prop to replace the default progress header. |
| `renderFooter` | `(snapshot: PathSnapshot, actions: PathShellActions) => ReactNode` | — | Render prop to replace the default navigation footer. `actions` contains `next`, `previous`, `cancel`, `goToStep`, `goToStepChecked`, `setData`, `restart`. |

### How step content works

The `steps` prop is a plain `Record<string, ReactNode>`. The shell renders `steps[snapshot.stepId]` for whichever step is current. Step keys must exactly match the `id` values in your path definition:

```tsx
const myPath: PathDefinition = {
  id: "signup",
  steps: [
    { id: "details" },  // key "details" in steps map
    { id: "review" },   // key "review" in steps map
  ],
};

<PathShell
  path={myPath}
  steps={{
    details: <DetailsForm />,  // matches step "details"
    review:  <ReviewPanel />,  // matches step "review"
  }}
/>
```

If a key has no matching step ID, the shell renders `No content for step "<key>"`.

### Context sharing

`<PathShell>` wraps its content in a `PathContext.Provider` automatically. Step components rendered inside it can call `usePathContext()` without a separate `<PathProvider>`.

### Styling

`<PathShell>` ships with no embedded styles. Import the optional stylesheet for sensible defaults:

```ts
import "@daltonr/pathwrite-react/styles.css";
```

All visual values are CSS custom properties (`--pw-*`) so you can theme without overriding selectors:

```css
:root {
  --pw-color-primary: #8b5cf6;
  --pw-shell-radius: 12px;
}
```

---

## Gotcha — eager JSX evaluation in the `steps` map

The `steps` prop is evaluated when `<PathShell>` renders, not when each step is displayed. React creates the JSX objects for every step on every render — all step JSX expressions are instantiated up-front.

For most step components this is negligible: off-screen step components are not mounted, so no `useEffect` or lifecycle code runs. The cost is JSX object creation only.

However, if a step's JSX expression calls a function inline, that function runs on every `<PathShell>` render even when that step is not active:

```tsx
// Problematic: buildList() runs on every PathShell render
<PathShell steps={{ review: <ReviewStep items={buildList()} /> }} />

// Better: move the work inside the component so it only runs when ReviewStep mounts
<PathShell steps={{ review: <ReviewStep /> }} />
```

If you need lazy loading, wrap the component with `React.lazy` and a `<Suspense>` boundary inside the step component — not around the `steps` map entry.

---

## Complete example

A two-step job-application form. The first step collects personal details with `fieldErrors` validation. The second step lets the applicant review before submitting, and reads state via `usePathContext`.

```tsx
import {
  PathShell,
  usePathContext,
  type PathDefinition,
  type PathData,
} from "@daltonr/pathwrite-react";

// --- Data shape ---

interface ApplicationData extends PathData {
  firstName: string;
  email: string;
  coverNote: string;
}

// --- Path definition ---

const applicationPath: PathDefinition<ApplicationData> = {
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

// --- Step components ---

function DetailsStep() {
  const { snapshot, setData } = usePathContext<ApplicationData>();
  if (!snapshot) return null;

  const errors = snapshot.fieldErrors;

  return (
    <div>
      <div>
        <label htmlFor="firstName">First name</label>
        <input
          id="firstName"
          value={snapshot.data.firstName}
          onChange={(e) => setData("firstName", e.target.value)}
        />
        {snapshot.hasAttemptedNext && errors.firstName && (
          <p className="error">{errors.firstName}</p>
        )}
      </div>
      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={snapshot.data.email}
          onChange={(e) => setData("email", e.target.value)}
        />
        {snapshot.hasAttemptedNext && errors.email && (
          <p className="error">{errors.email}</p>
        )}
      </div>
    </div>
  );
}

function CoverNoteStep() {
  const { snapshot, setData } = usePathContext<ApplicationData>();
  if (!snapshot) return null;

  const errors = snapshot.fieldErrors;

  return (
    <div>
      <label htmlFor="coverNote">Cover note</label>
      <textarea
        id="coverNote"
        rows={6}
        value={snapshot.data.coverNote}
        onChange={(e) => setData("coverNote", e.target.value)}
        placeholder="Tell us why you're a great fit..."
      />
      {snapshot.hasAttemptedNext && errors.coverNote && (
        <p className="error">{errors.coverNote}</p>
      )}
    </div>
  );
}

// --- Host component ---

export function JobApplicationFlow() {
  function handleComplete(data: PathData) {
    const result = data as ApplicationData;
    console.log("Application submitted:", result);
  }

  return (
    <PathShell
      path={applicationPath}
      initialData={{ firstName: "", email: "", coverNote: "" }}
      onComplete={handleComplete}
      validationDisplay="inline"
      steps={{
        details:    <DetailsStep />,
        "cover-note": <CoverNoteStep />,
      }}
    />
  );
}
```

**What this demonstrates:**

- `fieldErrors` on each step with auto-derived `canMoveNext` (no explicit guard needed — the engine derives it automatically when `canMoveNext` is omitted and `fieldErrors` is present).
- `snapshot.hasAttemptedNext` gates inline error display so the user doesn't see errors before they've tried to proceed.
- `usePathContext()` inside step components — no prop drilling.
- `validationDisplay="inline"` suppresses the shell's summary error list so step components render errors themselves.
- A hyphenated step ID (`"cover-note"`) used as a key in the `steps` map.

---

## Resetting the path

Use the `key` prop to reset `<PathShell>` back to step 1. Changing `key` forces React to discard the old component tree and mount a fresh one:

```tsx
const [formKey, setFormKey] = useState(0);

<PathShell
  key={formKey}
  path={applicationPath}
  initialData={{ firstName: "", email: "", coverNote: "" }}
  onComplete={handleComplete}
  steps={{ details: <DetailsStep />, "cover-note": <CoverNoteStep /> }}
/>

<button onClick={() => setFormKey(k => k + 1)}>Start over</button>
```

This is the idiomatic React approach — there is no `ref.restart()` method because function components have no instance.

© 2026 Devjoy Ltd. MIT License.
