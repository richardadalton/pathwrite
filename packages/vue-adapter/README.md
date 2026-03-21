# @daltonr/pathwrite-vue

Vue 3 composable over `@daltonr/pathwrite-core`. Exposes path state as a reactive `shallowRef` that integrates seamlessly with Vue's reactivity system, templates, and `computed()`.

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

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `path` | `PathDefinition` | *required* | The path to run. |
| `initialData` | `PathData` | `{}` | Initial data passed to `engine.start()`. |
| `autoStart` | `boolean` | `true` | Start the path automatically on mount. |
| `backLabel` | `string` | `"Back"` | Back button label. |
| `nextLabel` | `string` | `"Next"` | Next button label. |
| `finishLabel` | `string` | `"Finish"` | Finish button label (last step). |
| `cancelLabel` | `string` | `"Cancel"` | Cancel button label. |
| `hideCancel` | `boolean` | `false` | Hide the Cancel button. |
| `hideProgress` | `boolean` | `false` | Hide the progress indicator. |

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
      {{ snapshot.isLastStep ? 'Finish' : 'Next' }}
    </button>
  </template>

  <template #details><DetailsForm /></template>
  <template #review><ReviewPanel /></template>
</PathShell>
```

`actions` contains: `next`, `previous`, `cancel`, `goToStep`, `goToStepChecked`, `setData`, `restart`.

### Context sharing

`<PathShell>` automatically provides its engine instance to child components via Vue's `provide` / `inject`. Step children can call `usePathContext()` to access the snapshot and actions without prop drilling:

```vue
<script setup>
import { usePathContext } from "@daltonr/pathwrite-vue";

const { snapshot, setData } = usePathContext();
</script>
```

`usePathContext()` throws if called outside a `<PathShell>`.

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

---

## Peer dependencies

| Package | Version |
|---------|---------|
| `vue` | `>=3.3.0` |

