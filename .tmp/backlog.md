Core Features:

1. Conditioal Branching - Form Selection
   1.1 - Select between entire sub paths
   1.2 - Merge sub path into main line

2. Optional Complete and Cancel callbacks on PathDefinition ✅

3. Step Groups - Grouping steps together in the progress bar

4. resetStep() - Undo current step's data to the state it was when the step was entered ✅

5. Field Warnings

6. isDirty - Automatic dirty tracking ✅

7. Step Entered At Timestamp ✅

8. HATEOAS Adapter

12. Multitenant Support

13. Finish the Demos

15. MongoDB Adapter, IndexedDB Adapter, Postgres Adapter

16. API Guards

17. API For in Form Data (Lists Etc)
    17.1. For offline supprt, pre-load the data (Maybe into indexedDB)

8A Recursive Wizard



# Feature Ideas — Low Learning Curve

Ideas that reduce developer effort without adding new concepts to learn.

---


## 2. Step Groups

**Today:** The progress bar shows a flat list of steps. A 10-step wizard is visually overwhelming.

**Proposal:** An optional `group` string on `PathStep`:

```typescript
steps: [
  { id: "name",    group: "Personal",  title: "Your Name" },
  { id: "email",   group: "Personal",  title: "Email" },
  { id: "address", group: "Address",   title: "Street" },
  { id: "city",    group: "Address",   title: "City" },
  { id: "confirm", group: "Review",    title: "Confirm" }
]
```

The snapshot's `StepSummary` gains a `group?: string` field. The shell can render group headings in the progress bar. Developers who don't set `group` see no change.

**Where it lives:** Core adds the field to `PathStep` and `StepSummary`. Each adapter shell optionally renders group headers. Devs who ignore it get today's flat list.

---

---

## 4. `fieldWarnings` — Non-Blocking Messages

**Today:** `fieldMessages` blocks navigation (when `canMoveNext` is auto-derived). There's no way to say "this looks wrong but you can proceed."

**Proposal:** A parallel `fieldWarnings` hook, same shape as `fieldMessages`, but purely informational:

```typescript
{
  id: "payment",
  fieldMessages: ({ data }) => ({
    cardNumber: !data.cardNumber ? "Required." : undefined,
  }),
  fieldWarnings: ({ data }) => ({
    email: looksLikeTypo(data.email) ? "Did you mean gmail.com?" : undefined,
  })
}
```

The snapshot gets a `fieldWarnings: Record<string, string>` field. The shell renders them in yellow/amber instead of red. They never block `canMoveNext`.

**Why it's low-friction:** Identical pattern to `fieldMessages`. If you know one, you know the other. Ignore it if you don't need it.

**Where it lives:** Core adds the hook and snapshot field. Adapter shells render them styled differently from errors. Devs who don't define `fieldWarnings` see no change.

---

## 6. `stepEnteredAt` Timestamp

**Today:** No way to know how long a user has been on a step. Useful for analytics, timeout warnings ("You've been on this step for 10 minutes"), or observer-based logging.

**Proposal:** One field on the snapshot:

```typescript
stepEnteredAt: number;  // Date.now() captured when the step was entered
```

**Why it's low-friction:** Zero config. It's just there. An analytics observer can compute duration with `Date.now() - snapshot.stepEnteredAt`. Ignore it if you don't care.

**Where it lives:** Core only. Set in `enterCurrentStep()`. No adapter changes.

---

## Priority Ranking

| # | Feature | Effort | Value | Reason |
|---|---------|--------|-------|--------|
| 1 | `onComplete`/`onCancel` on PathDefinition | Tiny | High | Eliminates boilerplate every developer writes |
| 2 | Step Groups | Small | High | Makes long wizards usable; zero cost to ignore |
| 3 | `fieldWarnings` | Small | Medium | Natural extension of existing pattern |
| 4 | `resetStep()` | Tiny | Medium | One method, obvious behaviour |
| 5 | Dirty tracking (`isDirty`) | Tiny | Medium | Automatic, zero config |
| 6 | `stepEnteredAt` | Trivial | Low | Nice-to-have for analytics observers |

All six are additive, non-breaking, and optional. A developer who ignores all of them sees zero change in behaviour.

