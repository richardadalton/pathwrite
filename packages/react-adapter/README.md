# @daltonr/pathwrite-react

React adapter for Pathwrite — exposes path engine state as React state via `useSyncExternalStore`, with stable action callbacks and an optional context provider.

## Installation

```bash
npm install @daltonr/pathwrite-core @daltonr/pathwrite-react
```

Peer dependencies: React 18+

---

## Quick start

```tsx
import { PathShell, usePathContext } from "@daltonr/pathwrite-react";
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

function DetailsStep() {
  const { snapshot, setData } = usePathContext<SignupData>();
  if (!snapshot) return null;
  return (
    <div>
      <input value={snapshot.data.name} onChange={(e) => setData("name", e.target.value)} placeholder="Name" />
      <input value={snapshot.data.email} onChange={(e) => setData("email", e.target.value)} placeholder="Email" />
    </div>
  );
}

function ReviewStep() {
  const { snapshot } = usePathContext<SignupData>();
  if (!snapshot) return null;
  return <p>Signing up as {snapshot.data.name} ({snapshot.data.email})</p>;
}

export function SignupFlow() {
  return (
    <PathShell
      path={signupPath}
      initialData={{ name: "", email: "" }}
      onComplete={(data) => console.log("Done!", data)}
      steps={{
        details: <DetailsStep />,
        review:  <ReviewStep />,
      }}
    />
  );
}
```

Step components call `usePathContext()` to access engine state — no prop drilling needed. `<PathShell>` provides the context automatically.

---

## usePath

`usePath<TData, TServices>()` creates an isolated path engine instance scoped to the calling component. Use it when you need manual control over the shell UI.

| Return value | Type | Description |
|---|---|---|
| `snapshot` | `PathSnapshot \| null` | Current snapshot. `null` when no path is active or when `completionBehaviour: "dismiss"` is used. With the default `"stayOnFinal"`, a non-null snapshot with `status === "completed"` is returned after the path finishes. Triggers re-render on change. |
| `start(definition, data?)` | function | Start or re-start a path. |
| `next()` | function | Advance one step. Completes the path on the last step. |
| `previous()` | function | Go back one step. No-op on the first step of a top-level path. |
| `cancel()` | function | Cancel the active path or sub-path. |
| `goToStep(stepId)` | function | Jump to a step by ID, bypassing guards and `shouldSkip`. |
| `goToStepChecked(stepId)` | function | Jump to a step by ID, checking the relevant navigation guard first. |
| `setData(key, value)` | function | Update a single data field. Type-checked when `TData` is provided. |
| `resetStep()` | function | Restore the current step's data to what it was when the step was entered. Emits `stateChanged` with cause `"resetStep"`; no hooks run. |
| `startSubPath(definition, data?, meta?)` | function | Push a sub-path. `meta` is echoed back to `onSubPathComplete` / `onSubPathCancel`. |
| `suspend()` | function | Pause the path with intent to return. Emits `suspended`; all state and data are preserved. |
| `retry()` | function | Re-run the operation that set `snapshot.error`. Increments `snapshot.error.retryCount` on repeated failure. No-op when there is no pending error. |
| `restart()` | function | Tear down the active path without firing hooks and restart the root path with the `initialData` from the original `start()`. Takes no arguments; throws if nothing has been started. |
| `validate()` | function | Set `snapshot.hasValidated` without navigating. Triggers all inline field errors simultaneously. Used to validate all tabs in a nested shell at once. |

All returned callbacks are referentially stable — safe to pass as props or include in `useEffect` dependency arrays.

---

## PathShell props

`<PathShell>` renders a progress indicator, step content, validation messages, and navigation buttons. Step components access engine state via `usePathContext()`.

| Prop | Type | Default | Description |
|---|---|---|---|
| `path` | `PathDefinition` | required | The path to run. |
| `steps` | `Record<string, ReactNode>` | required | Map of step ID to content. Keys must exactly match step IDs. |
| `initialData` | `PathData` | `{}` | Initial data passed to `engine.start()`. Overridden by the stored snapshot when `restoreKey` is set. |
| `engine` | `PathEngine` | — | An externally-managed engine (e.g. from `restoreOrStart()`). When provided, `PathShell` skips its own `start()`. May be provided after mount (e.g. once an async `restoreOrStart()` resolves): the shell adopts it, re-subscribing and re-seeding from the new engine. Set `autoStart` to `false` if the shell should not start its own path in the meantime. |
| `restoreKey` | `string` | — | When set, the shell automatically saves its full state (data + active step) into the nearest outer `PathShell`'s data under this key on every change, and restores from it on remount. No-op on a top-level shell. The stored value also carries the inner engine's serialized state, so a remount restores in place: no `onEnter` / `onLeave` re-run, attempted / visited state kept. |
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
| `validationDisplay` | `"summary" \| "inline" \| "both"` | `"summary"` | Where `fieldErrors` are rendered. Use `"inline"` so step components render their own errors. |
| `progressLayout` | `"merged" \| "split" \| "rootOnly" \| "activeOnly"` | `"merged"` | How the root and sub-path progress bars are arranged while a sub-path is active. |
| `services` | `unknown` | — | Services object made available to step components via `usePathContext<TData, TServices>().services`. Pass the same object you gave your path factory so steps can call service methods directly. |
| `className` | `string` | — | Extra CSS class on the root element. |
| `renderHeader` | `(snapshot: PathSnapshot) => ReactNode` | — | Replace the default progress header. A custom header is shown even for single-step paths, and hidden under `hideProgress` or `layout="tabs"`. |
| `renderFooter` | `(snapshot: PathSnapshot, actions: PathShellActions) => ReactNode` | — | Replace the default navigation footer. `actions` contains `next`, `previous`, `cancel`, `goToStep`, `goToStepChecked`, `setData`, `restart`, `retry`, `suspend`. |
| `completionContent` | `ReactNode` | — | Custom content rendered when `snapshot.status === "completed"` (requires `completionBehaviour: "stayOnFinal"`, the default). If omitted, a default "All done." panel with a "Start over" button is shown. Components inside `completionContent` can call `usePathContext()` to access `restart` and `snapshot.data`. |

Step components rendered inside `<PathShell>` call `usePathContext()` to read `snapshot` and invoke actions — no prop drilling required.

---

## usePathContext

`usePathContext<TData, TServices>()` reads the engine instance provided by the nearest `<PathShell>` or `<PathProvider>` ancestor. `snapshot` is typed `PathSnapshot` — never null — because both providers render their children only while a path is active. It returns the same actions as `usePath` plus the `services` value.

`<PathProvider>` is a headless `PathShell`: pass a `path` (started once on mount with `initialData`) or an `engine` the parent owns (from `usePath()` or `restoreOrStart()`), and it renders `children` while a path is active and `fallback` otherwise — before the start resolves, after `cancel()`, and after a `"dismiss"` completion.

---

## useField and FieldError

`useField(field)` returns `{ value, onChange, error, warning }` bound to `snapshot.data[field]`, ready to spread onto an `<input>`, `<select>` or `<textarea>`. `value` is always a `string` (`""` when unset); `onChange` calls `setData(field, e.target.value)`; `error` is the field's error message once the user has attempted to advance (or `validate()` has run), otherwise `undefined`; `warning` is shown immediately.

`<FieldError field="..." />` renders that error (after an attempt) or warning (immediately) as `<span class="pw-field-error">` / `<span class="pw-field-warning">`, and nothing when there is no message. It also registers the field with the enclosing `<PathShell>`, which then omits it from the shell's summary list so messages are not duplicated.

```tsx
import { useField, FieldError } from "@daltonr/pathwrite-react";

function DetailsStep() {
  const name = useField<SignupData, "name">("name");
  return (
    <div>
      <input type="text" placeholder="Name" {...name} />
      <FieldError field="name" />
    </div>
  );
}
```

Both work inside a `<PathShell>` or a `<PathProvider>`. For inputs that need a value transform (`.trim()`, `Number()`), keep an explicit `onChange` handler.

---

## Further reading

- [React getting started guide](../../docs/getting-started/frameworks/react.md)
- [Navigation guide](../../docs/developer-guide/04-navigation.md)
- [Full docs](../../docs/README.md)

---

© 2026 Devjoy Ltd. MIT License.
