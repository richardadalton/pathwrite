# demo-svelte-form

A Pathwrite demo showing how to use a **single-step Path as a standalone form** with Svelte 5 (`@daltonr/pathwrite-svelte` v0.5.0).

Same contact form as `demo-angular-form`, `demo-react-form`, and `demo-vue-form` — built side-by-side to compare all four adapters.

---

## What it demonstrates

| Feature | How it's used here |
|---|---|
| `<PathShell>` component | Renders the form body, validation messages and footer automatically |
| Snippet props | `contact={ContactStep}` — prop name matches the step ID (Svelte 5 snippet pattern) |
| `getPathContext()` | Called inside `ContactStep.svelte` to get `snapshot` and `setData` — no props needed |
| `canMoveNext` guard | Blocks submission until all fields are valid |
| `validationMessages` | Surfaces per-rule errors in the shell's built-in orange message area |
| `oncomplete` callback | Fires when the user clicks "Send Message" (Svelte 5 uses callbacks, not events) |
| `oncancel` callback | Fires when the user clicks "Discard" |
| `hideProgress` | No progress bar for a single-step form |
| `completeLabel` / `cancelLabel` | Re-labelled to "Send Message" / "Discard" |
| `$state` runes | Svelte 5 reactivity for `isSubmitted` / `isCancelled` / `submittedData` |
| `$derived` rune | Reactive character count in `ContactStep.svelte` |

---

## Project structure

```
src/
├── main.ts           – mounts Svelte app
├── App.svelte        – page state (submitted / cancelled), renders PathShell
├── ContactStep.svelte – step content; calls getPathContext() for data access
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

### PathShell with snippet props

```svelte
<PathShell
  path={contactFormPath}
  hideProgress
  completeLabel="Send Message"
  cancelLabel="Discard"
  oncomplete={handleComplete}
  oncancel={handleCancel}
  contact={ContactStep}
/>
```

The `contact` prop passes the step component as a **snippet** (Svelte 5 pattern). The prop name must match the step ID.

### Accessing engine state inside a step component

```svelte
<!-- ContactStep.svelte -->
<script lang="ts">
  import { getPathContext } from "@daltonr/pathwrite-svelte";
  import type { ContactData } from "./path";

  const ctx = getPathContext<ContactData>();
</script>

<input
  value={ctx.snapshot.data.name ?? ""}
  oninput={(e) => ctx.setData("name", e.currentTarget.value)}
/>
```

### Resetting the form

Toggle `isSubmitted` / `isCancelled` `$state` runes to unmount and remount `<PathShell>`. Svelte destroys and recreates it, which auto-starts a fresh path.

---

## Run

```bash
# From the workspace root:
npm install
cd apps/svelte-demos/demo-svelte-form
npm install
npm start
```

Then open **http://localhost:5173** in your browser.

---

## Comparison with Angular, React, and Vue

| | Angular | React | Vue | Svelte |
|---|---|---|---|---|
| Shell component | `<pw-shell>` | `<PathShell>` | `<PathShell>` | `<PathShell>` |
| Step content | `<ng-template pwStep="contact">` | `steps={{ contact: <ContactStep /> }}` | `<template #contact>` | `contact={ContactStep}` |
| Data access in step | `#shell` ref → `shell.facade.setData()` | `usePathContext()` hook | `usePathContext()` composable | `getPathContext()` |
| Reset | Toggle `@if` | Toggle `useState` | Toggle `v-if` | Toggle `$state` |
| Event handling | `(completed)` / `(cancelled)` | `onComplete` / `onCancel` | `@complete` / `@cancel` | `oncomplete` / `oncancel` |

Svelte's **snippet prop pattern** (`contact={ContactStep}`) is clean and concise — simpler than Vue's template syntax, more intuitive than React's object, and far better than Angular's directive.

**Svelte 5 runes** (`$state`, `$derived`) make reactivity explicit and predictable, matching the clarity of React hooks.

