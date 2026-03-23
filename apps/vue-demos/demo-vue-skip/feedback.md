# Feedback — demo-vue-skip

Pathwrite version: 0.6.3
Date: March 2026

---

## What worked well

### 1. `shouldSkip` is the right abstraction for conditional steps
Instead of toggling step visibility with `v-if` inside a step template, `shouldSkip` removes the step from the flow entirely. The user never sees it, the progress bar never counts it, and `onEnter`/`onLeave` hooks never fire for it. This is a cleaner model than "render the step but hide the content" — the engine handles navigation automatically.

### 2. The progress bar adjusts automatically
When the Free plan is selected, the progress bar shows 3 steps (Plan → Shipping → Review) instead of 5. The developer writes zero progress-bar logic — the shell reads the engine's snapshot which already accounts for skipped steps. This is a significant UX win for conditional flows.

### 3. `onEnter` with `isFirstEntry` for pre-filling is elegant
The Billing Address step pre-fills from shipping data on first entry only:
```typescript
onEnter: ({ data, isFirstEntry }) => {
  if (isFirstEntry) {
    return { billingName: data.billingName || data.shippingName, ... };
  }
}
```
This means navigating back to the billing step doesn't overwrite user edits. The `isFirstEntry` guard is exactly the right tool.

### 4. Skip conditions compose naturally
The billing step's `shouldSkip` is `data.plan === "free" || data.billingSameAsShipping === true`. Multiple conditions combine with plain JavaScript — no special API, no plugin system. This is easy to reason about and easy to test.

### 5. The "skip note" UX pattern works well
Showing `ℹ️ Free plan — payment and billing steps will be skipped` on the plan selection step, and `ℹ️ Billing address step will be skipped — using shipping address` on the shipping step, gives the user clear expectations. This is a UI pattern, not a Pathwrite feature, but the framework makes it easy because the step component has access to the same data the `shouldSkip` function reads.

---

## Friction points

### 1. Skipped steps still appear in `snapshot.steps` with status "upcoming"
The `snapshot.steps` array includes ALL defined steps, including ones that will be skipped. The Review step's "skip summary" section had to manually check skip conditions to show "⏭ skipped" labels. If `snapshot.steps` included a `willBeSkipped` flag, the Review could render this automatically without duplicating logic.

### 2. `shouldSkip` is evaluated at navigation time, not reactively
If the user selects "Free", sees the progress bar show 3 steps, then navigates back and switches to "Paid", the progress bar updates on the next navigation — but there's a brief moment where the progress bar is stale. In practice this is invisible (navigation is near-instant), but it's worth noting that `shouldSkip` is not a reactive signal — it's checked during `next()` and `previous()`.

### 3. Going "Back" through skipped steps is automatic but can be surprising
When on the Review step with Free plan selected, pressing "Previous" jumps back to Shipping (skipping Payment and Billing). This is correct, but a user might expect to land on the step immediately before Review. The engine handles this — `shouldSkip` is evaluated in the backward direction too — but the UX could be confusing for steps the user has never seen.

### 4. No built-in way to show "why" a step was skipped
The engine knows a step was skipped, but doesn't expose the reason. In the Review step, the developer has to replicate the skip conditions to explain them to the user. A `skipReason` string on the step definition (or returned from `shouldSkip`) would make this easier.

---

## API used

| API | Used for |
|-----|----------|
| `PathShell` | Default shell with named slots |
| `usePathContext()` | Accessing snapshot and actions in step components |
| `shouldSkip` | Conditionally skipping Payment and Billing steps |
| `onEnter` + `isFirstEntry` | Pre-filling billing from shipping on first entry |
| `fieldMessages` | Validation on all input steps |
| `snapshot.hasAttemptedNext` | Gating field error display |

