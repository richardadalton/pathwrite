# Feedback — demo-react-skip

Pathwrite version: 0.6.3
Date: March 2026

---

## What worked well

### 1. `shouldSkip` makes conditional flows trivial
Adding `shouldSkip: ({ data }) => data.plan === "free"` to the payment step removes it entirely from the flow. No conditional rendering in JSX, no `useState` for step visibility. The engine handles forward and backward navigation through skipped steps automatically.

### 2. Progress bar reflects the actual flow
The `PathShell` progress bar dynamically shows only the steps the user will actually visit. Free plan shows 3 steps, Paid shows 4 or 5 depending on the billing toggle. Zero code required — the shell reads the engine's snapshot.

### 3. Compound skip conditions are just JavaScript
`shouldSkip: ({ data }) => data.plan === "free" || data.billingSameAsShipping === true` — no DSL, no config object. Conditions compose naturally and are easily testable outside the framework.

### 4. `onEnter` with `isFirstEntry` prevents data loss
Pre-filling billing from shipping on first entry, but not overwriting on subsequent visits, is exactly right. The `isFirstEntry` flag makes this a one-liner in the path definition.

### 5. Path definition is identical to Vue
The `subscription.ts` file is effectively the same across React and Vue (only the import path differs). This confirms the framework-agnostic design — path logic is portable.

---

## Friction points

### 1. `snapshot!` non-null assertion in every step
Same as all React demos — `usePathContext()` returns `snapshot` as nullable, requiring `snapshot!` in every step component. Inside PathShell steps it's always non-null.

### 2. Skipped steps still in `steps` map
The `steps` prop on `<PathShell>` includes entries for `payment` and `billing-address` even when they'll never render (Free plan). This is harmless but slightly wasteful — a developer might wonder if unused entries cause issues. They don't.

### 3. No way to query "will this step be skipped?" from a step component
The shipping step shows a note "Billing address step will be skipped" but has to duplicate the skip condition from the path definition to know this. A `snapshot.willStepBeSkipped("billing-address")` helper would eliminate this duplication.

---

## API used

| API | Used for |
|-----|----------|
| `PathShell` | Default shell with `steps` map |
| `usePathContext()` | Snapshot and actions in step components |
| `shouldSkip` | Conditionally skipping Payment and Billing steps |
| `onEnter` + `isFirstEntry` | Pre-filling billing from shipping |
| `fieldMessages` | Validation on all input steps |
| `snapshot.hasAttemptedNext` | Gating field error display |

