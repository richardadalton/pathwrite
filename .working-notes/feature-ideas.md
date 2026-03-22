# Feature Ideas for Pathwrite

_Generated 2026-03-22 — post-0.5.0 brainstorm_

---

## 1. Step Analytics / Telemetry Hook

A built-in observer that tracks where users drop off, how long they spend on each step, and which validation errors they hit most. The event system already exists — a `pathAnalytics()` observer could emit structured events to any analytics backend (Segment, PostHog, custom).

```ts
pathAnalytics({ onEvent: (e) => posthog.capture(e) })
```

**Value:** Real wizard data — "72% of users abandon on step 3" — changes product decisions.

**Effort:** Low. Observer pattern already exists.

---

## 2. Branching Paths (Conditional Step Graphs)

Currently paths are linear arrays with `shouldSkip`. A `next` function on a step that returns a step ID would enable true branching — decision trees, not just skippable linear flows.

```ts
{ id: "plan-type", next: ({ data }) => data.plan === "enterprise" ? "billing" : "confirm" }
```

**Value:** Unlocks onboarding funnels, diagnostic wizards, choose-your-own-adventure flows.

**Effort:** Medium. Requires changes to the core engine's navigation logic.

---

## 3. Step Timeout / Idle Detection

A per-step `timeout` option that fires a callback (or auto-saves, or shows a warning) if the user idles too long. Useful for checkout flows, exam/quiz wizards, or session-sensitive forms.

```ts
{ id: "payment", timeout: { ms: 300_000, onTimeout: ({ data }) => autoSaveDraft(data) } }
```

**Effort:** Low-medium. Timer management in the engine, cleanup on navigation.

---

## 4. Undo/Redo Stack

Every `setData` call pushes to an undo stack. Expose `undo()` and `redo()` on the engine. Useful for form-heavy wizards where users want to revert a change without going back a step.

**Effort:** Medium. Needs snapshot diffing or command pattern.

---

## 5. Path Composition (Reusable Step Groups)

Let developers define reusable step "fragments" that can be composed into larger paths. An address-collection fragment, a payment fragment, an identity-verification fragment — snap them together.

```ts
const checkout = composePath(shippingSteps, paymentSteps, confirmationStep);
```

**Effort:** Low. Mostly a utility function over arrays of step definitions.

---

## 6. Optimistic Offline Support

An `offlineStore` adapter that queues persistence writes in IndexedDB/localStorage when offline, then syncs when connectivity returns. Pairs naturally with the existing `HttpStore` + observer pattern.

**Effort:** Medium. Needs queue management, conflict resolution strategy.

---

## 7. Step-Level Async Data Loading

An `onEnter` that returns data to merge into the path state — for steps that need to fetch options, prices, or user data before rendering. The snapshot could expose `isLoading` per-step.

```ts
{ id: "select-plan", onEnter: async () => ({ plans: await fetchPlans() }) }
```

**Effort:** Medium. `onEnter` already exists but doesn't merge return values into data.

---

## 8. Visual Path Debugger

A framework-agnostic dev-tools panel (or standalone web component) that shows the live step graph, current position, data state, event log, and guard evaluations in real time. Think React DevTools but for wizard flows.

**Effort:** High. Separate package, UI work.

---

## 9. Path Templates / Schema-Driven Paths

Define a path from JSON/YAML — no code. A `PathDefinition` is already serializable except for the functions. If guards and validation could reference named rules from a registry, entire wizards could be config-driven and loaded from a CMS or API.

**Effort:** Medium-high. Needs a rule registry and expression evaluator.

---

## 10. Multi-User / Collaborative Paths

A path where different steps are completed by different users (applicant fills steps 1-3, reviewer completes step 4, admin approves step 5). The engine already has persistence — add step-level ownership and you've got an approval workflow engine.

**Effort:** High. Needs auth/ownership model, likely server-side coordination.

---

## Priority Picks (best effort-to-value)

1. **Branching paths (#2)** — unlocks entire categories of use cases
2. **Step analytics (#1)** — low effort, high product insight
3. **Async data loading (#7)** — common real-world need, builds on existing hooks

