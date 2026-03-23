# Feedback — demo-react-subwizard

Pathwrite version: 0.6.3
Date: March 2026

---

## What worked well

### 1. Single PathShell with a `steps` map handles everything
One `<PathShell>` component with a flat `steps` map covers both the main workflow and the approval subwizard. When `startSubPath()` is called, the engine switches the active step ID and the shell renders the matching entry from the map. No router, no conditional logic, no second shell instance.

### 2. `onSubPathComplete` removes the need for shared state
In a typical React app, merging data from a child flow back into a parent would require lifting state, context providers, or a state manager. Pathwrite's `onSubPathComplete` hook handles this entirely within the path definition — no React-specific plumbing needed. The path definition file is pure TypeScript, shareable across frameworks.

### 3. `meta` correlation avoids prop drilling
The `{ approverId }` meta passed to `startSubPath()` comes back unchanged in `onSubPathComplete`. This removes the need to embed routing/identification concerns in the subwizard's own data or thread them through React props.

### 4. Gate step via `fieldMessages` is zero-effort
The `_` key on `fieldMessages` blocks Next until all approvers respond. No separate `canMoveNext` guard needed — the engine derives it automatically. The gate message doubles as a user-visible status.

### 5. `usePathContext()` works seamlessly across nesting levels
Step components call `usePathContext()` regardless of whether they're in the main wizard or a subwizard. The context always resolves to the currently active path. `ViewDocumentStep` and `DecisionStep` use `usePathContext<ApprovalData>()` and it just works — the generic narrows the snapshot data type correctly.

---

## Friction points

### 1. `snapshot!` non-null assertion in every step component
Every step component does `const snap = snapshot!` because `usePathContext()` returns `snapshot` as `PathSnapshot | null`. Inside a `PathShell` step, it's always non-null, but TypeScript doesn't know that. A `usePathContextAsserted()` or a shell-scoped context that guarantees non-null would reduce boilerplate.

### 2. No type narrowing on `startSubPath` initial data
`startSubPath(approvalSubPath, initialData, meta)` accepts `PathData` for the second argument. The `ApprovalData` interface is only enforced by the developer building the `initialData` object manually — there's no compile-time check that it matches the sub-path's generic.

### 3. Subwizard "Previous" on first step silently cancels
Pressing "Previous" on the View Document step exits the subwizard entirely. The shell's Back button gives no visual indication that it will cancel rather than navigate. A `snapshot.isSubPathFirstStep` flag or a configurable back label on subwizards would help.

---

## API used

| API | Used for |
|-----|----------|
| `PathShell` | Single shell with `steps` map for main + sub paths |
| `usePathContext()` | Snapshot and actions inside step components |
| `startSubPath(path, data, meta)` | Launching per-approver review subwizard |
| `onSubPathComplete` | Merging approver decision into parent path data |
| `fieldMessages` with `_` key | Gate step — blocks Next until all respond |
| `snapshot.hasAttemptedNext` | Gating field error display |
| `snapshot.isNavigating` | Disabling Review button during transitions |

