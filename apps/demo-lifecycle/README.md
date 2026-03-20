# demo-lifecycle

Node script demonstrating `@pathwrite/core` as a **backend state machine** for document lifecycle management — no UI, no framework adapters.

## What it demonstrates

- Using `PathEngine` to model object/document state transitions (Draft → Review → Approved → Published).
- **Guards as business rules** — `canMoveNext` enforces that a document must have a title and body before leaving Draft, and that review must be approved before advancing.
- **Sub-paths as side processes** — a multi-step Review sub-path (`assign-reviewer` → `collect-feedback` → `record-decision`) is pushed onto the stack from the Review state.
- **`onSubPathComplete`** merging sub-path results back into the parent lifecycle data.
- **`shouldSkip`** for conditional states — internal memos skip the Review state entirely.
- **`goToStep`** for non-linear transitions — rejection sends the document back to Draft.
- **`meta`** for per-state metadata — each state carries allowed roles and SLA info.
- **Event-driven audit logging** — `subscribe()` captures every transition for an audit trail stored in `data.auditLog`.

## Lifecycle

```
Draft ──→ Review ──→ Approved ──→ Published
  ↑          │
  └──────────┘  (rejection via goToStep)
```

| State | Guard | Hook |
|-------|-------|------|
| `draft` | title + body required | `onLeave` logs submission |
| `review` | skipped for memos; blocks until outcome ≠ pending | `onEnter` resets outcome; `onSubPathComplete` merges reviewer decision |
| `approved` | — | `onEnter` records approver |
| `published` | — | `onEnter` records timestamp |

### Review sub-path

| Step | Description |
|------|-------------|
| `assign-reviewer` | Sets reviewer via `onEnter` |
| `collect-feedback` | Awaits external decision (simulated) |
| `record-decision` | Timestamps the decision |

## Scenarios

| # | Scenario | Flow |
|---|----------|------|
| 1 | Happy path | Draft → Review → Approved → Published |
| 2 | Rejection | Draft → Review → (reject) → Draft → Review → Approved → Published |
| 3 | Auto-skip | Draft → ~~Review~~ → Approved → Published (memo skips review) |

## Run

```bash
npm run demo:lifecycle
```

## Key takeaway

`@pathwrite/core` is not UI-specific. Steps are states, guards are business rules, sub-paths are side processes, and `shouldSkip` handles conditional routing. The same engine that drives a multi-step form can drive a backend document workflow, approval pipeline, or any ordered state transition with restrictions.

