# Getting Started — SolidJS

Pathwrite's SolidJS adapter exposes path engine state as a `createSignal` accessor. Reading `snapshot()` inside JSX or a `createEffect` is automatically tracked as a reactive dependency — no wrappers, no stores, no explicit subscriptions in your components. There is no Svelte, Vue, or React dependency. The adapter uses only `solid-js` primitives.

## Installation

```bash
npm install @daltonr/pathwrite-core @daltonr/pathwrite-solid
```

Peer dependencies: `solid-js >= 1.8.0`

### Required `tsconfig.json` setting

Solid JSX requires `"jsxImportSource": "solid-js"` in `tsconfig.json`. The wrong value (a common mistake is `"solid-js/h"`) produces a cryptic TypeScript error that does not mention Solid or JSX. If you see unexpected JSX type errors, check this first:

```json
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "solid-js"
  }
}
```

---

## `usePath()` — composable

Creates an isolated path engine instance. The adapter registers an `onCleanup` handler to unsubscribe when the reactive scope is disposed — no manual cleanup needed.

### Options

| Option | Type | Description |
|--------|------|-------------|
| `engine` | `PathEngine` | An externally-managed engine (e.g. from `restoreOrStart()`). When provided, `usePath` subscribes to it instead of creating a new one. The caller owns the engine's lifecycle. |
| `onEvent` | `(event: PathEvent) => void` | Called for every engine event. |

### Return value

| Property | Type | Description |
|----------|------|-------------|
| `snapshot` | `Accessor<PathSnapshot \| null>` | Reactive signal accessor. Call `snapshot()` to read the current value. `null` when no path is active. Tracked as a reactive dependency when read inside JSX or a `createEffect`. |
| `start(definition, data?)` | `Promise<void>` | Start or restart a path. |
| `startSubPath(definition, data?, meta?)` | `Promise<void>` | Push a sub-path. `meta` is returned unchanged to `onSubPathComplete` / `onSubPathCancel` on the parent step. |
| `next()` | `Promise<void>` | Advance one step. Completes the path on the last step. |
| `previous()` | `Promise<void>` | Go back one step. No-op on the first step of a top-level path. |
| `cancel()` | `Promise<void>` | Cancel the active path (or sub-path). |
| `goToStep(stepId)` | `Promise<void>` | Jump directly to a step by ID. Calls `onLeave`/`onEnter`; bypasses guards and `shouldSkip`. |
| `goToStepChecked(stepId)` | `Promise<void>` | Jump to a step by ID, checking the current step's guard first. |
| `setData(key, value)` | `Promise<void>` | Update a single data value. When `TData` is specified, `key` and `value` are type-checked against your data shape. |
| `resetStep()` | `Promise<void>` | Restore the current step's data to what it was when the step was entered. Emits `stateChanged` with cause `"resetStep"`; no hooks run. |
| `restart()` | `Promise<void>` | Tear down any active path (without firing hooks) and restart the root path with the `initialData` from the original `start()`. Takes no arguments; rejects if nothing has been started. |
| `retry()` | `Promise<void>` | Re-run the operation that set `snapshot().error`. Increments `retryCount` on repeated failure. No-op when there is no pending error. |
| `suspend()` | `Promise<void>` | Pause the path with intent to return. Emits `suspended`; all state and data are preserved. |
| `validate()` | `void` | Set `snapshot().hasValidated` without navigating. Used to trigger simultaneous inline errors across all tabs in a nested shell. |

### Type parameter

```tsx
interface ApplicationData {
  firstName: string;
  agreed: boolean;
}

const { snapshot, setData } = usePath<ApplicationData>();
snapshot()?.data.firstName;           // typed as string
setData("firstName", "Alice");        // OK
setData("firstName", 42);             // TS error
```

---

## `usePathContext()` — accessing state inside step components

Step components rendered inside a `<PathShell>` call `usePathContext()` to access the same engine instance without prop drilling. `<PathShell>` calls `createContext` / `useContext` internally; `usePathContext()` reads from the same context.

```tsx
import { usePathContext } from "@daltonr/pathwrite-solid";

function DetailsStep() {
  const { snapshot, setData } = usePathContext<ApplicationData>();

  return (
    <div>
      <input
        value={snapshot()?.data.firstName ?? ""}
        onInput={(e) => setData("firstName", e.currentTarget.value)}
      />
      <Show when={snapshot()?.hasAttemptedNext && snapshot()?.fieldErrors.firstName}>
        <p class="error">{snapshot()!.fieldErrors.firstName}</p>
      </Show>
    </div>
  );
}
```

`usePathContext()` throws a clear error if called outside a `<PathShell>`.

---

## `<PathShell>` — default UI component

`<PathShell>` renders a progress indicator, step content area, validation messages, and navigation buttons. You supply per-step content as a **`steps` map** whose keys match each step's `id`.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `path` | `PathDefinition` | required | The path to run. |
| `steps` | `Record<string, (snapshot: PathSnapshot) => JSX.Element>` | — | Step render functions keyed by step ID (or `formId` for `StepChoice` steps; the shell falls back to the choice ID when an inner step ID has no entry). Each function is called once when its step becomes current and the component it returns is kept across engine events until the step changes, so inputs keep focus and local state. The `snapshot` argument is live — its properties read the current snapshot reactively. |
| `engine` | `PathEngine` | — | An externally-managed engine (e.g. from `restoreOrStart()` for persistence). Mutually exclusive with managing the engine internally. |
| `initialData` | `PathData` | `{}` | Initial data passed to `engine.start()`. Overridden by the stored snapshot when `restoreKey` is set. |
| `restoreKey` | `string` | — | Save this shell's full state (data + active step) into the nearest outer `PathShell`'s data under this key on every change, and restore from it on remount. No-op on a top-level shell. |
| `autoStart` | `boolean` | `true` | Start the path automatically on mount. Ignored when `engine` is provided. |
| `backLabel` | `string` | `"Previous"` | Previous button label. |
| `nextLabel` | `string` | `"Next"` | Next button label. |
| `completeLabel` | `string` | `"Complete"` | Complete button label (last step). |
| `loadingLabel` | `string` | `undefined` | Label for the Next/Complete button while an async operation is in progress. When unset, the button keeps its label and shows a CSS spinner. |
| `cancelLabel` | `string` | `"Cancel"` | Cancel button label. |
| `hideCancel` | `boolean` | `false` | Hide the Cancel button. |
| `hideProgress` | `boolean` | `false` | Hide the progress indicator. Also hidden automatically for single-step top-level paths. |
| `hideFooter` | `boolean` | `false` | Hide the footer entirely. The error panel is still shown on async failure. |
| `layout` | `"wizard" \| "form" \| "auto" \| "tabs"` | `"auto"` | `"wizard"`: Back on left, Cancel+Submit on right. `"form"`: Cancel on left, Submit on right, no Back. `"tabs"`: No progress header or footer — for tabbed interfaces. `"auto"` picks `"form"` for single-step paths. |
| `validationDisplay` | `"summary" \| "inline" \| "both"` | `"summary"` | Where `fieldErrors` are rendered. `"inline"` suppresses the shell's list so step components can render errors themselves. |
| `progressLayout` | `"merged" \| "split" \| "rootOnly" \| "activeOnly"` | `"merged"` | How the root and sub-path progress bars are arranged while a sub-path is active. |
| `validateWhen` | `boolean` | `false` | When `true` (including already at mount), calls `validate()` on the engine. Bind to an outer shell's `snapshot().hasAttemptedNext` to trigger simultaneous error display in nested shells. |
| `services` | `object \| null` | `null` | Services object made available to step components via `usePathContext<TData, TServices>().services`. |
| `class` | `string` | — | Extra CSS class on the root element. |
| `renderHeader` | `(snapshot: PathSnapshot) => JSX.Element` | — | Replace the default progress header. A custom header is shown even for single-step paths, and hidden under `hideProgress` or `layout="tabs"`. |
| `renderFooter` | `(snapshot: PathSnapshot, actions: PathShellActions) => JSX.Element` | — | Replace the default navigation footer. See below for `actions`. |
| `completionContent` | `(snapshot: PathSnapshot) => JSX.Element` | — | Rendered in place of the step body when `snapshot().status === "completed"` (`completionBehaviour: "stayOnFinal"`, the default). If omitted, a default "All done." panel with a Restart button is shown. |

The package README ([packages/solid-adapter/README.md](../../../packages/solid-adapter/README.md)) is the canonical reference for these props.

### Callbacks

| Prop | Type | Description |
|------|------|-------------|
| `onComplete` | `(data: PathData) => void` | Called when the path completes. |
| `onCancel` | `(data: PathData) => void` | Called when the path is cancelled. |
| `onEvent` | `(event: PathEvent) => void` | Called for every engine event. |

### Custom header and footer

```tsx
<PathShell
  path={myPath}
  steps={{ details: (snap) => <DetailsStep />, review: (snap) => <ReviewStep /> }}
  renderHeader={(snap) => (
    <p>Step {snap.stepIndex + 1} of {snap.stepCount} — {snap.stepTitle}</p>
  )}
  renderFooter={(snap, actions) => (
    <div>
      <button onClick={actions.previous} disabled={snap.isFirstStep}>Back</button>
      <button onClick={actions.next}>{snap.isLastStep ? "Submit" : "Continue"}</button>
    </div>
  )}
/>
```

`actions` contains: `next`, `previous`, `cancel`, `goToStep`, `goToStepChecked`, `setData`, `restart`, `retry`, `suspend`. All return `Promise<void>`.

---

## Complete example

A two-step job-application form. The first step collects personal details with `fieldErrors` validation. The second step collects a cover note.

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
import { Show } from "solid-js";
import { usePathContext } from "@daltonr/pathwrite-solid";
import type { ApplicationData } from "./application-path";

export function DetailsStep() {
  const { snapshot, setData } = usePathContext<ApplicationData>();

  return (
    <div>
      <div>
        <label for="firstName">First name</label>
        <input
          id="firstName"
          value={snapshot()?.data.firstName ?? ""}
          onInput={(e) => setData("firstName", e.currentTarget.value)}
        />
        <Show when={snapshot()?.hasAttemptedNext && snapshot()?.fieldErrors.firstName}>
          <p class="error">{snapshot()!.fieldErrors.firstName}</p>
        </Show>
      </div>
      <div>
        <label for="email">Email</label>
        <input
          id="email"
          type="email"
          value={snapshot()?.data.email ?? ""}
          onInput={(e) => setData("email", e.currentTarget.value)}
        />
        <Show when={snapshot()?.hasAttemptedNext && snapshot()?.fieldErrors.email}>
          <p class="error">{snapshot()!.fieldErrors.email}</p>
        </Show>
      </div>
    </div>
  );
}
```

```tsx
// CoverNoteStep.tsx
import { Show } from "solid-js";
import { usePathContext } from "@daltonr/pathwrite-solid";
import type { ApplicationData } from "./application-path";

export function CoverNoteStep() {
  const { snapshot, setData } = usePathContext<ApplicationData>();

  return (
    <div>
      <label for="coverNote">Cover note</label>
      <textarea
        id="coverNote"
        rows="6"
        value={snapshot()?.data.coverNote ?? ""}
        onInput={(e) => setData("coverNote", e.currentTarget.value)}
        placeholder="Tell us why you're a great fit..."
      />
      <Show when={snapshot()?.hasAttemptedNext && snapshot()?.fieldErrors.coverNote}>
        <p class="error">{snapshot()!.fieldErrors.coverNote}</p>
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
        "details":    () => <DetailsStep />,
        "cover-note": () => <CoverNoteStep />,
      }}
    />
  );
}
```

**What this demonstrates:**

- `fieldErrors` on each step with auto-derived `canMoveNext`.
- `snapshot().hasAttemptedNext` gates inline error display so users are not warned before they've tried to proceed.
- `usePathContext()` inside step components — context is provided by `<PathShell>` automatically.
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
    <Show
      when={isActive()}
      fallback={<button onClick={() => setIsActive(true)}>Try Again</button>}
    >
      <PathShell
        path={myPath}
        onComplete={() => setIsActive(false)}
        steps={{ details: () => <DetailsStep /> }}
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
        {/* render step content based on snapshot().stepId */}
        <button onClick={() => restart()}>Start Over</button>
      </div>
    </Show>
  );
}
```

---

## Testing

The `usePath` composable uses only `createSignal` and `onCleanup` — standard Solid primitives that work identically in any environment. You can test composable behaviour without a browser or DOM:

```ts
import { createRoot } from "solid-js";
import { usePath } from "@daltonr/pathwrite-solid";

test("navigates to next step", async () => {
  await new Promise<void>(resolve => {
    createRoot(async (dispose) => {
      const path = usePath();
      await path.start(myPath, {});
      expect(path.snapshot()!.stepId).toBe("first");
      await path.next();
      expect(path.snapshot()!.stepId).toBe("second");
      dispose();
      resolve();
    });
  });
});
```

© 2026 Devjoy Ltd. MIT License.
