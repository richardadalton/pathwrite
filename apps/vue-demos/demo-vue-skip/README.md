# demo-vue-skip

**Pathwrite Conditional Steps Demo — Subscription Flow (Vue)**

This demo implements Recipe 4 from the Pathwrite recipes guide: a subscription flow that demonstrates `shouldSkip` to conditionally hide steps based on user input.

## What it demonstrates

- **`shouldSkip`** — steps are skipped entirely based on path data, not hidden with `v-if` in the template
- **Free plan skips payment and billing** — selecting "Free" causes the engine to jump straight from Shipping Address to Review
- **"Billing same as shipping" skips billing** — on the Paid plan, checking the toggle skips the Billing Address step
- **`onEnter` pre-fill** — when the Billing Address step IS shown, `onEnter` copies shipping data into billing fields on first entry
- **Progress bar auto-adjusts** — the shell's progress indicator reflects only the steps actually visited, not all 5 defined steps

## Flow

| Step | Free Plan | Paid (same billing) | Paid (different billing) |
|------|-----------|---------------------|--------------------------|
| 1. Select Plan | ✓ | ✓ | ✓ |
| 2. Shipping Address | ✓ | ✓ | ✓ |
| 3. Payment Details | ⏭ skipped | ✓ | ✓ |
| 4. Billing Address | ⏭ skipped | ⏭ skipped | ✓ |
| 5. Review | ✓ | ✓ | ✓ |

## Running

```bash
npm install --no-workspaces --no-package-lock --legacy-peer-deps
npm start
```

Open [http://localhost:5173](http://localhost:5173)

## Stack

- Vue 3.5
- Pathwrite `@daltonr/pathwrite-vue` 0.6.3
- Vite 8 / TypeScript

