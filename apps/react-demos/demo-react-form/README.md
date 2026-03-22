# demo-react-form

A Pathwrite demo showing how to use a **single-step Path as a standalone form** with React (`@daltonr/pathwrite-react` v0.5.0).

Same contact form as `demo-angular-form`, `demo-vue-form`, and `demo-svelte-form` — built side-by-side to compare all four adapters.

---

## What it demonstrates

| Feature | How it's used here |
|---|---|
| `<PathShell>` component | Renders the form body, validation messages and footer automatically |
| `steps` prop | `{ contact: <ContactStep /> }` — key matches the step ID (React JSX map pattern) |
| `usePathContext()` | Called inside `ContactStep.tsx` to get `snapshot` and `setData` — no prop drilling needed |
| `canMoveNext` guard | Blocks submission until all fields are valid |
| `validationMessages` | Surfaces per-rule errors in the shell's built-in orange message area |
| `onComplete` callback | Fires when the user clicks "Send Message" |
| `onCancel` callback | Fires when the user clicks "Discard" |
| `hideProgress` | No progress bar for a single-step form |
| `completeLabel` / `cancelLabel` | Re-labelled to "Send Message" / "Discard" |
| `useState` hooks | `isSubmitted` / `isCancelled` / `submittedData` drive the page state |

---

## Project structure

```
src/
├── main.tsx          – mounts React app
├── App.tsx           – page state (submitted / cancelled), renders PathShell
├── ContactStep.tsx   – step content; calls usePathContext() for data access
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

### PathShell with a steps map

```tsx
<PathShell
  path={contactFormPath}
  hideProgress
  completeLabel="Send Message"
  cancelLabel="Discard"
  onComplete={handleComplete}
  onCancel={handleCancel}
  steps={{ contact: <ContactStep /> }}
/>
```

The `steps` prop is a `Record<string, ReactNode>` — each key must match a step ID. JSX is evaluated eagerly when `<PathShell>` renders, so step components should handle `snapshot === null` gracefully on first render.

### Accessing engine state inside a step component

```tsx
// ContactStep.tsx — no props needed, no ref forwarding
function ContactStep() {
  const { snapshot, setData } = usePathContext<ContactData>();
  const data = snapshot?.data ?? {} as ContactData;

  return (
    <input
      value={data.name ?? ""}
      onChange={(e) => setData("name", e.target.value)}
    />
  );
}
```

`usePathContext()` is the key React adapter primitive — one import, full engine access, no prop drilling or context wiring needed by the developer.

### Resetting the form

```tsx
function tryAgain() {
  setIsSubmitted(false);
  setIsCancelled(false);
  setSubmittedData(null);
}
```

Resetting the flags causes the conditional render to re-evaluate, which destroys and re-creates `<PathShell>` — auto-starting a fresh path.

---

## Run

```bash
# From the workspace root:
npm install
cd apps/react-demos/demo-react-form
npm install
npm start
```

Then open **http://localhost:5173** in your browser.

---

## Comparison with Angular, Vue, and Svelte

| | Angular | React | Vue | Svelte |
|---|---|---|---|---|
| Shell component | `<pw-shell>` | `<PathShell>` | `<PathShell>` | `<PathShell>` |
| Step content | `<ng-template pwStep="contact">` | `steps={{ contact: <ContactStep /> }}` | `<template #contact>` | `contact={ContactStep}` |
| Data access in step | `#shell` ref → `shell.facade.setData()` | `usePathContext()` hook | `usePathContext()` composable | `getPathContext()` |
| Reset | Toggle `@if` | Toggle `useState` | Toggle `v-if` | Toggle `$state` |
| Event handling | `(completed)` / `(cancelled)` | `onComplete` / `onCancel` | `@complete` / `@cancel` | `oncomplete` / `oncancel` |

React's **`usePathContext()` hook** is the standout pattern — a single call gives full engine access with no prop drilling, template refs, or manual context wiring. The `steps` object is more explicit than Vue's slots and Svelte's snippet props, which suits React's "everything is JS" style.
