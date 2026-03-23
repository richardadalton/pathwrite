# Feedback — demo-angular-skip

Pathwrite version: 0.6.3
Date: March 2026

---

## What worked well

### 1. `shouldSkip` eliminates conditional template logic
In a vanilla Angular app, conditional steps would require `*ngIf` guards, route guards, or step-index arithmetic. With Pathwrite, `shouldSkip: ({ data }) => data.plan === "free"` on the path definition removes the step from the flow entirely — no template changes, no service logic, no routing.

### 2. Progress bar auto-adjusts with zero Angular code
The `<pw-shell>` progress indicator shows only the steps the user will visit. Free plan shows 3 steps, Paid shows 4 or 5. The developer writes no progress-bar logic — the shell reads the engine snapshot which accounts for skipped steps.

### 3. Path definition is pure TypeScript — no Angular imports
`subscription.path.ts` imports only from `@daltonr/pathwrite-core`. It can be tested in isolation, shared across frameworks, or run on a server. The `shouldSkip` and `onEnter` hooks are plain functions with no Angular dependency.

### 4. `onEnter` with `isFirstEntry` for pre-filling
The billing pre-fill from shipping on first entry works identically to all other frameworks. Navigating back to the billing step doesn't overwrite edits. This is a pure path-definition concern — no Angular lifecycle hooks involved.

### 5. Angular signals (`computed()`) integrate cleanly
Deriving `errors` from `this.path.snapshot()` using `computed()` is concise and familiar to Angular developers. The signal updates automatically when the snapshot changes — no manual subscription management.

---

## Friction points

### 1. Inline component styles are verbose and repetitive
Each step component defines its own CSS in the `styles` array. `.field`, `.field-error`, `.required`, `.row` are repeated across ShippingAddressStep, PaymentStep, and BillingAddressStep. Angular's view encapsulation scopes styles to the component, so sharing requires a separate stylesheet or `::ng-deep`. The other frameworks use a single global `style.css`.

### 2. `$any($event.target).value` casting
Angular's strict template type checking doesn't know `$event.target` is an `HTMLInputElement`. Every `(input)` handler needs `$any()` — a known Angular ergonomic issue, not a Pathwrite issue, but it appears frequently in address forms.

### 3. `this.path.snapshot()!.data` non-null assertion
Same as all Angular demos — step components assume the snapshot is non-null (which it is inside `<pw-shell>`), but TypeScript requires `!`. A shell-scoped injection that guarantees non-null would reduce boilerplate.

### 4. No way to query "will this step be skipped?" from a step component
The Shipping Address step shows "ℹ️ Billing address step will be skipped" by manually checking `data.billingSameAsShipping`. This duplicates the `shouldSkip` condition from the path definition. A `snapshot.willStepBeSkipped("billing-address")` API would eliminate this.

### 5. More files per demo than other frameworks
Angular's component model means 5 step components in separate files, plus path definition, types, app component (`.ts`, `.html`, `.css`), and config files — ~14 source files vs ~10 for Vue/React/Svelte. This is Angular's architecture, not a Pathwrite issue.

---

## API used

| API | Used for |
|-----|----------|
| `<pw-shell>` + `pwStep` directive | Default shell with ng-templates |
| `injectPath()` | Signal-based snapshot and actions in step components |
| `shouldSkip` | Conditionally skipping Payment and Billing steps |
| `onEnter` + `isFirstEntry` | Pre-filling billing from shipping |
| `fieldMessages` | Validation on all input steps |
| `computed()` (Angular signals) | Deriving errors from snapshot |
| `snapshot().hasAttemptedNext` | Gating field error display |

