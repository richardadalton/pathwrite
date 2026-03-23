# Feedback — demo-angular-subwizard

Pathwrite version: 0.6.3
Date: March 2026

---

## What worked well

### 1. `<pw-shell>` with `<ng-template pwStep>` handles both main and subwizard steps
One `<pw-shell>` element in the template declares all 6 step templates — 4 for the main wizard and 2 for the approval subwizard. When `startSubPath()` is called from the review step, the shell seamlessly switches to the subwizard's templates. No Angular routing, no `*ngIf` toggling, no second shell.

### 2. `injectPath()` works identically in main and subwizard step components
Both `ApprovalReviewStepComponent` (main wizard) and `ViewDocumentStepComponent` (subwizard) use `injectPath()` to access the currently active path's snapshot. The injection resolves to whichever path the engine is currently running. The generic `injectPath<ApprovalData>()` narrows the data type correctly.

### 3. Angular signals (`computed()`) integrate naturally with Pathwrite signals
The adapter's `injectPath()` returns signal-based accessors. Using Angular's `computed()` to derive `errors`, `selectedApprovers`, `allDone`, and `status` from `this.path.snapshot()` is clean and familiar to Angular developers. No manual subscription management.

### 4. Path definition is pure TypeScript — no Angular imports
`approval.path.ts` imports only from `@daltonr/pathwrite-core`. It can be tested in isolation, reused across frameworks, and run on a server. The Angular adapter only wires up the UI.

### 5. `onSubPathComplete` with `meta` correlation is straightforward
Same pattern as other frameworks. The path definition handles all data merging — the Angular components don't need services, `@Output()` emitters, or shared state to communicate between the parent wizard and the approval subwizard.

---

## Friction points

### 1. Inline component styles are verbose
Each step component defines its own CSS in the `styles` array. Because Angular's view encapsulation scopes styles to the component, the same `.field`, `.field-error`, `.approver-avatar` classes must be repeated across multiple step components. A shared stylesheet or `::ng-deep` would reduce duplication but has its own tradeoffs. The other frameworks use a single `style.css` imported at the app level.

### 2. `$any($event.target).value` casting
Angular's strict template type checking doesn't know that `$event.target` is an `HTMLInputElement`. Every `(input)` handler requires `$any($event.target).value` — a known Angular ergonomic pain point, not a Pathwrite issue, but it appears frequently in this demo.

### 3. `this.path.snapshot()!.data` non-null assertion
Step components assume the snapshot is always non-null (which it is inside a `<pw-shell>` step template), but TypeScript requires the `!` assertion. Same friction as React's `snapshot!` — a shell-scoped injection that guarantees non-null would be cleaner.

### 4. Subwizard "Previous" on first step cancels without warning
Same as all frameworks — pressing Previous on the subwizard's first step silently cancels back to the parent. The Angular shell shows a standard "Previous" button with no indication that it will exit the subwizard.

### 5. More files per demo than other frameworks
Angular's component model (separate `.ts`, `.html`, `.css` files, plus step components each in their own file) means the Angular subwizard demo has ~13 source files vs ~10 for Vue/React/Svelte. This is inherent to Angular's architecture, not a Pathwrite issue.

---

## API used

| API | Used for |
|-----|----------|
| `<pw-shell>` + `pwStep` directive | Single shell with ng-templates for main + sub steps |
| `injectPath()` | Signal-based snapshot and actions inside step components |
| `startSubPath(path, data, meta)` | Launching per-approver review subwizard |
| `onSubPathComplete` | Merging approver decision into parent path data |
| `fieldMessages` with `_` key | Gate step — blocks Next until all respond |
| `computed()` (Angular signals) | Deriving errors, selected approvers, status |
| `snapshot().hasAttemptedNext` | Gating field error display |
| `snapshot().isNavigating` | Disabling Review button during transitions |

