# demo-vue-form

A Pathwrite demo showing how to use a **single-step Path as a standalone form** with Vue (`@daltonr/pathwrite-vue` v0.5.0).

Same contact form as `demo-angular-form`, `demo-react-form`, and `demo-svelte-form` — built side-by-side to compare all four adapters.

---

## What it demonstrates

| Feature | How it's used here |
|---|---|
| `<PathShell>` component | Renders the form body, validation messages and footer automatically |
| Named slots | `<template #contact>` — slot name matches the step ID (Vue's idiomatic slot pattern) |
| `usePathContext()` | Called inside `ContactStep.vue` to get `snapshot` and `setData` — no prop drilling |
| `canMoveNext` guard | Blocks submission until all fields are valid |
| `validationMessages` | Surfaces per-rule errors in the shell's built-in orange message area |
| `@complete` event | Fires when the user clicks "Send Message" |
| `@cancel` event | Fires when the user clicks "Discard" |
| Auto-hidden progress | Single-step paths hide the progress header automatically — no `hide-progress` prop needed |
| `complete-label` / `cancel-label` | Re-labelled to "Send Message" / "Discard" |
| `ref()` / `v-if` | `isSubmitted` / `isCancelled` refs and `v-if` blocks toggle between form and result panels |

---

## Project structure

```
src/
├── main.ts           – mounts Vue app
├── App.vue           – page state (submitted / cancelled), renders PathShell
├── ContactStep.vue   – step content; calls usePathContext() for data access
├── path.ts           – PathDefinition, ContactData type, validation helpers
└── style.css         – page + form + pw-shell override styles
```

---

## The path

```typescript
// path.ts
export const contactFormPath: PathDefinition<ContactData> = {
  id: "contact-form",
  steps: [{
    id: "contact",
    onEnter: ({ isFirstEntry }) =>
      isFirstEntry ? { name: "", email: "", subject: "", message: "" } : undefined,
    canMoveNext: ({ data }) => getValidationMessages(data).length === 0,
    validationMessages: ({ data }) => getValidationMessages(data)
  }]
};
```

---

## Key patterns

### PathShell with named slots

```vue
<PathShell
  :path="contactFormPath"
  complete-label="Send Message"
  cancel-label="Discard"
  @complete="handleComplete"
  @cancel="handleCancel"
>
  <!-- Named slot — slot name must match the step ID -->
  <template #contact>
    <ContactStep />
  </template>
</PathShell>
```

The step component is passed as a named slot directly in the parent template. The slot name must match the step ID. This is the most visually self-documenting pattern across all four adapters.

### Accessing engine state inside a step component

```vue
<!-- ContactStep.vue -->
<script setup lang="ts">
import { usePathContext } from "@daltonr/pathwrite-vue";
import type { ContactData } from "./path";

const { snapshot, setData } = usePathContext<ContactData>();
</script>

<template>
  <input
    :value="snapshot.data['name']"
    @input="setData('name', ($event.target as HTMLInputElement).value)"
  />
</template>
```

`usePathContext()` matches React's hook ergonomics — one call, full engine access, no prop drilling or provide/inject boilerplate needed by the developer.

### Resetting the form

```typescript
function tryAgain() {
  isSubmitted.value = false;
  isCancelled.value = false;
  submittedData.value = null;
}
```

Resetting the refs causes the `v-if` blocks to re-evaluate, which destroys and re-creates `<PathShell>` — auto-starting a fresh path.

---

## Run

```bash
# From the workspace root:
npm install
cd apps/vue-demos/demo-vue-form
npm install
npm start
```

Then open **http://localhost:5173** in your browser.

---

## Comparison with Angular, React, and Svelte

| | Angular | React | Vue | Svelte |
|---|---|---|---|---|
| Shell component | `<pw-shell>` | `<PathShell>` | `<PathShell>` | `<PathShell>` |
| Step content | `<ng-template pwStep="contact">` | `steps={{ contact: <ContactStep /> }}` | `<template #contact>` | `contact={ContactStep}` |
| Data access in step | `#shell` ref → `shell.facade.setData()` | `usePathContext()` hook | `usePathContext()` composable | `getPathContext()` |
| Reset | Toggle `@if` | Toggle `useState` | Toggle `v-if` | Toggle `$state` |
| Event handling | `(completed)` / `(cancelled)` | `onComplete` / `onCancel` | `@complete` / `@cancel` | `oncomplete` / `oncancel` |

Vue's **named slots** pattern is the most self-documenting — the step content sits directly in the parent template next to `<PathShell>`, making the structure obvious at a glance without any special directives or JS objects. `usePathContext()` as a composable is idiomatic Vue and matches the ergonomics of React's hook.
