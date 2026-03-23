# demo-angular-subwizard

**Pathwrite Subwizard Demo — Approval Workflow (Angular)**

Same approval workflow as the Vue subwizard demo, implemented in Angular 17.

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

- Angular 17, Pathwrite `@daltonr/pathwrite-angular` 0.6.3, TypeScript 5.4

