# @daltonr/pathwrite-vue

Vue 3 adapter for Pathwrite — exposes path engine state as a reactive `shallowRef` that integrates with the Composition API, `computed()`, and Vue's reactivity system.

## Installation

```bash
npm install @daltonr/pathwrite-core @daltonr/pathwrite-vue
```

Peer dependencies: Vue 3.3+

---

## Quick start

```vue
<!-- SignupFlow.vue -->
<script setup lang="ts">
import { PathShell } from "@daltonr/pathwrite-vue";
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

function handleComplete(data: PathData) {
  console.log("Done!", data);
}
</script>

<template>
  <PathShell
    :path="signupPath"
    :initial-data="{ name: '', email: '' }"
    @complete="handleComplete"
  >
    <template #details><DetailsStep /></template>
    <template #review><ReviewStep /></template>
  </PathShell>
</template>
```

```vue
<!-- DetailsStep.vue -->
<script setup lang="ts">
import { usePathContext } from "@daltonr/pathwrite-vue";

const { snapshot, setData } = usePathContext<SignupData>();
</script>

<template>
  <div v-if="snapshot">
    <input :value="snapshot.data.name" @input="setData('name', ($event.target as HTMLInputElement).value)" placeholder="Name" />
    <input :value="snapshot.data.email" @input="setData('email', ($event.target as HTMLInputElement).value)" placeholder="Email" />
  </div>
</template>
```

Step components call `usePathContext()` inside named slots to access engine state. `<PathShell>` provides the context automatically via `provide` / `inject`.

---

## usePath

`usePath<TData, TServices>()` creates an isolated path engine instance. The composable automatically unsubscribes when the calling component's effect scope is disposed — no manual cleanup needed.

| Return value | Type | Description |
|---|---|---|
| `snapshot` | `DeepReadonly<Ref<PathSnapshot \| null>>` | Current snapshot ref. `null` when no path is active. Access the value as `snapshot.value`. |
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
| `restart(definition, data?)` | function | Tear down the active path without firing hooks and start fresh. |

---

## PathShell props

`<PathShell>` renders a progress indicator, step content area, validation messages, and navigation buttons. Step content is provided as **named slots** matching each step's ID. Hyphenated step IDs work correctly as slot names (e.g. `#cover-note` for step id `"cover-note"`).

| Prop | Type | Default | Description |
|---|---|---|---|
| `path` | `PathDefinition` | required | The path to run. |
| `initialData` | `PathData` | `{}` | Initial data passed to `engine.start()`. |
| `engine` | `PathEngine` | — | An externally-managed engine. When provided, `PathShell` skips its own `start()`. |
| `validationDisplay` | `"summary" \| "inline" \| "both"` | `"summary"` | Where `fieldErrors` are rendered. Use `"inline"` so slot components render their own errors. |
| `footerLayout` | `"wizard" \| "form" \| "auto"` | `"auto"` | `"wizard"`: Back on left, Cancel+Submit on right. `"form"`: Cancel on left, Submit on right, no Back. `"auto"` picks `"form"` for single-step paths. |
| `hideProgress` | `boolean` | `false` | Hide the progress indicator. Also hidden automatically for single-step top-level paths. |

**Emits:**

| Event | Payload | Description |
|---|---|---|
| `@complete` | `PathData` | Emitted when the path completes. |
| `@cancel` | `PathData` | Emitted when the path is cancelled. |
| `@event` | `PathEvent` | Emitted for every engine event. |

**Slots:**

| Slot | Scope | Description |
|---|---|---|
| `#[stepId]` | `{ snapshot }` | Named slot rendered when the active step matches `stepId`. Name must match the step ID exactly. |
| `#header` | `{ snapshot }` | Replaces the default progress header. |
| `#footer` | `{ snapshot, actions }` | Replaces the default navigation footer. `actions` contains `next`, `previous`, `cancel`, `goToStep`, `goToStepChecked`, `setData`, `restart`. |

---

## usePathContext

`usePathContext<TData, TServices>()` reads the engine instance provided by the nearest `<PathShell>` ancestor. It returns the same shape as `usePath` — `snapshot`, `next`, `previous`, `cancel`, `setData`, and the rest of the action callbacks. The `snapshot` is the same `DeepReadonly<Ref<PathSnapshot | null>>` — access the current value as `snapshot.value`. Pass your data type as `TData` to get typed access to `snapshot.value?.data` and `setData`; pass `TServices` to type the `services` field on `PathStepContext`. Must be called inside the `setup` function of a component that is a descendant of `<PathShell>`.

---

## Further reading

- [Vue getting started guide](../../docs/getting-started/frameworks/vue.md)
- [Navigation guide](../../docs/guides/navigation.md)
- [Full docs](../../docs/README.md)

---

© 2026 Devjoy Ltd. MIT License.
