# demo-react-subwizard

**Pathwrite Subwizard Demo — Approval Workflow (React)**

Same approval workflow as the Vue subwizard demo, implemented in React 18.

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

- React 18, Pathwrite `@daltonr/pathwrite-react` 0.6.3, Vite 8 / TypeScript

