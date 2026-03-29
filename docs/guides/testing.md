# Testing Guide

This guide covers how to test code that uses Pathwrite. It is written for contributors to this repo and for application developers who want to test their own path definitions.

---

## The headless advantage

Because `PathEngine` is a plain TypeScript class with no DOM, no component lifecycle, and no async framework machinery, you can test it exactly like any other pure logic module:

```typescript
import { PathEngine } from "@daltonr/pathwrite-core";

it("starts on the first step", async () => {
  const engine = new PathEngine();
  await engine.start(myPath, { name: "" });
  expect(engine.snapshot()?.stepId).toBe("personal-details");
});
```

No browser. No mounting. No `renderHook` or `TestBed` unless you specifically need to test the framework adapter layer. The engine is the thing you care about — test it directly.

---

## Unit testing a path

The basic pattern: create an engine, call `start()`, drive navigation with `next()` and `previous()`, then assert on `snapshot()`.

```typescript
import { PathEngine } from "@daltonr/pathwrite-core";

const signupPath = {
  id: "signup",
  steps: [
    { id: "account-details" },
    { id: "billing" },
    { id: "confirmation" },
  ],
};

it("advances through all steps to completion", async () => {
  const engine = new PathEngine();
  await engine.start(signupPath, {});

  expect(engine.snapshot()?.stepId).toBe("account-details");
  expect(engine.snapshot()?.stepIndex).toBe(0);

  await engine.next();
  expect(engine.snapshot()?.stepId).toBe("billing");

  await engine.next();
  expect(engine.snapshot()?.stepId).toBe("confirmation");

  await engine.next(); // complete
  expect(engine.snapshot()).toBeNull();
});
```

The snapshot is `null` after the path completes. Check `engine.snapshot()` before asserting on its fields whenever completion is part of the scenario.

---

## Testing fieldErrors

`fieldErrors` is a synchronous function on a step that returns a record of field names to error messages. It gates `canMoveNext` auto-derivation. Test it by inspecting `snapshot.fieldErrors`:

```typescript
const profilePath = {
  id: "profile",
  steps: [
    {
      id: "details",
      fieldErrors: ({ data }) => ({
        name: !data.name ? "Name is required." : undefined,
        email: !data.email ? "Email is required." : undefined,
      }),
    },
  ],
};

it("reports errors for empty required fields", async () => {
  const engine = new PathEngine();
  await engine.start(profilePath, { name: "", email: "" });

  const snap = engine.snapshot()!;
  expect(snap.fieldErrors?.name).toBe("Name is required.");
  expect(snap.fieldErrors?.email).toBe("Email is required.");
});

it("clears errors once fields are populated", async () => {
  const engine = new PathEngine();
  await engine.start(profilePath, { name: "Alice", email: "alice@example.com" });

  const snap = engine.snapshot()!;
  expect(snap.fieldErrors?.name).toBeUndefined();
  expect(snap.fieldErrors?.email).toBeUndefined();
});
```

`fieldErrors` values are `undefined` when the field is valid — the key is present but the value is `undefined`, not absent.

---

## Testing canMoveNext guards

### Synchronous guard

```typescript
const checkoutPath = {
  id: "checkout",
  steps: [
    {
      id: "cart",
      canMoveNext: ({ data }) => (data.items as unknown[]).length > 0,
    },
    { id: "shipping" },
  ],
};

it("blocks forward navigation when the cart is empty", async () => {
  const engine = new PathEngine();
  await engine.start(checkoutPath, { items: [] });

  await engine.next(); // blocked
  expect(engine.snapshot()?.stepId).toBe("cart");
});

it("allows forward navigation when the cart has items", async () => {
  const engine = new PathEngine();
  await engine.start(checkoutPath, { items: ["widget"] });

  await engine.next();
  expect(engine.snapshot()?.stepId).toBe("shipping");
});
```

### Async guard

Async guards work the same way. The engine awaits the promise before continuing:

```typescript
const approvalPath = {
  id: "approval",
  steps: [
    {
      id: "review",
      canMoveNext: async ({ data }) => {
        const result = await checkApprovalStatus(data.requestId as string);
        return result.approved;
      },
    },
    { id: "approved" },
  ],
};

it("blocks when approval is pending", async () => {
  vi.mocked(checkApprovalStatus).mockResolvedValue({ approved: false });

  const engine = new PathEngine();
  await engine.start(approvalPath, { requestId: "req-1" });

  await engine.next();
  expect(engine.snapshot()?.stepId).toBe("review");
});
```

---

## Testing shouldSkip

`shouldSkip` is evaluated as the engine attempts to land on a step. If `shouldSkip` returns `true`, the step is passed over entirely. Test it by asserting which step the engine lands on after navigation:

```typescript
const subscriptionPath = {
  id: "subscription",
  steps: [
    { id: "plan" },
    {
      id: "payment",
      shouldSkip: ({ data }) => data.plan === "free",
    },
    { id: "confirmation" },
  ],
};

it("skips the payment step for free plan users", async () => {
  const engine = new PathEngine();
  await engine.start(subscriptionPath, { plan: "free" });

  await engine.next(); // plan → skips payment → lands on confirmation
  expect(engine.snapshot()?.stepId).toBe("confirmation");
});

it("includes the payment step for paid plan users", async () => {
  const engine = new PathEngine();
  await engine.start(subscriptionPath, { plan: "pro" });

  await engine.next();
  expect(engine.snapshot()?.stepId).toBe("payment");
});
```

Skipped steps do not appear in `snapshot.steps` with a navigable status — their presence in the path definition does not affect progress counting for visible steps.

---

## Testing sub-paths

Sub-paths are launched with `engine.startSubPath()`. The engine suspends the parent and starts the sub-path as the active path. Test that `nestingLevel` increases and that the parent resumes with merged data when the sub-path completes:

```typescript
const subjectPath = {
  id: "add-subject",
  steps: [
    { id: "subject-name" },
    { id: "subject-teacher" },
  ],
};

const coursePath = {
  id: "course",
  steps: [
    {
      id: "subjects-list",
      onSubPathComplete: (_id, subData, ctx) => ({
        subjects: [
          ...(ctx.data.subjects as unknown[]),
          { name: subData.subjectName, teacher: subData.subjectTeacher },
        ],
      }),
    },
    { id: "review" },
  ],
};

it("increases nestingLevel while a sub-path is active", async () => {
  const engine = new PathEngine();
  await engine.start(coursePath, { subjects: [] });

  expect(engine.snapshot()?.nestingLevel).toBe(0);

  await engine.startSubPath(subjectPath, { subjectName: "", subjectTeacher: "" });

  expect(engine.snapshot()?.nestingLevel).toBe(1);
  expect(engine.snapshot()?.stepId).toBe("subject-name");
});

it("merges sub-path data into parent on completion", async () => {
  const engine = new PathEngine();
  await engine.start(coursePath, { subjects: [] });
  await engine.startSubPath(subjectPath, { subjectName: "", subjectTeacher: "" });

  await engine.setData("subjectName", "Mathematics");
  await engine.setData("subjectTeacher", "Dr. Smith");

  await engine.next(); // subject-name → subject-teacher
  await engine.next(); // complete sub-path

  // parent resumes
  expect(engine.snapshot()?.nestingLevel).toBe(0);
  expect(engine.snapshot()?.stepId).toBe("subjects-list");

  const subjects = engine.snapshot()?.data.subjects as { name: string; teacher: string }[];
  expect(subjects).toHaveLength(1);
  expect(subjects[0].name).toBe("Mathematics");
});
```

---

## Testing with services

Inject a mock service by closing over it from within the path definition, or pass it via the initial `data`. The guard or hook reads from `data` (or a closure reference) and returns the result. Testing is then just a matter of controlling the mock.

```typescript
interface CreditService {
  check(userId: string): Promise<boolean>;
}

function makeLoanPath(creditService: CreditService) {
  return {
    id: "loan-application",
    steps: [
      {
        id: "eligibility",
        canMoveNext: async ({ data }) => {
          return creditService.check(data.userId as string);
        },
      },
      { id: "offer" },
    ],
  };
}

it("blocks ineligible applicants", async () => {
  const mockService: CreditService = {
    check: vi.fn().mockResolvedValue(false),
  };

  const engine = new PathEngine();
  await engine.start(makeLoanPath(mockService), { userId: "user-123" });

  await engine.next();
  expect(engine.snapshot()?.stepId).toBe("eligibility");
  expect(mockService.check).toHaveBeenCalledWith("user-123");
});

it("advances eligible applicants to the offer step", async () => {
  const mockService: CreditService = {
    check: vi.fn().mockResolvedValue(true),
  };

  const engine = new PathEngine();
  await engine.start(makeLoanPath(mockService), { userId: "user-456" });

  await engine.next();
  expect(engine.snapshot()?.stepId).toBe("offer");
});
```

The factory function pattern (`makeLoanPath(service)`) is the cleanest approach. It keeps the path definition pure TypeScript and makes dependencies explicit.

---

## Property-based testing

The core engine test suite uses [fast-check](https://fast-check.io/) to verify invariants that must hold across all possible inputs — not just the specific cases a developer thinks to write. The approach is: generate arbitrary path definitions and arbitrary navigation sequences, then assert that certain properties always hold.

The files are:

- `packages/core/test/path-engine.properties.test.ts` — navigation invariants (step bounds, first/last step flags, progress monotonicity)
- `packages/core/test/workflow-demos.properties.test.ts` — property tests over more complex workflow scenarios

A representative example:

```typescript
import fc from "fast-check";
import { PathEngine } from "@daltonr/pathwrite-core";

const arbStepId = fc.nat(99).map(n => `step${n}`);

const arbPlainPath = fc
  .uniqueArray(arbStepId, { minLength: 1, maxLength: 8 })
  .map(ids => ({ id: "test", steps: ids.map(id => ({ id })) }));

const arbActions = fc.array(
  fc.oneof(fc.constant("next"), fc.constant("previous")),
  { minLength: 1, maxLength: 30 }
);

it("stepIndex is always within [0, stepCount) while path is active", async () => {
  await fc.assert(
    fc.asyncProperty(arbPlainPath, arbActions, async (path, actions) => {
      const engine = new PathEngine();
      await engine.start(path);
      for (const action of actions) {
        if (!engine.snapshot()) break;
        action === "next" ? await engine.next() : await engine.previous();
        const snap = engine.snapshot();
        if (snap) {
          expect(snap.stepIndex).toBeGreaterThanOrEqual(0);
          expect(snap.stepIndex).toBeLessThan(snap.stepCount);
        }
      }
    })
  );
});
```

When `fast-check` finds a counterexample it prints the minimal shrunk case, making failures easy to reproduce. This pattern is most valuable for:

- Bounds and invariants (`stepIndex` stays in range, `progress` stays in `[0, 1]`)
- Symmetry (`next()` then `previous()` returns to the same step)
- Guard consistency (`canMoveNext === false` means `next()` does not advance)

Consider adding property tests when you add new engine behaviour. Example invariants to verify: a path with all steps skipped except the last always lands on the last step; `nestingLevel` decreases back to 0 after a sub-path completes; `progress` is exactly 1 only when the path is complete.

---

## What not to test

Do not write tests that assert on Pathwrite's own behaviour — that `next()` advances the step, that `shouldSkip` is respected, that the snapshot is immutable. Those are the engine's invariants and the engine's test suite covers them.

Your tests should cover **your business logic**:

- Does your `canMoveNext` guard encode the right rule?
- Does your `fieldErrors` function catch every required field?
- Does your `shouldSkip` condition branch on the right data key?
- Does your `onSubPathComplete` merge data correctly into the parent?
- Does your service produce the right outcome for the inputs your guards depend on?

The cleanest test is one that starts an engine with specific data, drives it with `next()` or `previous()`, and asserts on the resulting snapshot. That test exercises your definition and nothing else.

---

© 2026 Devjoy Ltd. MIT License.
