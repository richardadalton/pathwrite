# demo-angular-form

A Pathwrite demo showing how to use a **single-step Path as a standalone form** with Angular (`@daltonr/pathwrite-angular` v0.6.0).

Same contact form as `demo-react-form`, `demo-vue-form`, and `demo-svelte-form` — built side-by-side to compare all four adapters.

---

## What it demonstrates

| Feature | How it's used here |
|---|---|
| `<pw-shell>` component | Renders the form body, validation messages and footer automatically |
| `<ng-template pwStep="...">` | Step content defined in the parent template using the `pwStep` directive — name matches the step ID |
| `#shell` template reference | Used inside step templates to call `shell.facade.setData(...)` on input events |
| `shell.facade.stateSignal()` | Reads reactive engine state inline in the template (e.g. for a character count) |
| `canMoveNext` guard | Blocks submission until all fields are valid |
| `validationMessages` | Surfaces per-rule errors in the shell's built-in orange message area |
| `(completed)` output | Fires when the user clicks "Send Message" |
| `(cancelled)` output | Fires when the user clicks "Discard" |
| Auto-hidden progress | Single-step paths hide the progress header automatically — no `[hideProgress]` needed |
| `completeLabel` / `cancelLabel` | Re-labelled to "Send Message" / "Discard" |
| Angular `@if` blocks | `@if (!isSubmitted && !isCancelled)` mounts/unmounts the shell cleanly |

---

## Project structure

```
src/
├── main.ts                     – bootstraps the Angular app
├── styles.css                  – global styles
├── index.html                  – app shell HTML
└── app/
    ├── app.component.ts        – root component; path definition and page state
    ├── app.component.html      – template: pw-shell, ng-template step content, result panels
    └── app.component.css       – component styles
```

---

## CSS Configuration

The Pathwrite shell styles are imported via `angular.json`:

```json
{
  "styles": [
    "node_modules/@daltonr/pathwrite-angular/dist/index.css",
    "src/styles.css"
  ]
}
```

This loads the complete shell CSS with all CSS custom properties (`--pw-*` variables) for theming. The `styles.css` file contains only app-specific styles.

**Note:** Angular requires CSS to be declared in the build configuration, unlike React/Vue/Svelte which use direct imports.

---

## The path

```typescript
// app.component.ts
protected readonly contactFormPath: PathDefinition = {
  id: "contact-form",
  steps: [{
    id: "contact",
    onEnter: ({ isFirstEntry }) =>
      isFirstEntry ? { name: "", email: "", subject: "", message: "" } : undefined,
    canMoveNext: ({ data }) => getMessages(data).length === 0,
    validationMessages: ({ data }) => getMessages(data)
  }]
};
```

---

## Key patterns

### pw-shell with a template reference

```html
<pw-shell
  #shell
  [path]="contactFormPath"
  completeLabel="Send Message"
  cancelLabel="Discard"
  (completed)="onSubmit($event)"
  (cancelled)="onCancel()"
>
  <ng-template pwStep="contact">
    <!-- step content here -->
  </ng-template>
</pw-shell>
```

The `#shell` reference is needed to call `shell.facade.setData(...)` from inside the step template. The `pwStep` directive name must match the step ID.

### Accessing and updating engine state inside a step template

```html
<!-- inside <ng-template pwStep="contact"> -->
<input
  type="text"
  [value]="name"
  (input)="name = $any($event.target).value;
           shell.facade.setData('name', name.trim())"
/>

<!-- reading reactive state inline (e.g. character count) -->
<span>{{ shell.facade.stateSignal()?.data?.['message']?.length ?? 0 }} / 500</span>
```

Local component properties (`name`, `email`, etc.) mirror the engine data to keep the inputs controlled. `shell.facade.setData()` pushes each change into the engine.

### Resetting the form

```typescript
protected tryAgain(): void {
  this.name = ""; this.email = ""; this.subject = ""; this.message = "";
  this.isSubmitted = false; this.isCancelled = false; this.submittedData = null;
}
```

Resetting the flags causes the `@if (!isSubmitted && !isCancelled)` block to re-evaluate, which destroys and re-creates `<pw-shell>` — auto-starting a fresh path.

---

## Run

```bash
# From the workspace root:
npm install
cd apps/angular-demos/demo-angular-form
npm install
npm start
```

Then open **http://localhost:4200** in your browser.

---

## Comparison with React, Vue, and Svelte

| | Angular | React | Vue | Svelte |
|---|---|---|---|---|
| Shell component | `<pw-shell>` | `<PathShell>` | `<PathShell>` | `<PathShell>` |
| Step content | `<ng-template pwStep="contact">` | `steps={{ contact: <ContactStep /> }}` | `<template #contact>` | `contact={ContactStep}` |
| Data access in step | `#shell` ref → `shell.facade.setData()` | `usePathContext()` hook | `usePathContext()` composable | `getPathContext()` |
| Reset | Toggle `@if` | Toggle `useState` | Toggle `v-if` | Toggle `$state` |
| Event handling | `(completed)` / `(cancelled)` | `onComplete` / `onCancel` | `@complete` / `@cancel` | `oncomplete` / `oncancel` |

Angular requires the most boilerplate — a `#shell` template reference for data access and local mirrored properties to keep inputs controlled. This fits Angular's explicit, class-based conventions, but it's the steepest learning curve of the four adapters.
