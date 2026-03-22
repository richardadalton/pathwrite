# demo-vue-wizard

**Recipe 2 — Linear Onboarding Wizard**

A 4-step linear wizard built with Pathwrite and the Vue adapter. Demonstrates
guards, per-field validation, and a final review step before completion.

## Steps

| # | Step | Key concepts |
|---|------|-------------|
| 1 | **Personal Info** | `fieldMessages` auto-derives `canMoveNext`; errors shown only after first Next attempt |
| 2 | **About You** | Explicit `canMoveNext` guard + `fieldMessages` together; optional field (Company) |
| 3 | **Preferences** | No guard — all fields have defaults; radio buttons + toggle |
| 4 | **Review** | Read-only summary of all collected data |

## Core vs Adapter

- **Core** (`onboarding.ts`) — pure TypeScript, zero Vue imports. Path definition,
  guards, validation, and shared types all live here. Identical logic to the Angular,
  React, and Svelte wizard demos.
- **Adapter** — `<PathShell>` with named slots handles progress bar, navigation, and
  step rendering. Each step uses `usePathContext()` for reactive, composable engine access.

## Project structure

```
src/
├── main.ts               – mounts Vue app, imports shell CSS
├── App.vue               – page state, PathShell with named slots
├── onboarding.ts         – PathDefinition, OnboardingData type, shared labels
├── PersonalInfoStep.vue  – Step 1: name + email, fieldMessages only
├── AboutYouStep.vue      – Step 2: job title + experience, guard + fieldMessages
├── PreferencesStep.vue   – Step 3: theme radios + notifications toggle
├── ReviewStep.vue        – Step 4: read-only summary
└── style.css             – page + shell override + step styles
```

## Key patterns

### PathShell with named slots

```vue
<PathShell
  :path="onboardingPath"
  :initial-data="INITIAL_DATA"
  complete-label="Complete Onboarding"
  cancel-label="Cancel"
  @complete="handleComplete"
  @cancel="handleCancel"
>
  <template #personal-info><PersonalInfoStep /></template>
  <template #about-you><AboutYouStep /></template>
  <template #preferences><PreferencesStep /></template>
  <template #review><ReviewStep /></template>
</PathShell>
```

### Accessing engine state inside a step

```vue
<script setup lang="ts">
import { computed } from "vue";
import { usePathContext } from "@daltonr/pathwrite-vue";

const { snapshot, setData } = usePathContext<OnboardingData>();
const errors = computed(() =>
  snapshot.value?.hasAttemptedNext ? (snapshot.value.fieldMessages ?? {}) : {}
);
</script>

<template>
  <input :value="snapshot?.data['firstName']"
         @input="setData('firstName', $event.target.value.trim())" />
</template>
```

`usePathContext()` is a Composition API composable — `snapshot` is a `Ref`,
making it fully reactive with `computed()`, `watch()`, and template bindings.

## Running locally

```bash
npm install
npm start
```

Open [http://localhost:5173](http://localhost:5173).

