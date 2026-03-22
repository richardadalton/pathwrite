# @daltonr/pathwrite-react

React hooks over `@daltonr/pathwrite-core`. Exposes path state as reactive React state via `useSyncExternalStore`, with stable action callbacks and an optional context provider.

## Installation

```bash
npm install @daltonr/pathwrite-core @daltonr/pathwrite-react
```

## Exported Types

For convenience, this package re-exports core types so you don't need to import from `@daltonr/pathwrite-core`:

```typescript
import { 
  PathShell,            // React-specific
  usePath,              // React-specific
  usePathContext,       // React-specific
  PathProvider,         // React-specific
  PathEngine,           // Re-exported from core (value + type)
  PathData,             // Re-exported from core
  PathDefinition,       // Re-exported from core
  PathEvent,            // Re-exported from core
  PathSnapshot,         // Re-exported from core
  PathStep,             // Re-exported from core
  PathStepContext,      // Re-exported from core
  SerializedPathState   // Re-exported from core
} from "@daltonr/pathwrite-react";
```

---

## Setup

### Option A — `usePath` hook (component-scoped)

Each call to `usePath` creates an isolated path engine instance.

```tsx
import { usePath } from "@daltonr/pathwrite-react";

function MyPathHost() {
  const { snapshot, start, next, previous, cancel, setData } = usePath({
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
          <button onClick={previous} disabled={snapshot.isNavigating}>Back</button>
          <button onClick={next}     disabled={snapshot.isNavigating}>
            {snapshot.isLastStep ? "Complete" : "Next"}
          </button>
          <button onClick={cancel}>Cancel</button>
        </>
      ) : (
        <button onClick={() => start(myPath)}>Start Path</button>
      )}
    </div>
  );
}
```

### Option B — `PathProvider` + `usePathContext` (shared across components)

Wrap a subtree so that multiple components can read and drive the same path instance.

```tsx
import { PathProvider, usePathContext } from "@daltonr/pathwrite-react";

function App() {
  return (
    <PathProvider onEvent={(e) => console.log(e)}>
      <StepDisplay />
      <NavButtons />
    </PathProvider>
  );
}

function StepDisplay() {
  const { snapshot } = usePathContext();
  if (!snapshot) return <p>No path running.</p>;
  return <h2>{snapshot.stepTitle ?? snapshot.stepId}</h2>;
}

function NavButtons() {
  const { snapshot, next, previous } = usePathContext();
  if (!snapshot) return null;
  return (
    <>
      <button onClick={previous}>Back</button>
      <button onClick={next}>Next</button>
    </>
  );
}
```

## `usePath` API

### Options

| Option | Type | Description |
|--------|------|-------------|
| `engine` | `PathEngine` | An externally-managed engine (e.g. from `createPersistedEngine()`). When provided, `usePath` subscribes to it instead of creating a new one; snapshot is seeded immediately from the engine's current state. The caller is responsible for the engine's lifecycle. Must be a stable reference. |
| `onEvent` | `(event: PathEvent) => void` | Called for every engine event. The callback ref is kept current — changing it does **not** re-subscribe to the engine. |

### Return value

| Property | Type | Description |
|----------|------|-------------|
| `snapshot` | `PathSnapshot \| null` | Current snapshot. `null` when no path is active. Triggers a React re-render on change. |
| `start(definition, data?)` | `function` | Start or re-start a path. |
| `startSubPath(definition, data?, meta?)` | `function` | Push a sub-path. Requires an active path. `meta` is returned unchanged to `onSubPathComplete` / `onSubPathCancel`. |
| `next()` | `function` | Advance one step. Completes the path on the last step. |
| `previous()` | `function` | Go back one step. No-op when already on the first step of a top-level path. |
| `cancel()` | `function` | Cancel the active path (or sub-path). |
| `goToStep(stepId)` | `function` | Jump directly to a step by ID. Calls `onLeave` / `onEnter` but bypasses guards and `shouldSkip`. |
| `goToStepChecked(stepId)` | `function` | Jump to a step by ID, checking `canMoveNext` (forward) or `canMovePrevious` (backward) first. Navigation is blocked if the guard returns false. |
| `setData(key, value)` | `function` | Update a single data value; triggers re-render via `stateChanged`. When `TData` is specified, `key` and `value` are type-checked against your data shape. |
| `restart(definition, data?)` | `function` | Tear down any active path (without firing hooks) and start the given path fresh. Safe to call at any time. Use for "Start over" / retry flows. |

All action callbacks are **referentially stable** — safe to pass as props or include in dependency arrays without causing unnecessary re-renders.

### Typed snapshot data

`usePath` and `usePathContext` accept an optional generic so that `snapshot.data` is typed:

```tsx
interface FormData extends PathData {
  name: string;
  age: number;
}

const { snapshot } = usePath<FormData>();
snapshot?.data.name;  // string
snapshot?.data.age;   // number
```

The generic is a **type-level assertion** — it narrows `snapshot.data` for convenience but is not enforced at runtime. Define your data shape once in a `PathDefinition<FormData>` and the types will stay consistent throughout.

`setData` is also typed against `TData` — passing a wrong key or mismatched value type is a compile-time error:

```tsx
setData("name", 42);     // ✗ TS error: number is not assignable to string
setData("typo", "x");    // ✗ TS error: "typo" is not a key of FormData
setData("name", "Alice"); // ✓
```

### Snapshot guard booleans

The snapshot includes `canMoveNext` and `canMovePrevious` — the evaluated results of the current step's navigation guards. Use them to proactively disable buttons:

```tsx
<button onClick={previous} disabled={snapshot.isNavigating || !snapshot.canMovePrevious}>Back</button>
<button onClick={next}     disabled={snapshot.isNavigating || !snapshot.canMoveNext}>Next</button>
```

These update automatically when data changes (e.g. after `setData`). Async guards default to `true` optimistically.

## Context sharing

### `PathProvider` + `usePathContext`

Wrap a subtree in `<PathProvider>` so multiple components share the same engine instance. Consume with `usePathContext()`.

---

## Default UI — `PathShell`

`<PathShell>` is a ready-made shell component that renders a progress indicator, step content, and navigation buttons. Pass a `steps` map to define per-step content.

```tsx
import { PathShell } from "@daltonr/pathwrite-react";

<PathShell
  path={myPath}
  initialData={{ name: "" }}
  onComplete={(data) => console.log("Done!", data)}
  steps={{
    details: <DetailsForm />,
    review:  <ReviewPanel />,
  }}
/>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `path` | `PathDefinition` | *required* | The path to run. |
| `engine` | `PathEngine` | — | An externally-managed engine. When provided, `PathShell` skips its own `start()` and drives the UI from this engine. |
| `steps` | `Record<string, ReactNode>` | *required* | Map of step ID → content to render. |
| `initialData` | `PathData` | `{}` | Initial data passed to `engine.start()`. |
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
| `className` | `string` | — | Extra CSS class on the root element. |
| `renderHeader` | `(snapshot) => ReactNode` | — | Render prop to replace the progress header. |
| `renderFooter` | `(snapshot, actions) => ReactNode` | — | Render prop to replace the navigation footer. |

### Customising the header and footer

Use `renderHeader` and `renderFooter` to replace the built-in progress bar or navigation buttons with your own UI. Both receive the current `PathSnapshot`; `renderFooter` also receives a `PathShellActions` object with all navigation callbacks.

```tsx
<PathShell
  path={myPath}
  steps={{ details: <DetailsForm />, review: <ReviewPanel /> }}
  renderHeader={(snapshot) => (
    <p>{snapshot.stepIndex + 1} / {snapshot.stepCount} — {snapshot.stepTitle}</p>
  )}
  renderFooter={(snapshot, actions) => (
    <div>
      <button onClick={actions.previous} disabled={snapshot.isFirstStep}>Back</button>
      <button onClick={actions.next}     disabled={!snapshot.canMoveNext}>
        {snapshot.isLastStep ? "Complete" : "Next"}
      </button>
    </div>
  )}
/>
```

`PathShellActions` contains: `next`, `previous`, `cancel`, `goToStep`, `goToStepChecked`, `setData`, `restart`.

### Resetting the path

Use the `key` prop to reset `<PathShell>` to step 1. Changing `key` forces React to discard the old component and mount a fresh one — this is idiomatic React and requires no new API:

```tsx
const [formKey, setFormKey] = useState(0);

<PathShell
  key={formKey}
  path={myPath}
  initialData={{ name: "" }}
  onComplete={handleDone}
  steps={{ details: <DetailsForm /> }}
/>

<button onClick={() => setFormKey(k => k + 1)}>Try Again</button>
```

Incrementing `formKey` discards the old shell and mounts a completely fresh one — path engine, child component state, and DOM are all reset.

If your "Try Again" button is inside the success/cancelled panel you conditionally render after completion, the pattern is even simpler:

```tsx
const [isActive, setIsActive] = useState(true);

{isActive
  ? <PathShell path={myPath} onComplete={() => setIsActive(false)} steps={...} />
  : <SuccessPanel onRetry={() => setIsActive(true)} />
}
```

React function components have no instance, so there is no `ref.restart()` method. The `key` prop achieves the same result and is the React-idiomatic way to reset any component tree.

### Context sharing

`<PathShell>` provides a path context automatically — step components rendered inside it can call `usePathContext()` without a separate `<PathProvider>`:

```tsx
function DetailsForm() {
  const { snapshot, setData } = usePathContext();
  return (
    <input
      value={String(snapshot?.data.name ?? "")}
      onChange={(e) => setData("name", e.target.value)}
    />
  );
}

<PathShell
  path={myPath}
  initialData={{ name: "" }}
  onComplete={handleDone}
  steps={{ details: <DetailsForm />, review: <ReviewPanel /> }}
/>
```

---

## Styling

`<PathShell>` renders structural HTML with BEM-style `pw-shell__*` CSS classes but ships with no embedded styles. Import the optional stylesheet for sensible defaults:

```ts
import "@daltonr/pathwrite-react/styles.css";
```

All visual values are CSS custom properties (`--pw-*`), so you can theme without overriding selectors:

```css
:root {
  --pw-color-primary: #8b5cf6;
  --pw-shell-radius: 12px;
}
```

### Available CSS Custom Properties

**Layout:**
- `--pw-shell-max-width` — Maximum width of the shell (default: `720px`)
- `--pw-shell-padding` — Internal padding (default: `24px`)
- `--pw-shell-gap` — Gap between header, body, footer (default: `20px`)
- `--pw-shell-radius` — Border radius for cards (default: `10px`)

**Colors:**
- `--pw-color-bg` — Background color (default: `#ffffff`)
- `--pw-color-border` — Border color (default: `#dbe4f0`)
- `--pw-color-text` — Primary text color (default: `#1f2937`)
- `--pw-color-muted` — Muted text color (default: `#5b677a`)
- `--pw-color-primary` — Primary/accent color (default: `#2563eb`)
- `--pw-color-primary-light` — Light primary for backgrounds (default: `rgba(37, 99, 235, 0.12)`)
- `--pw-color-btn-bg` — Button background (default: `#f8fbff`)
- `--pw-color-btn-border` — Button border (default: `#c2d0e5`)

**Validation:**
- `--pw-color-error` — Error text color (default: `#dc2626`)
- `--pw-color-error-bg` — Error background (default: `#fef2f2`)
- `--pw-color-error-border` — Error border (default: `#fecaca`)

**Progress Indicator:**
- `--pw-dot-size` — Step dot size (default: `32px`)
- `--pw-dot-font-size` — Font size inside dots (default: `13px`)
- `--pw-track-height` — Progress track height (default: `4px`)

**Buttons:**
- `--pw-btn-padding` — Button padding (default: `8px 16px`)
- `--pw-btn-radius` — Button border radius (default: `6px`)

---

## Sub-Paths

Sub-paths allow you to nest multi-step workflows. Common use cases include:
- Running a child workflow per collection item (e.g., approve each document)
- Conditional drill-down flows (e.g., "Add payment method" modal)
- Reusable wizard components

### Basic Sub-Path Flow

When a sub-path is active:
- The shell switches to show the sub-path's steps
- The progress bar displays sub-path steps (not main path steps)
- Pressing Back on the first sub-path step **cancels** the sub-path and returns to the parent
- `usePathContext()` returns the **sub-path** snapshot, not the parent's

### Complete Example: Approver Collection

```tsx
import type { PathData, PathDefinition } from "@daltonr/pathwrite-core";

// Sub-path data shape
interface ApproverReviewData extends PathData {
  decision: "approve" | "reject" | "";
  comments: string;
}

// Main path data shape
interface ApprovalWorkflowData extends PathData {
  documentTitle: string;
  approvers: string[];
  approvals: Array<{ approver: string; decision: string; comments: string }>;
}

// Define the sub-path (approver review wizard)
const approverReviewPath: PathDefinition<ApproverReviewData> = {
  id: "approver-review",
  steps: [
    { id: "review", title: "Review Document" },
    {
      id: "decision",
      title: "Make Decision",
      canMoveNext: ({ data }) =>
        data.decision === "approve" || data.decision === "reject",
      validationMessages: ({ data }) =>
        !data.decision ? ["Please select Approve or Reject"] : []
    },
    { id: "comments", title: "Add Comments" }
  ]
};

// Define the main path
const approvalWorkflowPath: PathDefinition<ApprovalWorkflowData> = {
  id: "approval-workflow",
  steps: [
    {
      id: "setup",
      title: "Setup Approval",
      canMoveNext: ({ data }) =>
        (data.documentTitle ?? "").trim().length > 0 &&
        data.approvers.length > 0
    },
    {
      id: "run-approvals",
      title: "Collect Approvals",
      // Block "Next" until all approvers have completed their reviews
      canMoveNext: ({ data }) =>
        data.approvals.length === data.approvers.length,
      validationMessages: ({ data }) => {
        const remaining = data.approvers.length - data.approvals.length;
        return remaining > 0
          ? [`${remaining} approver(s) pending review`]
          : [];
      },
      // When an approver finishes their sub-path, record the result
      onSubPathComplete(subPathId, subPathData, ctx, meta) {
        const approverName = meta?.approverName as string;
        const result = subPathData as ApproverReviewData;
        return {
          approvals: [
            ...ctx.data.approvals,
            {
              approver: approverName,
              decision: result.decision,
              comments: result.comments
            }
          ]
        };
      },
      // If an approver cancels (presses Back on first step), you can track it
      onSubPathCancel(subPathId, subPathData, ctx, meta) {
        console.log(`${meta?.approverName} cancelled their review`);
        // Optionally return data changes, or just log
      }
    },
    { id: "summary", title: "Summary" }
  ]
};

// Component
function ApprovalWorkflow() {
  const { startSubPath } = usePathContext<ApprovalWorkflowData>();

  function launchReviewForApprover(approverName: string, index: number) {
    // Pass correlation data via `meta` — it's echoed back to onSubPathComplete
    startSubPath(
      approverReviewPath,
      { decision: "", comments: "" },
      { approverName, approverIndex: index }
    );
  }

  return (
    <PathShell
      path={approvalWorkflowPath}
      initialData={{ documentTitle: "", approvers: [], approvals: [] }}
      steps={{
        setup: <SetupStep />,
        "run-approvals": <RunApprovalsStep onLaunchReview={launchReviewForApprover} />,
        summary: <SummaryStep />,
        // Sub-path steps (must be co-located in the same steps map)
        review: <ReviewDocumentStep />,
        decision: <MakeDecisionStep />,
        comments: <AddCommentsStep />
      }}
    />
  );
}
```

### Key Notes

**1. Sub-path steps must be co-located with main path steps**  
All step content (main path + sub-path steps) lives in the same `steps` prop. When a sub-path is active, the shell renders the sub-path's step content. This means:
- Parent and sub-path step IDs **must not collide** (e.g., don't use `summary` in both)
- Sub-path step components can access parent data by referencing the parent path definition, but `usePathContext()` returns the **sub-path** snapshot

**2. The `meta` correlation field**  
`startSubPath` accepts an optional third argument (`meta`) that is returned unchanged to `onSubPathComplete` and `onSubPathCancel`. Use it to correlate which collection item triggered the sub-path:

```tsx
startSubPath(subPath, initialData, { itemIndex: 3, itemId: "abc" });

// In the parent step:
onSubPathComplete(subPathId, subPathData, ctx, meta) {
  const itemIndex = meta?.itemIndex; // 3
}
```

**3. Progress bar switches during sub-paths**  
When `snapshot.nestingLevel > 0`, you're in a sub-path. The `steps` array in the snapshot contains the sub-path's steps, not the main path's. The default PathShell progress bar shows sub-path progress. You can check `nestingLevel` to show a breadcrumb or "back to main flow" indicator.

**4. Accessing parent path data from sub-path components**  
There is currently no `useParentPathContext()` hook. If a sub-path step needs parent data (e.g., the document title), pass it via `initialData` when calling `startSubPath`:

```tsx
startSubPath(approverReviewPath, {
  decision: "",
  comments: "",
  documentTitle: snapshot.data.documentTitle // copy from parent
});
```

---

## Guards and Lifecycle Hooks

### Defensive Guards (Important!)

**Guards and `validationMessages` are evaluated *before* `onEnter` runs on first entry.**

If you access fields in a guard that `onEnter` is supposed to initialize, the guard will throw a `TypeError` on startup. Write guards defensively using nullish coalescing:

```ts
// ✗ Unsafe — crashes if data.name is undefined
canMoveNext: ({ data }) => data.name.trim().length > 0

// ✓ Safe — handles undefined gracefully
canMoveNext: ({ data }) => (data.name ?? "").trim().length > 0
```

Alternatively, pass `initialData` to `start()` / `<PathShell>` so all fields are present from the first snapshot:

```tsx
<PathShell path={myPath} initialData={{ name: "", age: 0 }} />
```

If a guard throws, the engine catches it, logs a warning, and returns `true` (allow navigation) as a safe default.

### Async Guards and Validation Messages

Guards and `validationMessages` must be **synchronous** for inclusion in snapshots. Async functions are detected and warned about:
- Async `canMoveNext` / `canMovePrevious` default to `true` (optimistic)
- Async `validationMessages` default to `[]`

The async version is still enforced during actual navigation (when you call `next()` / `previous()`), but the snapshot won't reflect the pending state. If you need async validation, perform it in the guard and store the result in `data` so the guard can read it synchronously.

### `isFirstEntry` Flag

The `PathStepContext` passed to all hooks includes an `isFirstEntry: boolean` flag. It's `true` the first time a step is visited, `false` on re-entry (e.g., after navigating back then forward again).

Use it to distinguish initialization from re-entry:

```ts
{
  id: "details",
  onEnter: ({ isFirstEntry, data }) => {
    if (isFirstEntry) {
      // Only pre-fill on first visit, not when returning via Back
      return { name: "Default Name" };
    }
  }
}
```

**Important:** `onEnter` fires every time you enter the step. If you want "initialize once" behavior, either:
1. Use `isFirstEntry` to conditionally return data
2. Provide `initialData` to `start()` instead of using `onEnter`

---

## Design notes

