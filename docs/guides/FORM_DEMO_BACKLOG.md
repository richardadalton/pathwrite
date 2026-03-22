# Form Demo Backlog

Consolidated from feedback recorded across all four form demos:
`demo-angular-form`, `demo-react-form`, `demo-vue-form`, `demo-svelte-form` (v0.5.0).

Each item notes which demos raised it and where the change would live.

---

## Priority 1 — Raised by all four demos

### 1.1 Field-level validation (`fieldMessages` API) ✅ Done

**Problem:**  
`validationMessages` returns a flat string array for the whole step, rendered as a summary box.
Per-field inline errors (e.g. a red hint directly under a failing input) require developers to
duplicate their validation logic inside the step template.

**Raised by:** Angular · React · Vue · Svelte

**Resolved:**  
`fieldMessages?: (ctx: StepContext<T>) => Record<string, string>` added to `PathStep`.
`snapshot.fieldMessages` is now populated on every snapshot — adapters render it as a labelled
error list. `canMoveNext` is auto-derived from `fieldMessages` when not explicitly set
(step is blocked while any key has a non-empty message). `FieldErrors` type exported from all
packages.

**Where:** `packages/core` + all four adapter shells

---

### 1.2 Auto-hide progress for single-step forms ✅ Done

**Problem:**  
A single-step path renders a progress bar with one dot at 100%. It conveys nothing.
Developers must remember to pass `hideProgress` / `[hideProgress]="true"` / `hide-progress` manually.

**Raised by:** Angular · React · Vue · Svelte

**Resolved:**  
All four adapter shells now automatically hide the default progress header when
`stepCount === 1 && nestingLevel === 0` (top-level single-step paths). Sub-paths
(`nestingLevel > 0`) always show their header even with one step, so the user retains
orientation within a nested flow. Custom header overrides (`renderHeader`, `#header` slot,
`pwShellHeader`) are never auto-hidden. The `hideProgress` prop still works as an explicit
override when needed.

**Where:** All four adapter `PathShell` components

---

## Priority 2 — Raised by most demos

### 2.1 `restart()` on shell + document reset patterns ✅ Done

**Problem:**  
The only documented reset pattern was unmount/remount via a conditional flag. The `restart()`
action existed on the engine but wasn't accessible from outside the shell without reaching into
`usePathContext()` inside a step component.

**Raised by:** Angular · React · Vue · Svelte (all noted the two-pattern gap)

**Resolved:**  
- **Angular**: `public restart(): Promise<void>` added to `PathShellComponent`. Call via `#shell` template reference.
- **Vue**: `expose({ restart })` added to `PathShell` setup. Call via Vue template `ref`.
- **Svelte**: `export function restart()` added to `PathShell.svelte`. Call via `bind:this`.
- **React**: Function components have no instance. The idiomatic equivalent is changing the `key` prop, which forces a fresh mount. Documented with code examples.

Both patterns (toggle-mount and in-place `restart()`) are documented in the Developer Guide and each adapter README with guidance on when to use each.

**Where:** `packages/angular-adapter/src/shell.ts`, `packages/vue-adapter/src/index.ts`,
`packages/svelte-adapter/src/PathShell.svelte` + all READMEs + Developer Guide

---

### 2.2 `snapshot.hasAttemptedNext` flag (touched / dirty tracking)

**Problem:**  
`validationMessages` is evaluated on every snapshot, including the very first one before the
user has typed anything. The shell hides them until a navigation is attempted, but
`snapshot.validationMessages` is populated from the start — which surprises developers who
read it directly, and makes it impossible for step templates to independently control when
to show inline errors.

**Raised by:** Angular (explicitly) — implicit in the other demos' field-level validation requests

**Proposed change:**  
Add a `hasAttemptedNext` (or `isDirty`) flag to the engine snapshot:

```typescript
snapshot.hasAttemptedNext: boolean;
// true after the user has clicked the primary action at least once
```

Step templates can then gate their inline error display on this flag, matching standard
form UX ("show errors only after first submit attempt").

**Where:** `packages/core` (engine snapshot type + state machine)

---

### 2.3 Footer layout for form vs wizard mode

**Problem:**  
The default shell footer puts both Cancel and Submit on the right, side-by-side. For a
wizard this is fine. For a standalone form it is unconventional — Cancel is typically on the
left (or rendered as a text link), with Submit as the sole right-side action.

Because the back button is hidden on the first/only step, the footer's left side is empty,
making the layout feel unbalanced.

**Raised by:** Angular (explicitly) — the same layout is used across all adapters

**Proposed change:**
```typescript
// PathShell input
footerLayout?: "wizard" | "form";  // default: "wizard"
```
In `"form"` mode: Cancel moves to the left, Submit stays right, back button is never shown.

**Where:** `packages/shell.css` + all four adapter shells

---

## Priority 3 — Smaller scope / framework-specific

### 3.1 `createFormPath()` helper in core

**Problem:**  
Creating a single-step `PathDefinition` for a form use case requires understanding the full
`PathDefinition` API (`steps`, `onEnter`, `canMoveNext`, `validationMessages`). For developers
using Pathwrite purely as a form engine this feels like learning too much upfront.

**Raised by:** Angular

**Proposed change:**  
A thin helper in `@daltonr/pathwrite-core` (or docs-level pattern):
```typescript
function createFormPath<T>(config: {
  id: string;
  initialData: T;
  validate: (data: T) => string[];
}): PathDefinition<T>
```

**Where:** `packages/core` (or developer guide only, as a documented pattern)

---

### 3.2 Fix CSS package import resolution (Vite)

**Problem:**  
`import '@daltonr/pathwrite-react/styles.css'` (the documented pattern) fails at build time
with Vite:
```
Rollup failed to resolve import "@daltonr/pathwrite-react/styles.css"
```
The workaround is to copy the shell CSS into the app directly.

**Raised by:** React

**Proposed change:**  
Verify the `"./styles.css"` export in each adapter's `package.json` resolves correctly with
Vite, webpack, and Rollup. Add a bundler smoke-test to the release checklist.

**Where:** All adapter `package.json` exports + release process

---

### 3.3 Angular: `injectPath()` signal-based API

**Problem:**  
Angular's data-access pattern (`#shell` template reference + `shell.facade.setData()`) is the
most verbose and least discoverable of the four adapters. It requires Pathwrite-specific
knowledge that doesn't map to Angular conventions modern developers expect.

**Raised by:** React (observing the Angular gap) · Angular feedback (items 3 and 7)

**Proposed change:**  
An `injectPath<T>()` function for use in signal-based Angular components:
```typescript
// Inside a component, no template ref needed
const path = injectPath<ContactData>();
// path.snapshot()  — signal
// path.setData(key, value)
// path.snapshot().fieldMessages  (once 1.1 lands)
```

**Where:** `packages/angular-adapter`

---

### 3.4 Document "prop name = step ID" convention for Svelte snippets

**Problem:**  
The Svelte snippet prop pattern (`contact={ContactStep}`) requires knowing that the prop name
must match the step ID. This isn't self-evident to developers new to the adapter.

**Raised by:** Svelte

**Proposed change:**  
Add a prominent callout in the Svelte adapter docs and/or a TypeScript type that surfaces the
step IDs as valid prop names (so IDEs can autocomplete them).

**Where:** `packages/svelte-adapter` README + type definitions

---

## Summary

| # | Feature | Impact | Scope | Demos |
|---|---|---|---|---|
| 1.1 ✅ | Field-level `fieldMessages` API | High | core + all shells | All 4 |
| 1.2 ✅ | Auto-hide progress for single-step paths | Low | shell logic | All 4 |
| 2.1 ✅ | `restart()` on shell + document reset patterns | Medium | all shells + docs | All 4 |
| 2.2 | `snapshot.hasAttemptedNext` flag | Medium | core engine | All 4 |
| 2.3 | `footerLayout: "wizard" \| "form"` | Low–Medium | shell CSS + all shells | All 4 |
| 3.1 | `createFormPath()` helper | Low | core or docs | Angular |
| 3.2 | Fix CSS import resolution (Vite) | Medium | package exports | React |
| 3.3 | Angular `injectPath()` signal API | High (Angular only) | angular-adapter | Angular |
| 3.4 | Svelte snippet prop type safety + docs | Low | svelte-adapter | Svelte |

