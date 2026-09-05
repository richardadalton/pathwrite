# @daltonr/pathwrite-vue

Vue 3 adapter for Pathwrite — exposes path engine state as a reactive `shallowRef` that integrates with the Composition API, `computed()`, and Vue's reactivity system.

## Installation

```bash
npm install @daltonr/pathwrite-core @daltonr/pathwrite-vue
```

Peer dependencies: Vue 3.3+

---

## Quick start

```typescript
// signup-path.ts — the data type and path, shared by every step component
import type { PathDefinition, PathData } from "@daltonr/pathwrite-core";

export interface SignupData extends PathData {
  name: string;
  email: string;
}

export const signupPath: PathDefinition<SignupData> = {
  id: "signup",
  steps: [
    { id: "details", title: "Your Details" },
    { id: "review",  title: "Review" },
  ],
};
```

```vue
<!-- SignupFlow.vue -->
<script setup lang="ts">
import { PathShell } from "@daltonr/pathwrite-vue";
import type { PathData } from "@daltonr/pathwrite-core";
import { signupPath } from "./signup-path";
import DetailsStep from "./DetailsStep.vue";
import ReviewStep from "./ReviewStep.vue";

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
import type { SignupData } from "./signup-path";

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
| `snapshot` | `DeepReadonly<Ref<PathSnapshot \| null>>` | Current snapshot ref. `null` when no path is active or when `completionBehaviour: "dismiss"` is used. With the default `"stayOnFinal"`, the ref holds a snapshot with `status === "completed"` after the path finishes. Access the value as `snapshot.value`. |
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
| `retry()` | function | Re-run the operation that set `snapshot.value.error`. Increments `retryCount` on repeated failure. No-op when there is no pending error. |
| `restart()` | function | Tear down the active path without firing hooks and restart the root path with the `initialData` from the original `start()`. Takes no arguments; rejects if nothing has been started. |
| `validate()` | function | Set `snapshot.value.hasValidated` without navigating. Triggers all inline field errors simultaneously. Used to validate all tabs in a nested shell at once. |

---

## PathShell props

`<PathShell>` renders a progress indicator, step content area, validation messages, and navigation buttons. Step content is provided as **named slots** matching each step's ID. Hyphenated step IDs work correctly as slot names (e.g. `#cover-note` for step id `"cover-note"`).

| Prop | Type | Default | Description |
|---|---|---|---|
| `path` | `PathDefinition` | required | The path to run. |
| `initialData` | `PathData` | `{}` | Initial data passed to `engine.start()`. Overridden by the stored snapshot when `restoreKey` is set. |
| `engine` | `PathEngine` | — | An externally-managed engine (e.g. from `restoreOrStart()`). When provided, `PathShell` skips its own `start()`. May be provided after mount (e.g. once an async `restoreOrStart()` resolves): the shell adopts it, re-subscribing and re-seeding from the new engine. Set `autoStart` to `false` if the shell should not start its own path in the meantime. |
| `restoreKey` | `string` | — | When set, the shell automatically saves its full state (data + active step) into the nearest outer `PathShell`'s data under this key on every change, and restores from it on remount. No-op on a top-level shell. The stored value also carries the inner engine's serialized state, so a remount restores in place: no `onEnter` / `onLeave` re-run, attempted / visited state kept. |
| `autoStart` | `boolean` | `true` | Start the path automatically on mount. |
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
| `validationDisplay` | `"summary" \| "inline" \| "both"` | `"summary"` | Where `fieldErrors` are rendered. Use `"inline"` so slot components render their own errors. |
| `progressLayout` | `"merged" \| "split" \| "rootOnly" \| "activeOnly"` | `"merged"` | How the root and sub-path progress bars are arranged while a sub-path is active. |
| `services` | `object \| null` | `null` | Services object available to slot components via `usePathContext<TData, TServices>().services`. |

The component instance exposes `restart()` for template refs (`shellRef.value.restart()`), which restarts the path with its original `initialData` without remounting.

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
| `#header` | `{ snapshot }` | Replaces the default progress header. A custom header is shown even for single-step paths, and hidden under `hideProgress` or `layout="tabs"`. |
| `#footer` | `{ snapshot, actions }` | Replaces the default navigation footer. `actions` contains `next`, `previous`, `cancel`, `goToStep`, `goToStepChecked`, `setData`, `restart`, `retry`, `suspend`. |
| `#completion` | `{ snapshot }` | Rendered when `snapshot.status === "completed"` (`completionBehaviour: "stayOnFinal"`). Receives the completed snapshot. If omitted, a default "All done." panel is shown. |

---

## usePathContext

`usePathContext<TData, TServices>()` reads the engine instance provided by the nearest `<PathShell>` ancestor. It returns the same shape as `usePath` — `snapshot`, `next`, `previous`, `cancel`, `setData`, and the rest of the action callbacks. Here `snapshot` is typed `DeepReadonly<Ref<PathSnapshot>>` — non-null, since slot components only render while a path is active. Read it as `snapshot.value` in `<script setup>`; inside `<template>` the ref auto-unwraps, so write `snapshot.data` rather than `snapshot.value.data`. Pass your data type as `TData` to get typed access to `snapshot.value.data` and `setData`; pass `TServices` to type the returned `services` value (the object given to `PathShell`'s `services` prop). Must be called inside the `setup` function of a component that is a descendant of `<PathShell>`.

---

## Further reading

- [Vue getting started guide](../../docs/getting-started/frameworks/vue.md)
- [Navigation guide](../../docs/developer-guide/04-navigation.md)
- [Full docs](../../docs/README.md)

---

© 2026 Devjoy Ltd. MIT License.
