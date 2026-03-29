# Getting Started — Vue

Pathwrite's Vue adapter wraps `@daltonr/pathwrite-core` and exposes path state as a reactive `shallowRef` that integrates with Vue's reactivity system, `computed()`, and the Composition API. There is no RxJS dependency.

## Installation

```bash
npm install @daltonr/pathwrite-core @daltonr/pathwrite-vue
```

All core types are re-exported from the Vue package:

```ts
import {
  usePath,
  usePathContext,
  PathShell,
  PathEngine,
  PathDefinition,
  PathData,
  PathSnapshot,
  PathEvent,
} from "@daltonr/pathwrite-vue";
```

---

## `usePath()` — composable

Creates an isolated path engine instance. The composable automatically unsubscribes from the engine when the calling component's effect scope is disposed (i.e. on unmount) — no manual cleanup needed.

### Options

| Option | Type | Description |
|--------|------|-------------|
| `engine` | `PathEngine` | An externally-managed engine (e.g. from `restoreOrStart()`). When provided, `usePath` subscribes to it instead of creating a new one. The caller owns the engine's lifecycle. |
| `onEvent` | `(event: PathEvent) => void` | Called for every engine event. |

### Return value

| Property | Type | Description |
|----------|------|-------------|
| `snapshot` | `DeepReadonly<Ref<PathSnapshot \| null>>` | Current snapshot wrapped in a readonly ref. `null` when no path is active. Triggers Vue re-renders on change. Access the value as `snapshot.value`. |
| `start(definition, data?)` | `function` | Start or re-start a path. |
| `startSubPath(definition, data?, meta?)` | `function` | Push a sub-path onto the stack. `meta` is returned unchanged to `onSubPathComplete` / `onSubPathCancel` on the parent step. |
| `next()` | `function` | Advance one step. Completes the path when called on the last step. |
| `previous()` | `function` | Go back one step. No-op on the first step of a top-level path. |
| `cancel()` | `function` | Cancel the active path (or sub-path). |
| `goToStep(stepId)` | `function` | Jump directly to a step by ID. Calls `onLeave` / `onEnter` but bypasses guards and `shouldSkip`. |
| `goToStepChecked(stepId)` | `function` | Jump to a step by ID, checking the current step's guard first. |
| `setData(key, value)` | `function` | Update a single data value. When `TData` is specified, `key` and `value` are type-checked against your data shape. |
| `restart(definition, data?)` | `function` | Tear down any active path (without firing hooks) and start fresh. Safe to call at any time. |

### Type parameter

Pass your data type as a generic to get typed access to `snapshot.value?.data` and `setData`:

```ts
interface ApplicationData extends PathData {
  firstName: string;
  email: string;
}

const { snapshot, setData } = usePath<ApplicationData>();
snapshot.value?.data.firstName;   // typed as string
setData("firstName", "Alice");    // OK
setData("firstName", 42);         // TS error
```

### Design notes

- **`shallowRef`** — the snapshot is stored as a `shallowRef`. The engine produces a new snapshot object on every change, so shallow reactivity is sufficient and more performant.
- **`readonly`** — the ref is wrapped with `readonly()` to prevent accidental external mutation.

---

## `usePathContext()` — reading state inside step components

When you use `<PathShell>`, child components injected via named slots can call `usePathContext()` to access the same engine instance. `<PathShell>` calls `provide()` internally; `usePathContext()` calls `inject()`.

```vue
<script setup>
import { usePathContext } from "@daltonr/pathwrite-vue";

const { snapshot, setData } = usePathContext<ApplicationData>();
</script>

<template>
  <input
    v-if="snapshot"
    :value="snapshot.value?.data.firstName ?? ''"
    @input="setData('firstName', ($event.target as HTMLInputElement).value)"
  />
</template>
```

`usePathContext()` must be called inside the setup function of a component that is a descendant of `<PathShell>`.

---

## `PathShell` — default UI component

`<PathShell>` renders a progress indicator, step content area, validation messages, and navigation buttons. You supply per-step content as **named slots** matching each step's ID.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `path` | `PathDefinition` | required | The path to run. |
| `initialData` | `PathData` | `{}` | Initial data passed to `engine.start()`. |
| `engine` | `PathEngine` | — | An externally-managed engine. When provided, `PathShell` skips its own `start()`. |
| `autoStart` | `boolean` | `true` | Start the path automatically on mount. |
| `backLabel` | `string` | `"Previous"` | Previous button label. |
| `nextLabel` | `string` | `"Next"` | Next button label. |
| `completeLabel` | `string` | `"Complete"` | Complete button label (last step). |
| `cancelLabel` | `string` | `"Cancel"` | Cancel button label. |
| `hideCancel` | `boolean` | `false` | Hide the Cancel button. |
| `hideProgress` | `boolean` | `false` | Hide the progress indicator. Also hidden automatically for single-step top-level paths. |
| `footerLayout` | `"wizard" \| "form" \| "auto"` | `"auto"` | `"wizard"`: Back on left, Cancel+Submit on right. `"form"`: Cancel on left, Submit on right, no Back. `"auto"` picks `"form"` for single-step paths. |
| `validationDisplay` | `"summary" \| "inline" \| "both"` | `"summary"` | Where `fieldErrors` are rendered. `"inline"` suppresses the shell's list so step components can render errors themselves. |

### Emits

| Event | Payload | Description |
|-------|---------|-------------|
| `@complete` | `PathData` | Emitted when the path completes. |
| `@cancel` | `PathData` | Emitted when the path is cancelled. |
| `@event` | `PathEvent` | Emitted for every engine event. |

### Slots

| Slot | Scope | Description |
|------|-------|-------------|
| `#[stepId]` | `{ snapshot }` | Named slot rendered when the active step matches `stepId`. The slot name must match the step ID exactly. |
| `#header` | `{ snapshot }` | Replaces the default progress header. |
| `#footer` | `{ snapshot, actions }` | Replaces the default navigation footer. `actions` contains `next`, `previous`, `cancel`, `goToStep`, `goToStepChecked`, `setData`, `restart`. |

### How named slots work

The slot name must exactly match the `id` of the corresponding step in your path definition:

```vue
<PathShell :path="myPath">
  <template #details>   <!-- matches step id="details" -->
    <DetailsForm />
  </template>
  <template #review>    <!-- matches step id="review" -->
    <ReviewPanel />
  </template>
</PathShell>
```

If a slot name does not match any step ID, that slot is never rendered (silent — no error).

### Gotcha — Vue slot name casing

Vue normalises slot names to camelCase in some contexts. If your step ID contains a hyphen (e.g. `"cover-note"`), declare the slot with a quoted `v-slot` binding or the `#` shorthand with a quoted name:

```vue
<!-- Hyphenated step IDs work reliably when the slot name is quoted -->
<template #cover-note>
  <CoverNoteForm />
</template>
```

Vue 3 handles hyphenated slot names correctly in templates, but be aware that programmatic slot access (e.g. `$slots['cover-note']`) must use the exact hyphenated form. When in doubt, prefer step IDs that contain only lowercase letters and hyphens, and use the `#<id>` shorthand exactly.

### Styling

`<PathShell>` ships with no embedded styles. Import the optional stylesheet for sensible defaults:

```ts
import "@daltonr/pathwrite-vue/styles.css";
```

All visual values are CSS custom properties:

```css
:root {
  --pw-color-primary: #8b5cf6;
  --pw-shell-radius: 12px;
}
```

---

## Complete example

A two-step job-application form. The first step collects personal details with `fieldErrors` validation. The second step uses `usePathContext` inside the slot component to read and update state.

```ts
// application-path.ts
import type { PathDefinition, PathData } from "@daltonr/pathwrite-vue";

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

```vue
<!-- DetailsStep.vue — reads state via usePathContext -->
<script setup lang="ts">
import { usePathContext } from "@daltonr/pathwrite-vue";
import type { ApplicationData } from "./application-path";

const { snapshot, setData } = usePathContext<ApplicationData>();
</script>

<template>
  <div v-if="snapshot">
    <div>
      <label for="firstName">First name</label>
      <input
        id="firstName"
        :value="snapshot.value?.data.firstName ?? ''"
        @input="setData('firstName', ($event.target as HTMLInputElement).value)"
      />
      <p
        v-if="snapshot.value?.hasAttemptedNext && snapshot.value?.fieldErrors.firstName"
        class="error"
      >
        {{ snapshot.value?.fieldErrors.firstName }}
      </p>
    </div>
    <div>
      <label for="email">Email</label>
      <input
        id="email"
        type="email"
        :value="snapshot.value?.data.email ?? ''"
        @input="setData('email', ($event.target as HTMLInputElement).value)"
      />
      <p
        v-if="snapshot.value?.hasAttemptedNext && snapshot.value?.fieldErrors.email"
        class="error"
      >
        {{ snapshot.value?.fieldErrors.email }}
      </p>
    </div>
  </div>
</template>
```

```vue
<!-- CoverNoteStep.vue -->
<script setup lang="ts">
import { usePathContext } from "@daltonr/pathwrite-vue";
import type { ApplicationData } from "./application-path";

const { snapshot, setData } = usePathContext<ApplicationData>();
</script>

<template>
  <div v-if="snapshot">
    <label for="coverNote">Cover note</label>
    <textarea
      id="coverNote"
      rows="6"
      :value="snapshot.value?.data.coverNote ?? ''"
      @input="setData('coverNote', ($event.target as HTMLTextAreaElement).value)"
      placeholder="Tell us why you're a great fit..."
    />
    <p
      v-if="snapshot.value?.hasAttemptedNext && snapshot.value?.fieldErrors.coverNote"
      class="error"
    >
      {{ snapshot.value?.fieldErrors.coverNote }}
    </p>
  </div>
</template>
```

```vue
<!-- JobApplicationFlow.vue — host component -->
<script setup lang="ts">
import { PathShell } from "@daltonr/pathwrite-vue";
import { applicationPath, type ApplicationData } from "./application-path";
import DetailsStep from "./DetailsStep.vue";
import CoverNoteStep from "./CoverNoteStep.vue";

function handleComplete(data: ApplicationData) {
  console.log("Application submitted:", data);
}
</script>

<template>
  <PathShell
    :path="applicationPath"
    :initial-data="{ firstName: '', email: '', coverNote: '' }"
    :validation-display="'inline'"
    @complete="handleComplete"
  >
    <template #details>
      <DetailsStep />
    </template>

    <template #cover-note>
      <CoverNoteStep />
    </template>
  </PathShell>
</template>
```

**What this demonstrates:**

- `fieldErrors` on each step; `canMoveNext` is auto-derived (no explicit guard needed when `fieldErrors` is present and `canMoveNext` is omitted).
- `snapshot.hasAttemptedNext` gates inline error display.
- `usePathContext()` inside slot components — context is provided automatically by `<PathShell>`.
- `validationDisplay="inline"` so the step component renders its own inline errors.
- A hyphenated step ID (`"cover-note"`) used as a named slot (`#cover-note`).

---

## Resetting the path

**Option 1 — Toggle mount** (simplest):

```vue
<template>
  <PathShell
    v-if="isActive"
    :path="applicationPath"
    @complete="isActive = false"
    @cancel="isActive = false"
  >
    <template #details><DetailsStep /></template>
    <template #cover-note><CoverNoteStep /></template>
  </PathShell>
  <button v-else @click="isActive = true">Try Again</button>
</template>

<script setup>
import { ref } from "vue";
const isActive = ref(true);
</script>
```

**Option 2 — Call `restart()` on the shell ref** (in-place, no unmount):

```vue
<script setup>
import { ref } from "vue";
const shellRef = ref();
</script>

<template>
  <PathShell ref="shellRef" :path="applicationPath" @complete="onDone">
    <template #details><DetailsStep /></template>
  </PathShell>
  <button @click="shellRef.restart()">Start Over</button>
</template>
```

`restart()` resets to step 1 with the original `:initial-data` without unmounting the component.
