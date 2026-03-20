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
| `startSubPath(definition, data?)` | `function` | Push a sub-path. Requires an active path. |
| `next()` | `function` | Advance one step. Completes the path on the last step. |
| `previous()` | `function` | Go back one step. Cancels the path from the first step. |
| `cancel()` | `function` | Cancel the active path (or sub-path). |
| `goToStep(stepId)` | `function` | Jump directly to a step by ID. Calls `onLeave` / `onEnter` but bypasses guards and `shouldSkip`. |
| `setData(key, value)` | `function` | Update a single data value; triggers re-render via `stateChanged`. |

## Design notes

- **`shallowRef`** — the snapshot is stored in a `shallowRef` for performance. The engine produces a new snapshot object on every change, so shallow reactivity is sufficient.
- **`readonly`** — the returned ref is wrapped with `readonly()` to prevent accidental external mutation.
- **`onScopeDispose`** — the composable automatically unsubscribes from the engine when the calling component's effect scope is disposed (i.e. on unmount).
- **No RxJS** — unlike the Angular adapter, there is no RxJS dependency. The composable is pure Vue.

## Snapshot guard booleans

The snapshot includes `canMoveNext` and `canMovePrevious` — the evaluated results of the current step's navigation guards. Use them to proactively disable buttons. These update automatically when data changes (e.g. after `setData`). Async guards default to `true` optimistically.

## `usePathContext` — context sharing

`<PathShell>` automatically provides its engine instance to child components via Vue's `provide` / `inject`. Step children can call `usePathContext()` to access the snapshot and actions without prop drilling:

```vue
<script setup>
import { usePathContext } from "@daltonr/pathwrite-vue";

const { snapshot, setData } = usePathContext();
</script>
```

`usePathContext()` throws if called outside a `<PathShell>`.

## `resolveStepContent` — custom shells with `PathStep`

`PathStep` is a metadata marker — it never renders anything itself. `PathShell` uses the exported `resolveStepContent()` utility internally to find the matching step content. You can use the same utility in a custom shell:

```ts
import { usePath, PathStep, resolveStepContent } from "@daltonr/pathwrite-vue";

// In a custom shell's render function:
const content = resolveStepContent(slots, snapshot.value!);
```

See the [Developer Guide](../../DEVELOPER_GUIDE.md) for a full custom shell example.

## Peer dependencies

| Package | Version |
|---------|---------|
| `vue` | `>=3.3.0` |

