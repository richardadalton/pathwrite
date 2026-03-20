# @pathwrite/vue-adapter

Vue 3 composable over `@pathwrite/core`. Exposes path state as a reactive `shallowRef` that integrates seamlessly with Vue's reactivity system, templates, and `computed()`.

## Setup

```vue
<script setup lang="ts">
import { usePath } from "@pathwrite/vue-adapter";
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
    <button @click="previous" :disabled="snapshot.isNavigating">Back</button>
    <button @click="next" :disabled="snapshot.isNavigating">
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

## Peer dependencies

| Package | Version |
|---------|---------|
| `vue` | `>=3.3.0` |

