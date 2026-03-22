# Feedback: `@daltonr/pathwrite-angular` v0.2.0 → v0.2.1

Feedback based on building a **Document Approval Workflow** — a 3-step main path
with a dynamic collection of approvers, each running a 3-step sub-path wizard
(review → decision → comments), finishing with a summary step.

---

## 0. What Changed in v0.2.1

### 0.1 ✅ Fixed — `PathDefinition<T>` double cast removed

v0.2.1 changed the signatures of `PathFacade.start()`, `PathFacade.startSubPath()`,
`PathEngine.start()`, `PathEngine.startSubPath()`, and the `PathShellComponent`
`[path]` input to accept `PathDefinition<any>` instead of `PathDefinition<PathData>`.

This eliminated every double-cast in the project:

```typescript
// Before (v0.2.0) — required at two sites
protected readonly approvalPath: PathDefinition = documentApprovalPath as unknown as PathDefinition;
void this.facade.startSubPath(approvalSubPath as unknown as PathDefinition, data);

// After (v0.2.1) — no cast needed
protected readonly approvalPath = documentApprovalPath;
void this.facade.startSubPath(approvalSubPath, data);
```

The `PathDefinition` import in both `app.component.ts` and `run-approvals.component.ts`
was also removed entirely — it was only present to support the cast.

This was the highest-friction issue in v0.2.0, and the fix is exactly right.

---

## 1. Issues That Required Workarounds

### 1.1 ~~Typed `PathDefinition<T>` is not assignable to `PathDefinition<PathData>`~~ *(Fixed in v0.2.1)*

**Resolved in v0.2.1.** See §0.1 above for details.

The suggested fix — changing `[path]`, `start()`, and `startSubPath()` to accept
`PathDefinition<any>` — was implemented exactly as proposed. Both cast sites in
the project have been removed.

---

### 1.2 `onEnter` data reset is a silent footgun

The `run-approvals` step used `onEnter` to initialise the approvals list:

```typescript
onEnter: () => ({ approvals: [], currentApproverIndex: 0 })
```

This worked on first entry — but `onEnter` fires every time you *re-enter* the
step (e.g. after pressing Back from the summary step). That silently wiped all
completed approvals.

The fix was to remove `onEnter` entirely and rely on the `initialData` provided
at `facade.start()` time, but this is a non-obvious gotcha. There's no
"initialise once" hook — `onEnter` always re-fires.

**Suggested addition:** An `onFirstEnter` hook (or an `isFirstEntry` flag on
`PathStepContext`) that only fires when the step is visited for the first time.

---

### 1.3 No way to correlate `onSubPathComplete` back to a collection item

When running a sub-path per approver, `onSubPathComplete` receives
`(subPathId, subPathData, ctx)`. There is no engine-level concept of *which
collection item* triggered the sub-path. The workaround was to pass
`approverIndex` through the sub-path's initial data and read it back in
`onSubPathComplete`:

```typescript
// Pass index in:
facade.startSubPath(subPath, { approverIndex: i, ... });

// Read it back in the hook:
onSubPathComplete: (_, subData, ctx) => {
  const idx = subData.approverIndex; // manual correlation
}
```

This works, but it's boilerplate every consumer of the "loop over a collection"
pattern will have to reinvent.

**Suggested addition:** A higher-level utility or a `meta` field on the
sub-path start call that gets passed back unchanged to `onSubPathComplete`, making
correlation explicit and zero-boilerplate:

```typescript
// Hypothetical API:
facade.startSubPath(subPath, data, { correlationId: i });

// In the hook:
onSubPathComplete: (subPathId, subPathData, ctx, meta) => {
  const i = meta.correlationId;
}
```

---

### 1.4 All sub-path step templates must live inside the same `<pw-shell>`

Because `pw-shell` owns the single `PathFacade` instance and renders by matching
`stepId` to `pwStep` directives, sub-path step templates had to be co-located in
the *parent* component's template alongside the main path steps:

```html
<pw-shell [path]="mainPath">
  <!-- main path -->
  <ng-template pwStep="add-approvers"> ... </ng-template>
  <ng-template pwStep="summary"> ... </ng-template>

  <!-- sub-path steps also here — not obvious at all -->
  <ng-template pwStep="review-document"> ... </ng-template>
  <ng-template pwStep="make-decision"> ... </ng-template>
  <ng-template pwStep="approval-comments"> ... </ng-template>
</pw-shell>
```

This couples the parent component to the internal structure of sub-paths it
doesn't "own". It also creates a step-ID collision risk: if any main path step
and sub-path step share an ID, one silently wins.

**Suggested improvement:** Document this constraint clearly with a sub-path
example. Longer-term, consider a `<pw-sub-shell>` or a way for `pw-shell` to
accept a `pathId` filter so templates can be scoped to a specific path.

---

### 1.5 Step ID collision risk across paths

There is no namespacing of step IDs across a main path and its sub-paths. If a
sub-path defines a step with the same ID as a main path step (e.g. both have a
`summary` step), the shell's `*ngIf="stepDir.stepId === s.stepId"` will match
both templates and render both. This is a silent bug that's easy to introduce.

**Suggested fix:** Warn (or throw) if duplicate step IDs are registered across
all `pwStep` directives within a single `pw-shell`. Alternatively, support a
`[pathId]` attribute on `pwStep`: `<ng-template pwStep="summary" [pathId]="'main'">`.

---

## 2. Learning Curve Issues

### 2.1 Generic narrowing pattern requires DI cast on every step component

The README explains that Angular's DI cannot carry generics at runtime, so every
step component must cast at the injection site:

```typescript
protected readonly facade = inject(PathFacade) as PathFacade<MyData>;
```

This is reasonable given Angular's constraints, but it's repetitive across many
step components. A typed base class or a `provideTypedFacade<T>()` helper that
returns a typed token would eliminate the cast:

```typescript
// Hypothetical:
protected readonly facade = inject(PathFacade<DocumentApprovalData>);
```

### 2.2 Sub-path lifecycle isn't immediately obvious from the README

The README covers `startSubPath` and `onSubPathComplete` but doesn't show a
complete worked example with:
- What the shell renders while a sub-path is active (it switches to the
  sub-path's steps — the main path steps disappear from the progress bar)
- What "Back" does on the first step of a sub-path (cancels the sub-path and
  returns to the parent — correct, but surprising)
- How data flows back from the sub-path to the parent via `onSubPathComplete`

A single end-to-end sub-path example in the README would save a lot of
exploration time.

### 2.3 `validationMessages` silently returns `[]` when async

The docs note that async `validationMessages` functions default to `[]` in
snapshots. This is easy to miss, and the behaviour (messages just never appear)
is hard to debug — there is no warning logged.

**Suggested improvement:** Log a `console.warn` in dev mode when an async
`validationMessages` function is detected, informing the developer that the
function must be synchronous.

### 2.4 `canMoveNext` async default (`true`) can be misleading

Async `canMoveNext` guards default to `true` in the snapshot so the button is
enabled while the async guard is evaluating. This means a user could click Next
before the guard resolves. The engine enforces the guard on navigation, but the
UI momentarily shows a clickable button for a step that might actually be blocked.

**Suggested improvement:** Expose the async guard state explicitly in the
snapshot (e.g. `isGuardPending: boolean`) so the shell can show a loading
indicator or keep the button disabled until resolution.

---

## 3. General Improvement Suggestions

### 3.1 First-class "loop over a collection" support

The most natural real-world use case for sub-paths is iterating over a
collection (approvers, items in a cart, documents in a bundle). The current API
requires manual index tracking, manual correlation in `onSubPathComplete`, and
careful guard logic. A helper like `forEach` or `repeat` would make this pattern
idiomatic:

```typescript
// Hypothetical:
{
  id: 'run-approvals',
  forEach: (ctx) => ctx.data.approvers,
  subPath: approvalSubPath,
  itemData: (approver, i) => ({ approverIndex: i, approverName: approver.name }),
  onItemComplete: (item, result, ctx) => ({ approvals: [...ctx.data.approvals, result] })
}
```

### 3.2 `nestingLevel` in the default shell UI

The snapshot exposes `nestingLevel` (depth of sub-path nesting), but the default
`pw-shell` UI doesn't use it. When a sub-path is active the progress bar silently
switches to show the sub-path's steps with no indication that you've "drilled in".

**Suggested improvement:** Show a breadcrumb or a "back to [parent step title]"
contextual label in the shell header when `nestingLevel > 0`.

### 3.3 Shell `(completed)` output should carry typed data

The `(completed)` and `(cancelled)` outputs emit `PathData` (untyped `Record<string, unknown>`).
Since the parent already knows the path's data type, the output could be generic:

```typescript
// On PathShellComponent:
@Output() completed = new EventEmitter<TData>();
```

### 3.4 `hideCancel` doesn't distinguish between top-level cancel and sub-path cancel

`Cancel` has different semantics depending on nesting level: on a sub-path it
pops back to the parent; on the top-level path it cancels the whole workflow.
There's no way to configure them independently (e.g. always allow sub-path cancel
but hide the top-level cancel).

**Suggested addition:** `hideCancelOnRoot` and `hideCancelOnSubPath` as separate
inputs, or expose the cancel button state to a template so consumers can customise
it based on `nestingLevel`.

### 3.5 No `onSubPathCancel` hook

`onSubPathComplete` fires when a sub-path finishes naturally. But there is no
`onSubPathCancel` hook to react when a sub-path is cancelled (user pressed Back
on the first step). The parent step's data isn't updated in that case, which is
usually the right default — but there's no way to record a "skipped" or "declined
to review" outcome.

### 3.6 `goToStep` / `goToStepChecked` require step IDs to be strings

Typos in step IDs cause runtime errors (`Step "X" not found`) rather than
compile-time errors. A small improvement would be to export the step IDs as a
const enum or a typed record from the path definition helper so the compiler
catches typos:

```typescript
// Hypothetical generated helper:
const steps = pathStepIds(documentApprovalPath);
// steps.addApprovers, steps.runApprovals, steps.summary — typed
```

---

## 4. What Worked Well

- **Zero-dependency core** — clean separation between `pathwrite-core` and the
  Angular adapter. Easy to reason about.
- **`stateSignal` out of the box** — no need for `toSignal()` boilerplate in
  signal-based components; very idiomatic for Angular 17+.
- **`pw-shell` as a fast starting point** — progress bar, navigation buttons,
  validation messages, and cancel — all wired up by default. Significantly
  reduces bootstrap time.
- **`syncFormGroup`** — elegant integration with reactive forms; the duck-typed
  `FormGroupLike` interface means it works without depending directly on
  `@angular/forms`.
- **`onSubPathComplete` data merge** — the returned `Partial<TData>` patch
  pattern is clean and composable.
- **`canMoveNext` / `validationMessages` co-location** — having guard logic and
  its human-readable message in the same step definition is a significant
  ergonomic win over managing validation state separately in components.
- **Component-level `PathFacade` provision** — providing the facade at the
  component level with automatic `ngOnDestroy` cleanup is idiomatic Angular and
  avoids the memory-leak pitfalls of service-level singletons.



