# @daltonr/pathwrite-vue

Vue 3 composable over `@daltonr/pathwrite-core`. Exposes path state as a reactive `shallowRef` that integrates seamlessly with Vue's reactivity system, templates, and `computed()`.

## Installation

```bash
npm install @daltonr/pathwrite-core @daltonr/pathwrite-vue
```

## Exported Types

For convenience, this package re-exports core types so you don't need to import from `@daltonr/pathwrite-core`:

```typescript
import { 
  PathShell,            // Vue-specific
  usePath,              // Vue-specific
  usePathContext,       // Vue-specific
  PathEngine,           // Re-exported from core (value + type)
  PathData,             // Re-exported from core
  PathDefinition,       // Re-exported from core
  PathEvent,            // Re-exported from core
  PathSnapshot,         // Re-exported from core
  PathStep,             // Re-exported from core
  PathStepContext,      // Re-exported from core
  SerializedPathState   // Re-exported from core
} from "@daltonr/pathwrite-vue";
```

---

## Setup

```vue
<script setup lang="ts">
import { usePath } from "@daltonr/pathwrite-vue";
import { computed } from "vue";

const { snapshot, start, next, previous, cancel, setData } = usePath({
  onEvent(event) {
    console.log(event);
  }
});

const currentStep = computed(() => snapshot.value?.stepId ?? null);
</script>

<template>
  <div v-if="snapshot">
    <h2>{{ snapshot.stepTitle ?? snapshot.stepId }}</h2>
    <p>Step {{ snapshot.stepIndex + 1 }} of {{ snapshot.stepCount }}</p>
    <button @click="previous" :disabled="snapshot.isNavigating || !snapshot.canMovePrevious">Back</button>
    <button @click="next" :disabled="snapshot.isNavigating || !snapshot.canMoveNext">
      {{ snapshot.isLastStep ? "Finish" : "Next" }}
    </button>
    <button @click="cancel">Cancel</button>
  </div>
  <div v-else>
    <button @click="start(myPath)">Start Path</button>
  </div>
</template>
```

## `usePath` API

### Options

| Option | Type | Description |
|--------|------|-------------|
| `engine` | `PathEngine` | An externally-managed engine (e.g. from `createPersistedEngine()`). When provided, `usePath` subscribes to it instead of creating a new one; snapshot is seeded immediately from the engine's current state. The caller is responsible for the engine's lifecycle. |
| `onEvent` | `(event: PathEvent) => void` | Called for every engine event. |

### Return value

| Property | Type | Description |
|----------|------|-------------|
| `snapshot` | `DeepReadonly<Ref<PathSnapshot \| null>>` | Current snapshot. `null` when no path is active. Triggers Vue re-renders on change. |
| `start(definition, data?)` | `function` | Start or re-start a path. |
| `startSubPath(definition, data?, meta?)` | `function` | Push a sub-path. Requires an active path. `meta` is returned unchanged to `onSubPathComplete` / `onSubPathCancel`. |
| `next()` | `function` | Advance one step. Completes the path on the last step. |
| `previous()` | `function` | Go back one step. No-op when already on the first step of a top-level path. |
| `cancel()` | `function` | Cancel the active path (or sub-path). |
| `goToStep(stepId)` | `function` | Jump directly to a step by ID. Calls `onLeave` / `onEnter` but bypasses guards and `shouldSkip`. |
| `goToStepChecked(stepId)` | `function` | Jump to a step by ID, checking `canMoveNext` (forward) or `canMovePrevious` (backward) first. Navigation is blocked if the guard returns false. |
| `setData(key, value)` | `function` | Update a single data value; triggers re-render via `stateChanged`. When `TData` is specified, `key` and `value` are type-checked against your data shape. |
| `restart(definition, data?)` | `function` | Tear down any active path (without firing hooks) and start the given path fresh. Safe to call at any time. Use for "Start over" / retry flows. |

### Typed snapshot data

`usePath` and `usePathContext` accept an optional generic so that `snapshot.data` is typed:

```ts
import type { PathData } from "@daltonr/pathwrite-core";

interface FormData extends PathData {
  name: string;
  age: number;
}

const { snapshot } = usePath<FormData>();
snapshot.value?.data.name;  // string
snapshot.value?.data.age;   // number
```

The generic is a **type-level assertion** — it narrows `snapshot.data` for convenience but is not enforced at runtime. Define your data shape once in a `PathDefinition<FormData>` and the types will stay consistent throughout.

`setData` is also typed against `TData` — passing a wrong key or mismatched value type is a compile-time error:

```ts
setData("name", 42);      // ✗ TS error: number is not assignable to string
setData("typo", "x");     // ✗ TS error: "typo" is not a key of FormData
setData("name", "Alice");  // ✓
```

## Design notes

- **`shallowRef`** — the snapshot is stored in a `shallowRef` for performance. The engine produces a new snapshot object on every change, so shallow reactivity is sufficient.
- **`readonly`** — the returned ref is wrapped with `readonly()` to prevent accidental external mutation.
- **`onScopeDispose`** — the composable automatically unsubscribes from the engine when the calling component's effect scope is disposed (i.e. on unmount).
- **No RxJS** — unlike the Angular adapter, there is no RxJS dependency. The composable is pure Vue.

## Snapshot guard booleans

The snapshot includes `canMoveNext` and `canMovePrevious` — the evaluated results of the current step's navigation guards. Use them to proactively disable buttons. These update automatically when data changes (e.g. after `setData`). Async guards default to `true` optimistically.

## Default UI — `PathShell`

`<PathShell>` is a ready-made shell component that renders a progress indicator, step content, and navigation buttons. Step content is provided via **named slots** matching each step's `id`.

```vue
<PathShell
  :path="myPath"
  :initial-data="{ name: '' }"
  @complete="handleDone"
>
  <template #details><DetailsForm /></template>
  <template #review><ReviewPanel /></template>
</PathShell>
```

> **⚠️ Important: Slot Names Must Match Step IDs**
>
> The slot names **must exactly match** the step IDs from your path definition:
>
> ```typescript
> const myPath: PathDefinition = {
>   id: 'signup',
>   steps: [
>     { id: 'details' },  // ← Step ID
>     { id: 'review' }    // ← Step ID
>   ]
> };
> ```
>
> ```vue
> <PathShell :path="myPath">
>   <template #details>  <!-- ✅ Matches "details" step -->
>     <DetailsForm />
>   </template>
>   <template #review>   <!-- ✅ Matches "review" step -->
>     <ReviewPanel />
>   </template>
>   <template #foo>      <!-- ❌ No step with id "foo" -->
>     <FooPanel />
>   </template>
> </PathShell>
> ```
>
> If a slot name doesn't match any step ID, that slot will never be rendered (silent — no error message).
>
> **💡 Tip:** Use your IDE's "Go to Definition" on the step ID in your path definition, then copy-paste the exact string when creating the slot. This ensures perfect matching and avoids typos.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `path` | `PathDefinition` | *required* | The path to run. |
| `engine` | `PathEngine` | — | An externally-managed engine. When provided, `PathShell` skips its own `start()` and drives the UI from this engine. |
| `initialData` | `PathData` | `{}` | Initial data passed to `engine.start()`. |
| `autoStart` | `boolean` | `true` | Start the path automatically on mount. |
| `backLabel` | `string` | `"Previous"` | Previous button label. |
| `nextLabel` | `string` | `"Next"` | Next button label. |
| `completeLabel` | `string` | `"Complete"` | Complete button label (last step). |
| `cancelLabel` | `string` | `"Cancel"` | Cancel button label. |
| `hideCancel` | `boolean` | `false` | Hide the Cancel button. |
| `hideProgress` | `boolean` | `false` | Hide the progress indicator. Also hidden automatically for single-step top-level paths. |
| `footerLayout` | `"wizard" \| "form" \| "auto"` | `"auto"` | Footer button layout. `"auto"` uses `"form"` for single-step top-level paths, `"wizard"` otherwise. `"wizard"`: Back on left, Cancel+Submit on right. `"form"`: Cancel on left, Submit on right, no Back button. |

### Emits

| Event | Payload | Description |
|-------|---------|-------------|
| `@complete` | `PathData` | Emitted when the path completes. |
| `@cancel` | `PathData` | Emitted when the path is cancelled. |
| `@event` | `PathEvent` | Emitted for every engine event. |

### Slots

| Slot | Scope | Description |
|------|-------|-------------|
| `#[stepId]` | `{ snapshot }` | Named slot rendered when the active step matches `stepId`. |
| `#header` | `{ snapshot }` | Replaces the default progress header. |
| `#footer` | `{ snapshot, actions }` | Replaces the default navigation footer. |

### Customising the header and footer

Use the `#header` and `#footer` slots to replace the built-in progress bar or navigation buttons with your own UI. The slot scope gives you the current `PathSnapshot`; `#footer` also provides an `actions` object with all navigation callbacks.

```vue
<PathShell :path="myPath">
  <template #header="{ snapshot }">
    <p>Step {{ snapshot.stepIndex + 1 }} of {{ snapshot.stepCount }}</p>
  </template>

  <template #footer="{ snapshot, actions }">
    <button @click="actions.previous" :disabled="snapshot.isFirstStep">Back</button>
    <button @click="actions.next"     :disabled="!snapshot.canMoveNext">
      {{ snapshot.isLastStep ? 'Complete' : 'Next' }}
    </button>
  </template>

  <template #details><DetailsForm /></template>
  <template #review><ReviewPanel /></template>
</PathShell>
```

`actions` contains: `next`, `previous`, `cancel`, `goToStep`, `goToStepChecked`, `setData`, `restart`.

### Resetting the path

There are two ways to reset `<PathShell>` to step 1.

**Option 1 — Toggle mount** (simplest, always correct)

Use `v-if` to destroy and recreate the shell:

```vue
<PathShell v-if="isActive" :path="myPath" @complete="isActive = false" @cancel="isActive = false">
  <template #details><DetailsForm /></template>
</PathShell>
<button v-else @click="isActive = true">Try Again</button>
```

**Option 2 — Call `restart()` on the shell ref** (in-place, no unmount)

Use a Vue template ref to call `restart()` on the shell instance:

```vue
<script setup>
import { ref } from 'vue';
const shellRef = ref();
</script>

<template>
  <PathShell ref="shellRef" :path="myPath" @complete="onDone">
    <template #details><DetailsForm /></template>
  </PathShell>

  <button @click="shellRef.restart()">Try Again</button>
</template>
```

`restart()` resets the path engine to step 1 with the original `:initial-data` without unmounting the component. Use this when you need to keep the shell mounted — for example, to preserve scroll position or drive a CSS transition.

### Context sharing

`<PathShell>` automatically provides its engine instance to child components via Vue's `provide` / `inject`. Step children can call `usePathContext()` to access the snapshot and actions without prop drilling:

```vue
<script setup>
import { usePathContext } from "@daltonr/pathwrite-vue";

const { snapshot, setData } = usePathContext();
</script>
```

```

### Template Example

```vue
<script setup lang="ts">
import { usePath, PathShell } from "@daltonr/pathwrite-vue";

const { snapshot, startSubPath } = usePath<ApprovalWorkflowData>();

function launchReviewForApprover(approverName: string, index: number) {
  // Pass correlation data via `meta` — it's echoed back to onSubPathComplete
  startSubPath(
    approverReviewPath,
    { decision: "", comments: "" },
    { approverName, approverIndex: index }
  );
}
</script>

<template>
  <PathShell :path="approvalWorkflowPath" :initial-data="{ documentTitle: '', approvers: [], approvals: [], currentApproverIndex: 0 }">
    <!-- Main path steps -->
    <template #setup>
      <input v-model="snapshot.data.documentTitle" placeholder="Document title" />
      <!-- approver selection UI here -->
    </template>

    <template #run-approvals>
      <h3>Approvers</h3>
      <ul>
        <li v-for="(approver, i) in snapshot.data.approvers" :key="i">
          {{ approver }}
          <button
            v-if="!snapshot.data.approvals.find(a => a.approver === approver)"
            @click="launchReviewForApprover(approver, i)"
          >
            Start Review
          </button>
          <span v-else>✓ {{ snapshot.data.approvals.find(a => a.approver === approver)?.decision }}</span>
        </li>
      </ul>
    </template>

    <template #summary>
      <h3>All Approvals Collected</h3>
      <ul>
        <li v-for="approval in snapshot.data.approvals" :key="approval.approver">
          {{ approval.approver }}: {{ approval.decision }}
        </li>
      </ul>
    </template>

    <!-- Sub-path steps (must be co-located in the same PathShell) -->
    <template #review>
      <p>Review the document: "{{ snapshot.data.documentTitle }}"</p>
    </template>

    <template #decision>
      <label><input type="radio" value="approve" v-model="snapshot.data.decision" /> Approve</label>
      <label><input type="radio" value="reject" v-model="snapshot.data.decision" /> Reject</label>
    </template>

    <template #comments>
      <textarea v-model="snapshot.data.comments" placeholder="Optional comments"></textarea>
    </template>
  </PathShell>
</template>
```

### Key Notes

**1. Sub-path steps must be co-located with main path steps**  
All named slots (main path + sub-path steps) live in the same `<PathShell>`. When a sub-path is active, the shell renders the sub-path's step slots. This means:
- Parent and sub-path step IDs **must not collide** (e.g., don't use `summary` in both)
- Sub-path step templates can access parent data by referencing the parent path definition, but `usePathContext()` returns the **sub-path** snapshot

**2. The `meta` correlation field**  
`startSubPath` accepts an optional third argument (`meta`) that is returned unchanged to `onSubPathComplete` and `onSubPathCancel`. Use it to correlate which collection item triggered the sub-path:

```ts
startSubPath(subPath, initialData, { itemIndex: 3, itemId: "abc" });

// In the parent step:
onSubPathComplete(subPathId, subPathData, ctx, meta) {
  const itemIndex = meta?.itemIndex; // 3
}
```

**3. Root progress bar persists during sub-paths**  
When `snapshot.nestingLevel > 0`, you're in a sub-path. The shell automatically renders a compact, muted **root progress bar** above the sub-path's own progress bar so users always see their place in the main flow. The `steps` array in the snapshot contains the sub-path's steps. Use `snapshot.rootProgress` (type `RootProgress`) in custom headers via `#header` slot to render your own persistent top-level indicator.

**4. Accessing parent path data from sub-path components**  
There is currently no `useParentPathContext()` composable. If a sub-path step needs parent data (e.g., the document title), pass it via `initialData` when calling `startSubPath`:

```ts
startSubPath(approverReviewPath, {
  decision: "",
  comments: "",
  documentTitle: snapshot.value.data.documentTitle // copy from parent
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

```ts
<PathShell :path="myPath" :initial-data="{ name: '', age: 0 }" />
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

## Peer dependencies

---

## Styling

`<PathShell>` renders structural HTML with BEM-style `pw-shell__*` CSS classes but ships with no embedded styles. Import the optional stylesheet for sensible defaults:

```ts
import "@daltonr/pathwrite-vue/styles.css";
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

```ts
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
  currentApproverIndex: number;
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
        data.documentTitle.trim().length > 0 &&
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


