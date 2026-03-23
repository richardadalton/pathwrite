# demo-vue-subwizard

**Pathwrite Subwizard Demo — Approval Workflow (Vue)**

This demo implements Recipe 3 from the Pathwrite recipes guide: a document approval workflow that demonstrates dynamically launched subwizards gated by all approvers completing.

## What it demonstrates

- **`startSubPath()`** — launching a per-approver review subwizard from within a step component
- **`onSubPathComplete`** — recording each approver's decision back into the parent path's data automatically when their subwizard finishes
- **Gate step** — the "Awaiting Approvals" step uses `fieldMessages` to block Next until every selected approver has decided (engine derives `canMoveNext` automatically from `fieldMessages`)
- **`meta` correlation** — the `approverId` is passed as `meta` to `startSubPath()` and returned unchanged to `onSubPathComplete`, cleanly identifying which approver completed without embedding it in subwizard data
- **Single `PathShell`** — both main and subwizard steps are declared as named slots on one `<PathShell>`. The shell automatically renders the correct slot based on the current engine step ID, regardless of nesting level

## Workflow

1. **Create Document** — Enter a title and description
2. **Select Approvers** — Pick 1–5 approvers from a preset list
3. **Awaiting Approvals** — Each approver clicks "Review →" to open their subwizard:
   - **View Document** — Read the document
   - **Your Decision** — Approve or reject with an optional comment
   - Completing the subwizard returns to the approvals list with the decision recorded
4. **Summary** — Inline review of all decisions before finalising

Next is disabled on step 3 until all selected approvers have responded.

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

