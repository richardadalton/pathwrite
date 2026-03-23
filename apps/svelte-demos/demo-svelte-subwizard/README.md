# demo-svelte-subwizard

**Pathwrite Subwizard Demo — Approval Workflow (Svelte)**

Same approval workflow as the Vue subwizard demo, implemented in Svelte 5.

Note: Step IDs use camelCase because Svelte component props cannot contain hyphens.

## Workflow

1. **Create Document** — Enter title and description
2. **Select Approvers** — Pick approvers from a preset list
3. **Awaiting Approvals** — Each approver clicks "Review →" to open their subwizard (View Document → Approve/Reject)
4. **Summary** — Review all decisions before finalising

Next is gated on step 3 until all approvers respond.

## Running

```bash
npm install --no-workspaces --no-package-lock --legacy-peer-deps
npm start
```

## Stack

- Svelte 5, Pathwrite `@daltonr/pathwrite-svelte` 0.6.3, Vite 6 / TypeScript

