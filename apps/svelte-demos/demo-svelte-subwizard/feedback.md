# Feedback — demo-svelte-subwizard

Pathwrite version: 0.6.3
Date: March 2026

---

## What worked well

### 1. Single PathShell with component props for step mapping
Svelte's PathShell accepts step components as props (e.g. `createDocument={CreateDocumentStep}`). Both main wizard steps and subwizard steps are passed to the same shell. When `startSubPath()` is called, the shell switches to the subwizard's step component automatically. No routing, no conditional blocks.

### 2. `$derived` reactive state is a perfect fit
Svelte 5's `$derived` runes make reactive computations from snapshot data extremely concise. `let errors = $derived(ctx.snapshot?.hasAttemptedNext ? ctx.snapshot.fieldMessages : {})` is a single line that stays in sync automatically. No `computed()`, no `useMemo()`, no subscriptions.

### 3. `getPathContext()` is clean and framework-idiomatic
Svelte's `getPathContext<ApprovalData>()` returns a context object with reactive `.snapshot` that can be read directly in the template. No `.value` unwrapping (Vue), no null assertions (React). The context works identically in main steps and subwizard steps.

### 4. Path definition is pure TypeScript — fully shareable
The `approval.ts` file has no Svelte imports. The only Svelte-specific consideration is using camelCase step IDs (`createDocument` instead of `create-document`) because Svelte component prop names cannot contain hyphens. The path logic itself is identical to the Vue version.

### 5. `onSubPathComplete` and `meta` correlation work exactly as expected
Recording approver decisions back into the parent data required no Svelte stores, no event dispatching, and no prop binding. The engine handles the data flow entirely within the path definition.

---

## Friction points

### 1. camelCase step IDs are a Svelte-only constraint
Svelte passes step components as props, and prop names must be valid JavaScript identifiers — no hyphens. This means the Svelte subwizard demo uses `createDocument`, `selectApprovers`, `approvalReview`, `viewDocument` while every other framework uses `create-document`, `select-approvers`, etc. The path definitions diverge for this reason alone. A mapping mechanism (e.g. `stepMap={{ "create-document": CreateDocumentStep }}`) would let Svelte share identical step IDs.

### 2. `{#if ctx.snapshot}` guard in every step component
Every step template wraps its content in `{#if ctx.snapshot}` because `ctx.snapshot` is `PathSnapshot | null`. Inside a PathShell step, it's always non-null, but Svelte's type narrowing requires the conditional. This adds one line of boilerplate per step, which is minor but noticeable across 6 step components.

### 3. Dynamic class binding for outcome banner
Svelte's `class:` directive requires separate bindings per class: `class:outcome-banner--approved={status() === 'approved'}`, `class:outcome-banner--rejected={...}`, `class:outcome-banner--mixed={...}`. Compare to Vue's `:class="'outcome-banner--' + status"` or React's template literal. This is a Svelte ergonomics issue, not a Pathwrite issue.

### 4. Subwizard "Previous" on first step cancels without warning
Same as other frameworks — the shell's Back button on the subwizard's first step silently cancels and returns to the parent. No visual indicator distinguishes this from normal back navigation.

---

## API used

| API | Used for |
|-----|----------|
| `PathShell` | Single shell with component props for main + sub steps |
| `getPathContext()` | Reactive snapshot and actions inside step components |
| `startSubPath(path, data, meta)` | Launching per-approver review subwizard |
| `onSubPathComplete` | Merging approver decision into parent path data |
| `fieldMessages` with `_` key | Gate step — blocks Next until all respond |
| `$derived` runes | Reactive computations from snapshot data |
| `snapshot.hasAttemptedNext` | Gating field error display |
| `snapshot.isNavigating` | Disabling Review button during transitions |

