# Feedback — demo-vue-subwizard

Pathwrite version: 0.6.3
Date: March 2026

---

## What worked well

### 1. Single PathShell for both main and subwizard steps
The most elegant thing about this demo: one `<PathShell>` handles everything. All step slots — main wizard and subwizard — are declared together, and the engine automatically renders whichever step is currently active. There is no conditional mounting, no second shell component, no routing. The developer just adds more named slots.

### 2. `onSubPathComplete` is a clean integration point
Recording an approver's decision back into the parent path required no custom event bus, no shared store, and no ref passing. The `onSubPathComplete` hook on the gate step receives the subwizard's final data and returns a patch to the parent — exactly the right abstraction.

### 3. `meta` for correlation is well designed
Passing `{ approverId }` as `meta` to `startSubPath()` and receiving it back in `onSubPathComplete` is clean. The parent doesn't need to inspect subwizard data to know which approver completed — it's handed back as context. This avoids coupling the subwizard's data shape to the parent's routing concerns.

### 4. Gate derived from `fieldMessages`
Using `fieldMessages` with a `_` (form-level) key on the gate step, rather than writing a separate `canMoveNext`, eliminates duplication. The engine deriving `canMoveNext` from the absence of field messages is a real developer-experience win.

### 5. Progress indicator nesting
When a subwizard opens, the progress bar automatically switches to show the subwizard's steps (View Document → Your Decision). When it completes, the main wizard's progress returns. This required zero code — it's built into the shell.

---

## Friction points

### 1. No type narrowing when calling `startSubPath`
`startSubPath(path, initialData, meta)` accepts `PathData` for `initialData`, so you lose type checking when seeding the subwizard's initial data from the parent's typed `DocumentData`. A typed overload would help, though the TypeScript overhead may not be worth it.

### 2. Subwizard "Back" on first step cancels — not immediately obvious
When an approver presses "Previous" on the first step of their subwizard (View Document), the subwizard cancels and returns to the parent's Awaiting Approvals step. This is correct behaviour, but nothing in the UI warns the approver that "Previous" here means "exit without deciding". A note in the step template resolves this, but the engine could expose a `snapshot.isSubPath` or `snapshot.nestingLevel > 0` flag to let the shell show a contextual "Back to approvals" label automatically.

### 3. No built-in "subwizard in progress" indicator
When an approver's subwizard is open, the main approvals list is no longer visible. If there were multiple simultaneous users on the same engine (multi-tenant, future feature), there would be no built-in way to show "Alice's review is in progress". For a single-user demo this is fine.

---

## API used

| API | Used for |
|-----|----------|
| `PathShell` | Single shell for both main and sub paths |
| `usePathContext()` | Accessing snapshot and actions inside step components |
| `startSubPath(path, data, meta)` | Launching per-approver review subwizard |
| `onSubPathComplete` | Merging approver decision into parent path data |
| `fieldMessages` with `_` key | Gate step — blocks Next until all approvers respond |
| `snapshot.nestingLevel` | Available (not used in UI, but useful for custom shells) |
| `snapshot.hasAttemptedNext` | Gating field error display |

