# Testing Pathwrite — Complete Guide

How to test forms, steps, sub-wizards, and full wizards **without touching the UI**.

---

## The Key Insight

The `PathEngine` is headless. It has no DOM dependency, no framework dependency, and no async setup. You can instantiate it, feed it data, call navigation methods, and inspect the snapshot — all in plain unit tests. **Every test in this guide runs without a browser, without mounting components, and without clicking buttons.**

---

## 1. Testing a Single Step (Form) in Isolation

A single-step path *is* a form. You can test its validation, field messages, guards, and lifecycle hooks without defining the rest of the wizard.

### Basic validation

```typescript
import { describe, it, expect } from "vitest";
import { PathEngine, PathDefinition } from "@daltonr/pathwrite-core";

// Define a one-step path — this is your form
const contactForm: PathDefinition = {
  id: "contact",
  steps: [{
    id: "contact-info",
    fieldMessages: ({ data }) => ({
      name:  !data.name  ? "Name is required."  : undefined,
      email: !data.email ? "Email is required." : undefined,
    }),
    // canMoveNext is auto-derived from fieldMessages when not explicitly set
  }]
};

describe("Contact form — validation", () => {
  it("shows errors when fields are empty", async () => {
    const engine = new PathEngine();
    await engine.start(contactForm);

    const snap = engine.snapshot()!;
    expect(snap.fieldMessages.name).toBe("Name is required.");
    expect(snap.fieldMessages.email).toBe("Email is required.");
    expect(snap.canMoveNext).toBe(false);
  });

  it("clears errors when data is filled in", async () => {
    const engine = new PathEngine();
    await engine.start(contactForm);

    await engine.setData("name", "Alice");
    await engine.setData("email", "alice@example.com");

    const snap = engine.snapshot()!;
    expect(snap.fieldMessages).toEqual({});
    expect(snap.canMoveNext).toBe(true);
  });

  it("blocks submit when validation fails", async () => {
    const engine = new PathEngine();
    await engine.start(contactForm);

    await engine.next(); // attempt to submit — blocked by fieldMessages
    expect(engine.snapshot()?.stepId).toBe("contact-info"); // still on the form
  });

  it("completes when validation passes", async () => {
    const engine = new PathEngine();
    await engine.start(contactForm, { name: "Alice", email: "alice@example.com" });

    await engine.next(); // all valid — form completes
    expect(engine.snapshot()).toBeNull(); // path completed
  });
});
```

### Testing onEnter defaults

```typescript
it("sets default values via onEnter on first visit", async () => {
  const form: PathDefinition = {
    id: "settings",
    steps: [{
      id: "preferences",
      onEnter: ({ isFirstEntry }) =>
        isFirstEntry ? { theme: "dark", notifications: true } : undefined,
    }]
  };

  const engine = new PathEngine();
  await engine.start(form);

  expect(engine.snapshot()?.data.theme).toBe("dark");
  expect(engine.snapshot()?.data.notifications).toBe(true);
});
```

### Testing onLeave transforms

```typescript
it("normalises email on leave", async () => {
  const form: PathDefinition = {
    id: "signup",
    steps: [
      {
        id: "email-step",
        onLeave: ({ data }) => ({ email: (data.email as string).trim().toLowerCase() }),
      },
      { id: "done" }
    ]
  };

  const engine = new PathEngine();
  await engine.start(form, { email: "  ALICE@Example.COM  " });
  await engine.next();

  expect(engine.snapshot()?.data.email).toBe("alice@example.com");
});
```

---

## 2. Testing a Step from a Larger Wizard — Without Running the Full Wizard

You don't need to navigate through steps 1–3 to test step 4. **Extract the step, put it in a one-step path, and test it directly.**

```typescript
// Your real wizard definition
const onboarding: PathDefinition = {
  id: "onboarding",
  steps: [
    { id: "personal",    /* ... */ },
    { id: "address",     /* ... */ },
    { id: "preferences", /* ... */ },
    { id: "confirm",     /* ... */ },
  ]
};

// Pull out just the step you want to test
const addressStep = onboarding.steps[1];

describe("Address step — isolated", () => {
  it("requires street and city", async () => {
    const engine = new PathEngine();
    // Wrap the single step in a throwaway path
    await engine.start({ id: "test", steps: [addressStep] });

    expect(engine.snapshot()?.fieldMessages).toMatchObject({
      street: expect.any(String),
      city:   expect.any(String),
    });
  });

  it("passes validation with complete address data", async () => {
    const engine = new PathEngine();
    await engine.start(
      { id: "test", steps: [addressStep] },
      { street: "123 Main St", city: "Springfield", postcode: "62701" }
    );

    expect(engine.snapshot()?.fieldMessages).toEqual({});
    expect(engine.snapshot()?.canMoveNext).toBe(true);
  });
});
```

**Why this works:** Steps are plain objects. They don't know or care what path they're in. A step's `fieldMessages`, `canMoveNext`, `onEnter`, and `onLeave` all receive a `ctx` with `data` — they don't reference other steps. You supply the data, you get the result.

---

## 3. Testing a Sub-Wizard in Isolation

A sub-path definition is just a `PathDefinition`. You can test it as a standalone path — it doesn't need a parent.

```typescript
const approvalSubWizard: PathDefinition = {
  id: "approval",
  steps: [
    { id: "review-doc", title: "Review Document" },
    {
      id: "decision",
      title: "Approve or Reject",
      fieldMessages: ({ data }) => ({
        decision: !data.decision ? "You must approve or reject." : undefined,
        comments: data.decision === "rejected" && !data.comments
          ? "Comments are required when rejecting."
          : undefined,
      }),
    },
  ]
};

describe("Approval sub-wizard — isolated", () => {
  it("blocks decision step until a choice is made", async () => {
    const engine = new PathEngine();
    await engine.start(approvalSubWizard, { documentTitle: "Q3 Report" });
    await engine.next(); // review → decision

    await engine.next(); // blocked — no decision
    expect(engine.snapshot()?.stepId).toBe("decision");
  });

  it("requires comments when rejecting", async () => {
    const engine = new PathEngine();
    await engine.start(approvalSubWizard, { documentTitle: "Q3 Report" });
    await engine.next();

    await engine.setData("decision", "rejected");
    expect(engine.snapshot()?.fieldMessages.comments).toBe(
      "Comments are required when rejecting."
    );
    expect(engine.snapshot()?.canMoveNext).toBe(false);
  });

  it("completes when approved", async () => {
    const engine = new PathEngine();
    await engine.start(approvalSubWizard, { documentTitle: "Q3 Report" });
    await engine.next();

    await engine.setData("decision", "approved");
    await engine.next(); // completes

    expect(engine.snapshot()).toBeNull();
  });
});
```

---

## 4. Testing Sub-Wizard Integration with a Parent

When you need to test that a sub-path's completion correctly patches the parent's data:

```typescript
describe("Parent ↔ sub-path integration", () => {
  const parent: PathDefinition = {
    id: "document-flow",
    steps: [{
      id: "review-step",
      onSubPathComplete: (subPathId, subData) => ({
        reviewOutcome: subData.decision,
        reviewComments: subData.comments,
      }),
      onSubPathCancel: () => ({
        reviewOutcome: "skipped",
      }),
    }]
  };

  const subPath: PathDefinition = {
    id: "review",
    steps: [{ id: "decide" }, { id: "confirm" }]
  };

  it("merges sub-path data into parent on completion", async () => {
    const engine = new PathEngine();
    await engine.start(parent);

    // Launch sub-path with initial data
    await engine.startSubPath(subPath, { decision: "approved", comments: "LGTM" });
    expect(engine.snapshot()?.pathId).toBe("review");

    // Complete the sub-path
    await engine.next();
    await engine.next();

    // Back on parent — data merged
    expect(engine.snapshot()?.pathId).toBe("document-flow");
    expect(engine.snapshot()?.data.reviewOutcome).toBe("approved");
    expect(engine.snapshot()?.data.reviewComments).toBe("LGTM");
  });

  it("handles sub-path cancellation", async () => {
    const engine = new PathEngine();
    await engine.start(parent);
    await engine.startSubPath(subPath);

    await engine.cancel();

    expect(engine.snapshot()?.pathId).toBe("document-flow");
    expect(engine.snapshot()?.data.reviewOutcome).toBe("skipped");
  });
});
```

---

## 5. Testing a Full Wizard End-to-End

Drive the entire wizard from start to completion using only engine calls:

```typescript
const subscription: PathDefinition = {
  id: "subscription",
  steps: [
    { id: "plan", title: "Choose Plan" },
    {
      id: "payment",
      title: "Payment",
      shouldSkip: (ctx) => ctx.data.plan === "free",
      fieldMessages: ({ data }) => ({
        cardNumber: !data.cardNumber ? "Card number is required." : undefined,
      }),
    },
    { id: "confirm", title: "Confirm" },
  ]
};

describe("Subscription wizard — full flow", () => {
  it("free plan skips payment and completes in 2 steps", async () => {
    const engine = new PathEngine();
    await engine.start(subscription, { plan: "free" });

    expect(engine.snapshot()?.stepId).toBe("plan");
    await engine.next(); // plan → confirm (payment skipped)
    expect(engine.snapshot()?.stepId).toBe("confirm");
    await engine.next(); // confirm → complete

    expect(engine.snapshot()).toBeNull();
  });

  it("paid plan requires payment details", async () => {
    const engine = new PathEngine();
    await engine.start(subscription, { plan: "pro" });

    await engine.next(); // plan → payment
    expect(engine.snapshot()?.stepId).toBe("payment");

    await engine.next(); // blocked — no card number
    expect(engine.snapshot()?.stepId).toBe("payment");

    await engine.setData("cardNumber", "4111111111111111");
    await engine.next(); // payment → confirm
    expect(engine.snapshot()?.stepId).toBe("confirm");
  });

  it("emits completed event with final data", async () => {
    const engine = new PathEngine();
    const events: any[] = [];
    engine.subscribe((e) => events.push(e));

    await engine.start(subscription, { plan: "free", email: "alice@co.com" });
    await engine.next(); // plan → confirm
    await engine.next(); // confirm → complete

    const completed = events.find((e) => e.type === "completed");
    expect(completed).toBeDefined();
    expect(completed.data.plan).toBe("free");
    expect(completed.data.email).toBe("alice@co.com");
  });
});
```

---

## 6. Testing shouldSkip Logic

```typescript
describe("Conditional step skipping", () => {
  const wizard: PathDefinition = {
    id: "checkout",
    steps: [
      { id: "shipping" },
      {
        id: "billing",
        shouldSkip: (ctx) => ctx.data.sameAsShipping === true,
      },
      { id: "confirm" },
    ]
  };

  it("skips billing when sameAsShipping is true", async () => {
    const engine = new PathEngine();
    await engine.start(wizard, { sameAsShipping: true });
    await engine.next(); // shipping → confirm (billing skipped)
    expect(engine.snapshot()?.stepId).toBe("confirm");
  });

  it("shows billing when sameAsShipping is false", async () => {
    const engine = new PathEngine();
    await engine.start(wizard, { sameAsShipping: false });
    await engine.next(); // shipping → billing
    expect(engine.snapshot()?.stepId).toBe("billing");
  });

  it("re-evaluates skip on backward navigation", async () => {
    const engine = new PathEngine();
    await engine.start(wizard, { sameAsShipping: false });
    await engine.next(); // → billing
    await engine.next(); // → confirm

    // User changes their mind
    await engine.setData("sameAsShipping", true);
    await engine.previous(); // confirm → shipping (billing now skipped)
    expect(engine.snapshot()?.stepId).toBe("shipping");
  });
});
```

---

## 7. Testing Observers (Persistence, Logging, Analytics)

Observers are plain functions. Test them by calling them directly with crafted events — no real engine needed:

```typescript
import { httpPersistence } from "@daltonr/pathwrite-store-http";
import { PathEngine } from "@daltonr/pathwrite-core";

describe("Persistence observer", () => {
  it("saves state on next (onNext strategy)", async () => {
    const mockSave = vi.fn(() => Promise.resolve());
    const mockStore = { save: mockSave, load: vi.fn(), delete: vi.fn() };

    // Create observer
    const observer = httpPersistence({ store: mockStore as any, key: "user:123" });

    // Craft a fake event — no real engine needed
    const fakeEngine = {
      exportState: () => ({
        version: 1, pathId: "w", currentStepIndex: 1,
        data: { name: "Alice" }, visitedStepIds: ["s1", "s2"],
        pathStack: [], _isNavigating: false,
      })
    } as unknown as PathEngine;

    // Fire a settled next event
    observer(
      { type: "stateChanged", cause: "next", snapshot: { isNavigating: false } as any },
      fakeEngine
    );

    await vi.runAllTimersAsync();
    expect(mockSave).toHaveBeenCalledWith("user:123", expect.objectContaining({ pathId: "w" }));
  });

  it("does NOT save on setData (onNext strategy)", async () => {
    const mockSave = vi.fn();
    const mockStore = { save: mockSave, load: vi.fn(), delete: vi.fn() };
    const observer = httpPersistence({ store: mockStore as any, key: "user:123" });

    observer(
      { type: "stateChanged", cause: "setData", snapshot: { isNavigating: false } as any },
      {} as PathEngine
    );

    await vi.runAllTimersAsync();
    expect(mockSave).not.toHaveBeenCalled();
  });
});
```

### Testing a custom observer

```typescript
it("custom analytics observer fires on every settled change", () => {
  const logged: string[] = [];
  const analyticsObserver = (event, engine) => {
    if (matchesStrategy("onEveryChange", event)) {
      logged.push(engine.snapshot()?.stepId);
    }
  };

  const engine = new PathEngine({ observers: [analyticsObserver] });
  await engine.start({ id: "w", steps: [{ id: "a" }, { id: "b" }] });
  await engine.next();

  expect(logged).toContain("a"); // from start
  expect(logged).toContain("b"); // from next
});
```

---

## 8. Testing State Export/Import (Persistence Round-Trip)

```typescript
describe("State round-trip", () => {
  const wizard: PathDefinition = {
    id: "onboarding",
    steps: [{ id: "name" }, { id: "email" }, { id: "confirm" }]
  };

  it("exports and restores state at the correct step with correct data", async () => {
    // Session 1: user fills in name, advances to email
    const engine1 = new PathEngine();
    await engine1.start(wizard, { name: "Alice" });
    await engine1.next();
    await engine1.setData("email", "alice@co.com");

    const exported = engine1.exportState()!;

    // Simulate serialisation (e.g. to/from a database)
    const json = JSON.stringify(exported);
    const restored = JSON.parse(json);

    // Session 2: user resumes
    const engine2 = PathEngine.fromState(restored, { onboarding: wizard });

    expect(engine2.snapshot()?.stepId).toBe("email");
    expect(engine2.snapshot()?.data.name).toBe("Alice");
    expect(engine2.snapshot()?.data.email).toBe("alice@co.com");

    // Can continue navigating normally
    await engine2.next();
    expect(engine2.snapshot()?.stepId).toBe("confirm");
  });

  it("restores sub-path state and stack", async () => {
    const sub: PathDefinition = { id: "sub", steps: [{ id: "s1" }, { id: "s2" }] };
    const engine1 = new PathEngine();
    await engine1.start(wizard);
    await engine1.startSubPath(sub, { subValue: 42 });
    await engine1.next(); // advance sub to s2

    const exported = engine1.exportState()!;
    const engine2 = PathEngine.fromState(exported, { onboarding: wizard, sub });

    expect(engine2.snapshot()?.pathId).toBe("sub");
    expect(engine2.snapshot()?.stepId).toBe("s2");
    expect(engine2.snapshot()?.nestingLevel).toBe(1);

    // Cancel sub-path — pops back to parent
    await engine2.cancel();
    expect(engine2.snapshot()?.pathId).toBe("onboarding");
  });
});
```

---

## 9. Testing with Framework Adapters (When You Must)

If you need to test adapter-specific reactivity, each adapter has a minimal setup:

### React

```tsx
import { renderHook, act } from "@testing-library/react";
import { usePath } from "@daltonr/pathwrite-react";

it("reactive snapshot updates on next()", async () => {
  const { result } = renderHook(() => usePath());
  await act(() => result.current.start(myPath));
  await act(() => result.current.next());
  expect(result.current.snapshot?.stepId).toBe("step2");
});
```

### Vue

```typescript
import { effectScope } from "vue";
import { usePath } from "@daltonr/pathwrite-vue";

it("reactive snapshot updates on next()", async () => {
  const scope = effectScope();
  const { snapshot, start, next } = scope.run(() => usePath())!;
  await start(myPath);
  await next();
  expect(snapshot.value?.stepId).toBe("step2");
  scope.stop();
});
```

### Angular

```typescript
import { PathFacade } from "@daltonr/pathwrite-angular";

it("facade works without TestBed", async () => {
  const facade = new PathFacade();
  await facade.start(myPath);
  await facade.next();
  expect(facade.snapshot()?.stepId).toBe("step2");
  facade.ngOnDestroy();
});
```

### Svelte

```typescript
vi.mock("svelte", async () => {
  const actual = await vi.importActual<typeof import("svelte")>("svelte");
  return { ...actual, onDestroy: () => {}, getContext: () => undefined, setContext: () => {} };
});
import { usePath } from "@daltonr/pathwrite-svelte";

it("reactive snapshot updates on next()", async () => {
  const path = usePath();
  await path.start(myPath);
  await path.next();
  expect(path.snapshot?.stepId).toBe("step2");
});
```

**But you almost never need these.** The engine tests cover all logic. Adapter tests only verify that the reactive wrapper correctly subscribes and exposes snapshots.

---

## Summary

| What you're testing | How | UI needed? |
|---------------------|-----|-----------|
| Single form/step validation | One-step `PathDefinition` + `engine.start()` + `engine.snapshot()` | No |
| A step from a larger wizard | Extract the step, wrap in a throwaway path | No |
| Sub-wizard in isolation | Start the sub-path definition directly as a top-level path | No |
| Sub-wizard ↔ parent integration | `startSubPath()` + `next()` through completion, check parent data | No |
| Full wizard end-to-end | `start()` → `setData()` → `next()` → assert snapshots → `completed` event | No |
| shouldSkip logic | Supply different initial data, assert which step is active after `next()` | No |
| Observers (persistence, analytics) | Call the observer function directly with crafted events | No |
| State export/import round-trip | `exportState()` → `JSON.stringify/parse` → `fromState()` → assert snapshot | No |
| Framework adapter reactivity | `renderHook` / `effectScope` / `new PathFacade()` / mock `onDestroy` | No |

Everything in Pathwrite can be tested by calling engine methods and reading the snapshot. No browser, no DOM, no HTTP, no UI.


---

© 2026 Devjoy Ltd. MIT License.

