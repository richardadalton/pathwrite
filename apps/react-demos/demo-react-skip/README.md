# demo-react-skip

**Pathwrite Conditional Steps Demo — Subscription Flow (React)**

Same subscription flow as the Vue skip demo, implemented in React 18.

## What it demonstrates

- **`shouldSkip`** — steps are skipped entirely based on path data
- **Free plan skips payment and billing** — selecting "Free" jumps straight to Review
- **"Billing same as shipping"** toggle skips the Billing Address step on Paid plan
- **`onEnter` pre-fill** — Billing Address copies from shipping on first entry
- **Progress bar auto-adjusts** — only shows steps actually visited

## Flow

| Step | Free | Paid (same billing) | Paid (different billing) |
|------|------|---------------------|--------------------------|
| 1. Select Plan | ✓ | ✓ | ✓ |
| 2. Shipping Address | ✓ | ✓ | ✓ |
| 3. Payment Details | ⏭ | ✓ | ✓ |
| 4. Billing Address | ⏭ | ⏭ | ✓ |
| 5. Review | ✓ | ✓ | ✓ |

## Running

```bash
npm install --no-workspaces --no-package-lock --legacy-peer-deps
npm start
```

## Stack

- React 18, Pathwrite `@daltonr/pathwrite-react` 0.6.3, Vite 8 / TypeScript

