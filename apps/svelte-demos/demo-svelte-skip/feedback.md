# Feedback — demo-svelte-skip

Pathwrite version: 0.6.3
Date: March 2026

---

## What worked well

### 1. `shouldSkip` works seamlessly with Svelte's reactive model
The engine evaluates `shouldSkip` during navigation and the reactive snapshot updates immediately. Svelte's `$derived` runes re-compute the UI in the same tick — there's no visible flicker when steps are added or removed from the flow.

### 2. `{@const data = ctx.snapshot.data}` keeps templates clean
Svelte 5's `{@const}` directive inside `{#if ctx.snapshot}` blocks avoids repeated `ctx.snapshot.data.` prefixes. Every step component uses this pattern for readability.

### 3. `onEnter` pre-fill works identically to other frameworks
The billing pre-fill from shipping is pure TypeScript in the path definition — no Svelte-specific code. The path file is effectively identical to the Vue version (aside from camelCase step IDs).

### 4. Toggle binding is idiomatic Svelte
`onchange={(e) => ctx.setData("billingSameAsShipping", e.currentTarget.checked)}` is clean and type-safe. The toggle component uses standard HTML checkbox binding — no Svelte stores needed.

### 5. Progress bar auto-adjusts with no effort
Same as other frameworks — the shell renders the correct number of progress steps based on skip conditions. Zero developer code.

---

## Friction points

### 1. camelCase step IDs diverge from other frameworks
Step IDs must be `selectPlan`, `shippingAddress`, `billingAddress` instead of `select-plan`, `shipping-address`, `billing-address`. This is the same Svelte prop-name constraint as all other Svelte demos. The path definitions are not copy-paste identical across frameworks because of this.

### 2. `{#if ctx.snapshot}` guard in every step component
Every step wraps its content in `{#if ctx.snapshot}` for type narrowing. This is one line of boilerplate per component — minor but consistent across all Svelte demos.

### 3. No reactive "will this step be skipped?" query
The Shipping Address step shows "ℹ️ Billing address step will be skipped" by checking `data.billingSameAsShipping` directly — duplicating the `shouldSkip` logic. A `ctx.willStepBeSkipped("billingAddress")` method would be cleaner.

### 4. `class:` directive verbosity for conditional classes
`class:skip-summary__skipped={data.plan === 'free' || data.billingSameAsShipping}` works but is verbose for compound conditions. This is a Svelte ergonomics issue, not Pathwrite.

---

## API used

| API | Used for |
|-----|----------|
| `PathShell` | Single shell with component props |
| `getPathContext()` | Reactive snapshot and actions |
| `shouldSkip` | Conditionally skipping Payment and Billing steps |
| `onEnter` + `isFirstEntry` | Pre-filling billing from shipping |
| `fieldMessages` | Validation on all input steps |
| `$derived` runes | Reactive error computation |
| `snapshot.hasAttemptedNext` | Gating field error display |

