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
| `engine` | `PathEngine` | An externally-managed engine (e.g. from `restoreOrStart()` in `@daltonr/pathwrite-store`). When provided, `usePath` subscribes to it instead of creating a new one. The caller owns the engine's lifecycle. Must be a stable reference. |
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
| `resetStep()` | `function` | Restore the current step's data to what it was when the step was entered. Emits `stateChanged` with cause `"resetStep"`; no hooks run. |
| `restart()` | `function` | Tear down any active path (without firing hooks) and restart the root path with the `initialData` from the original `start()`. Takes no arguments; throws if nothing has been started. |
| `retry()` | `function` | Re-run the operation that set `snapshot.error`. Increments `snapshot.error.retryCount` on repeated failure. No-op when there is no pending error. |
| `suspend()` | `function` | Pause the path with intent to return. Emits `suspended`; all state and data are preserved. |
| `validate()` | `function` | Trigger inline validation on all steps without navigating. Sets `snapshot.hasValidated`. |

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

  return (
    <input
      value={snapshot.data.name}
      onChange={(e) => setData("name", e.target.value)}
      placeholder="Full name"
    />
  );
}
```

`usePathContext()` throws if called outside a `<PathProvider>` or `<PathShell>`. Its `snapshot` is typed `PathSnapshot` — never null — because both providers render their children only while a path is active.

### `<PathProvider>` — a headless shell

`PathProvider` supplies the same context as `PathShell` without rendering any UI. Give it a `path` (started once, on mount, with `initialData`) or an `engine` the parent owns — for example the one `usePath()` in the parent is bound to, or the engine from `restoreOrStart()` — and it renders `children` while a path is active and `fallback` otherwise (before the start resolves, after `cancel()`, after a `"dismiss"` completion).

```tsx
<PathProvider path={registrationPath} initialData={{ name: "" }} fallback={<Spinner />}>
  <DetailsForm />
</PathProvider>
```

A child cannot start the path itself: the provider (or the engine's owner) does, so `usePathContext().snapshot` is always populated inside.

---

## `useField()` and `<FieldError>` — input binding helpers

`useField(field)` returns `{ value, onChange, error, warning }` bound to `snapshot.data[field]`, ready to spread onto an `<input>`, `<select>` or `<textarea>`:

- `value` is always a `string` (`""` when the key is unset).
- `onChange` calls `setData(field, e.target.value)`.
- `error` is the field's error message once the user has attempted to advance (or `validate()` has run), otherwise `undefined`.
- `warning` is the field's warning message, shown immediately.

`<FieldError field="..." />` renders that error (after an attempt) or warning (immediately) as `<span class="pw-field-error">` / `<span class="pw-field-warning">`, and nothing when there is no message. It also registers the field with the enclosing `<PathShell>`, which then leaves it out of the shell's summary list — so inline and summary messages do not duplicate without switching `validationDisplay`.

```tsx
import { useField, FieldError } from "@daltonr/pathwrite-react";

function DetailsStep() {
  const firstName = useField<ApplicationData, "firstName">("firstName");
  return (
    <div>
      <label htmlFor="firstName">First name</label>
      <input id="firstName" type="text" {...firstName} />
      <FieldError field="firstName" />
    </div>
  );
}
```

Both work inside a `<PathShell>` or a bare `<PathProvider>` and are null-safe: with no active path they render an empty, message-free field instead of throwing. For inputs that need a value transform (`.trim()`, `Number()`), keep an explicit `onChange` handler — `useField` is for the no-transform case.

---

## `PathShell` — default UI component

`<PathShell>` renders a progress indicator, step content area, validation messages, and navigation buttons. You supply the per-step content as a `steps` map; the shell handles the chrome.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `path` | `PathDefinition` | required | The path to run. |
| `steps` | `Record<string, ReactNode>` | required | Map of step ID → content node. |
| `initialData` | `PathData` | `{}` | Initial data passed to `engine.start()`. Overridden by the stored snapshot when `restoreKey` is set. |
| `engine` | `PathEngine` | — | An externally-managed engine (e.g. from `restoreOrStart()`). When provided, `PathShell` skips its own `start()`. May be provided after mount (e.g. once an async `restoreOrStart()` resolves): the shell adopts it, re-subscribing and re-seeding from the new engine. Set `autoStart` to `false` if the shell should not start its own path in the meantime. |
| `restoreKey` | `string` | — | Save this shell's full state (data + active step) into the nearest outer `PathShell`'s data under this key on every change, and restore from it on remount. No-op on a top-level shell. |
| `autoStart` | `boolean` | `true` | Start the path automatically on mount. |
| `onComplete` | `(data: PathData) => void` | — | Called when the path completes. |
| `onCancel` | `(data: PathData) => void` | — | Called when the path is cancelled. |
| `onEvent` | `(event: PathEvent) => void` | — | Called for every engine event. |
| `backLabel` | `string` | `"Previous"` | Previous button label. |
| `nextLabel` | `string` | `"Next"` | Next button label. |
| `completeLabel` | `string` | `"Complete"` | Complete button label (last step). |
| `loadingLabel` | `string` | `undefined` | Label for the Next/Complete button while an async operation is in progress. When unset, the button keeps its label and shows a CSS spinner. |
| `cancelLabel` | `string` | `"Cancel"` | Cancel button label. |
| `hideCancel` | `boolean` | `false` | Hide the Cancel button. |
| `hideProgress` | `boolean` | `false` | Hide the progress indicator. Also hidden automatically for single-step top-level paths. |
| `hideFooter` | `boolean` | `false` | Hide the footer (navigation buttons). The error panel is still shown on async failure. |
| `validateWhen` | `boolean` | `false` | When `true` (including already at mount), calls `validate()` on the engine so all steps show inline errors at once. Bind to the outer snapshot's `hasAttemptedNext` when this shell is nested inside a step of an outer shell. |
| `layout` | `"wizard" \| "form" \| "auto" \| "tabs"` | `"auto"` | `"wizard"`: Back on left, Cancel+Submit on right. `"form"`: Cancel on left, Submit on right, no Back. `"tabs"`: No progress header or footer — for tabbed interfaces. `"auto"` picks `"form"` for single-step paths. |
| `validationDisplay` | `"summary" \| "inline" \| "both"` | `"summary"` | Where the shell renders `fieldErrors`. `"inline"` suppresses the shell's list so step components can render errors themselves. |
| `progressLayout` | `"merged" \| "split" \| "rootOnly" \| "activeOnly"` | `"merged"` | How the root and sub-path progress bars are arranged while a sub-path is active. |
| `services` | `unknown` | — | Services object made available to step components via `usePathContext<TData, TServices>().services`. |
| `className` | `string` | — | Extra CSS class on the root element. |
| `renderHeader` | `(snapshot: PathSnapshot) => ReactNode` | — | Render prop to replace the default progress header. A custom header is shown even for single-step paths, and hidden under `hideProgress` or `layout="tabs"`. |
| `renderFooter` | `(snapshot: PathSnapshot, actions: PathShellActions) => ReactNode` | — | Render prop to replace the default navigation footer. `actions` contains `next`, `previous`, `cancel`, `goToStep`, `goToStepChecked`, `setData`, `restart`, `retry`, `suspend`. |
| `completionContent` | `ReactNode` | — | Rendered in place of the step body when `snapshot.status === "completed"` (`completionBehaviour: "stayOnFinal"`, the default). If omitted, a default "All done." panel with a Restart button is shown. |

The package README ([packages/react-adapter/README.md](../../../packages/react-adapter/README.md)) is the canonical reference for these props.

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

This is the simplest approach. Alternatively, `<PathShell>` is a `forwardRef` component exposing a `PathShellHandle`, so you can restart in place without remounting:

```tsx
const shellRef = useRef<PathShellHandle>(null);

<PathShell ref={shellRef} path={applicationPath} steps={...} />
<button onClick={() => shellRef.current?.restart()}>Start over</button>
```

`restart()` takes no arguments — it restarts the shell's path with its original `initialData`.

© 2026 Devjoy Ltd. MIT License.
