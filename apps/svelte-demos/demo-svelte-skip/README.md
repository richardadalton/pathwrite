# demo-svelte-skip

**Pathwrite Conditional Steps Demo — Subscription Flow (Svelte)**

Same subscription flow as the Vue skip demo, implemented in Svelte 5.

Note: Step IDs use camelCase because Svelte component props cannot contain hyphens.

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

- Svelte 5, Pathwrite `@daltonr/pathwrite-svelte` 0.6.3, Vite 6 / TypeScript

