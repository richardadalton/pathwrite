# Chapter 11: Testing

Testing is where Pathwrite's headless architecture pays the highest dividend. Because `PathEngine` is a plain TypeScript class with no DOM, no component lifecycle, and no async framework machinery, the tests for your business rules are just function calls. This chapter shows the complete range of what you can test and how.

---

## The headless testing advantage

In a traditional form wizard, the business rules are entangled with the rendering layer. Testing whether the payment step is skipped for free-plan users requires you to mount a component, simulate user interaction, wait for re-renders, and query the DOM for the expected UI state. Slow. Brittle. Framework-specific.

In Pathwrite, the business rules live in `PathDefinition`. The engine executes them. Testing looks like this:

```ts
import { PathEngine } from "@daltonr/pathwrite-core";

it("starts on the first step", async () => {
  const engine = new PathEngine();
  await engine.start(myPath, { name: "" });
  expect(engine.snapshot()?.stepId).toBe("personal-details");
});
```

No browser. No mounting. No `renderHook`, no `TestBed`, no `mount()`. The engine is the thing you care about — test it directly. The React adapter, the Vue composable, the Angular facade — those are wrappers around the same engine, and you do not need to involve them unless you specifically want to test the adapter layer.

The contrast is most visible when a test suite has no imports from `@testing-library`, `@angular/core/testing`, or any Svelte test utility. A workflow test file imports `PathEngine`, your path factory, and `vitest`. That is all.

---

## The basic pattern

Every test follows the same structure: start an engine, drive navigation with `next()` and `previous()`, assert on `snapshot()`. The snapshot is `null` after the path completes.

```ts
import { describe, it, expect } from "vitest";
import { PathEngine } from "@daltonr/pathwrite-core";

const checkoutPath = {
  id: "checkout",
  steps: [
    { id: "cart" },
    { id: "shipping" },
    { id: "payment" },
    { id: "confirmation" },
  ],
};

it("advances through all steps to completion", async () => {
  const engine = new PathEngine();
  await engine.start(checkoutPath, {});

  expect(engine.snapshot()?.stepId).toBe("cart");
  expect(engine.snapshot()?.stepIndex).toBe(0);

  await engine.next();
  expect(engine.snapshot()?.stepId).toBe("shipping");

  await engine.next();
  expect(engine.snapshot()?.stepId).toBe("payment");

  await engine.next();
  expect(engine.snapshot()?.stepId).toBe("confirmation");

  await engine.next(); // completes
  expect(engine.snapshot()).toBeNull();
});
```

Note the `?.` on every `snapshot()` access. The snapshot returns `null` once the path completes. If your test drives the path to completion, check `snapshot()` before asserting on its properties.

---

## Testing `fieldErrors`

`fieldErrors` is a synchronous function that returns a record mapping field IDs to error strings (or `undefined` for valid fields). The engine evaluates it on every snapshot and exposes the result as `snapshot.fieldErrors`. Test it by starting the engine with specific data and asserting on the snapshot.

```ts
const profilePath = {
  id: "profile",
  steps: [
    {
      id: "details",
      fieldErrors: ({ data }) => ({
        name:  !data.name  ? "Name is required."  : undefined,
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

When using the factory pattern from Chapter 10, you can also test `fieldErrors` in complete isolation — without starting an engine at all. Since `fieldErrors` is just a function on the step definition, you can call it directly:

```ts
const path = createOnboardingPath(fast);
const usernameStep = path.steps[0];

// fieldErrors only destructures `data`; the other context fields can be omitted
function errs(partial: Partial<OnboardingData>) {
  return usernameStep.fieldErrors!({ data: { ...INITIAL_DATA, ...partial } } as any);
}

it("requires a username", () => {
  expect(errs({ username: "" }).username).toBeTruthy();
});

it("rejects usernames shorter than 3 characters", () => {
  expect(errs({ username: "ab" }).username).toBeTruthy();
});

it("accepts a valid username", () => {
  expect(errs({ username: "alice" }).username).toBeUndefined();
});
```

The `as any` cast is intentional and contained. `fieldErrors` only uses `data`; the rest of the context object (`stepId`, `pathId`, `isFirstEntry`) is irrelevant to the test. This pattern is considerably faster than spinning up an engine for pure validation logic.

---

## Testing `canMoveNext` guards

Guards run during navigation, not during snapshot reads. Test them by calling `next()` and observing whether `stepId` advanced.

### Synchronous guard

```ts
const cartPath = {
  id: "cart",
  steps: [
    {
      id: "items",
      canMoveNext: ({ data }) => (data.items as unknown[]).length > 0,
    },
    { id: "shipping" },
  ],
};

it("blocks forward navigation when the cart is empty", async () => {
  const engine = new PathEngine();
  await engine.start(cartPath, { items: [] });

  await engine.next();
  expect(engine.snapshot()?.stepId).toBe("items"); // stayed put
});

it("allows forward navigation when the cart has items", async () => {
  const engine = new PathEngine();
  await engine.start(cartPath, { items: ["widget"] });

  await engine.next();
  expect(engine.snapshot()?.stepId).toBe("shipping");
});
```

### Async guard

Async guards work identically. The engine awaits the promise before deciding whether to advance. The test just awaits `next()` and asserts on the result.

```ts
it("eligibility guard blocks when years < 2", async () => {
  const engine = new PathEngine();
  await engine.start(createOnboardingPath(fast), {
    ...INITIAL_DATA,
    username: "alice",
    planId: "pro",
  });

  // advance to the username step's guard
  await engine.next(); // guard fires — "alice" is available, passes
  expect(engine.snapshot()?.stepId).toBe("plan");
});

it("eligibility guard blocks a taken username", async () => {
  const engine = new PathEngine();
  await engine.start(createOnboardingPath(fast), {
    ...INITIAL_DATA,
    username: "admin", // FastMockServices marks this as taken
    planId: "pro",
  });

  await engine.next(); // guard fires — "admin" is taken, blocks
  expect(engine.snapshot()?.stepId).toBe("username");
  expect(engine.snapshot()?.blockingError).toBeTruthy();
});
```

When a guard returns `{ allowed: false, reason }`, the engine sets `snapshot.blockingError` to the reason string. Test that too — it is what your UI renders as the error message below the step.

To test the retry path, update the data and call `next()` again:

```ts
await engine.setData("username", "bob"); // bob is not taken
await engine.next();                     // guard now passes
expect(engine.snapshot()?.blockingError).toBeNull();
expect(engine.snapshot()?.stepId).toBe("plan");
```

---

## Testing `shouldSkip`

`shouldSkip` is evaluated as the engine attempts to land on a step. If it returns `true`, the step is bypassed entirely. The cleanest test drives navigation past the potentially-skipped step and asserts which step the engine actually landed on.

```ts
const subscriptionPath = {
  id: "subscription",
  steps: [
    { id: "plan" },
    {
      id: "billing",
      shouldSkip: ({ data }) => data.planId === "free",
    },
    { id: "confirmation" },
  ],
};

it("skips billing for free plan users", async () => {
  const engine = new PathEngine();
  await engine.start(subscriptionPath, { planId: "free" });

  await engine.next(); // plan → (skips billing) → confirmation
  expect(engine.snapshot()?.stepId).toBe("confirmation");
});

it("includes billing for paid plan users", async () => {
  const engine = new PathEngine();
  await engine.start(subscriptionPath, { planId: "pro" });

  await engine.next(); // plan → billing
  expect(engine.snapshot()?.stepId).toBe("billing");
});
```

The skipped step's ID never appears in `snapshot.stepId`. That is the invariant to assert: not that the step was skipped in some internal sense, but that navigation jumped over it.

For async `shouldSkip`, the pattern is identical — just await `next()`:

```ts
it("skips the billing step for free-plan accounts (async skip)", async () => {
  const engine = new PathEngine();
  await engine.start(createOnboardingPath(fast), {
    ...INITIAL_DATA,
    username: "alice",
    planId: "free",
  });

  await engine.next(); // username passes guard → plan
  await engine.next(); // plan → async shouldSkip resolves → skips billing → confirm
  expect(engine.snapshot()?.stepId).toBe("confirm");
});
```

---

## Testing sub-paths

Sub-paths are started with `engine.startSubPath()`. The engine suspends the parent and starts the sub-path as the active path. Test that `nestingLevel` increases, that you can navigate the sub-path, and that the parent resumes correctly when the sub-path completes.

```ts
const itemPath = {
  id: "add-item",
  steps: [
    { id: "item-name" },
    { id: "item-qty" },
  ],
};

const orderPath = {
  id: "order",
  steps: [
    {
      id: "items",
      onSubPathComplete: (_id, subData, ctx) => ({
        lineItems: [
          ...(ctx.data.lineItems as unknown[]),
          { name: subData.itemName, qty: subData.itemQty },
        ],
      }),
    },
    { id: "review" },
  ],
};

it("nestingLevel increases while a sub-path is active", async () => {
  const engine = new PathEngine();
  await engine.start(orderPath, { lineItems: [] });
  expect(engine.snapshot()?.nestingLevel).toBe(0);

  await engine.startSubPath(itemPath, { itemName: "", itemQty: 1 });
  expect(engine.snapshot()?.nestingLevel).toBe(1);
  expect(engine.snapshot()?.stepId).toBe("item-name");
});

it("parent resumes with merged sub-path data on completion", async () => {
  const engine = new PathEngine();
  await engine.start(orderPath, { lineItems: [] });
  await engine.startSubPath(itemPath, { itemName: "", itemQty: 0 });

  await engine.setData("itemName", "Widget");
  await engine.setData("itemQty", 3);
  await engine.next(); // item-name → item-qty
  await engine.next(); // sub-path completes

  // parent resumes
  expect(engine.snapshot()?.nestingLevel).toBe(0);
  expect(engine.snapshot()?.stepId).toBe("items");

  const items = engine.snapshot()?.data.lineItems as { name: string; qty: number }[];
  expect(items).toHaveLength(1);
  expect(items[0].name).toBe("Widget");
  expect(items[0].qty).toBe(3);
});
```

After the sub-path completes, `onSubPathComplete` on the parent step fires with the sub-path's final data. The return value is merged into the parent's data. Assert on both the parent's `stepId` (to confirm it resumed) and the parent's data (to confirm the merge was correct).

---

## Testing with mock services

The factory pattern makes service injection trivial. Define a `FastMockServices` class in your test file that implements the service interface without any simulated delays. This keeps tests fast without sacrificing correctness — the mock mirrors the real logic, it just does not sleep.

```ts
class FastMockServices implements OnboardingServices {
  private takenUsernames = new Set(["admin"]);

  async checkUsernameAvailable(username: string) {
    return !this.takenUsernames.has(username.toLowerCase());
  }
  async fetchPlanOptions() {
    return [
      { id: "free", label: "Free", price: 0 },
      { id: "pro",  label: "Pro",  price: 12 },
    ];
  }
  async requiresBillingDetails(planId: string) {
    return planId !== "free";
  }
}

const fast = new FastMockServices();
```

Instantiate the fast mock once at the top of the test file and use it in all tests. Then test both the happy path and the blocked path:

```ts
describe("username guard", () => {
  it("passes for an available username", async () => {
    const engine = new PathEngine();
    await engine.start(createOnboardingPath(fast), {
      ...INITIAL_DATA, username: "alice",
    });
    await engine.next();
    expect(engine.snapshot()?.stepId).toBe("plan");
  });

  it("blocks for a taken username", async () => {
    const engine = new PathEngine();
    await engine.start(createOnboardingPath(fast), {
      ...INITIAL_DATA, username: "admin",
    });
    await engine.next();
    expect(engine.snapshot()?.stepId).toBe("username");
    expect(engine.snapshot()?.blockingError).toMatch(/taken/i);
  });
});
```

If you need to test the `MockApplicationServices` that ships with a workflow package — the one with real `setTimeout` delays — use Vitest's fake timers rather than actually waiting:

```ts
it("checkEligibility rejects fewer than 2 years of experience", async () => {
  vi.useFakeTimers();
  const svc = new MockApplicationServices();

  const promise = svc.checkEligibility(1);
  await vi.runAllTimersAsync(); // fires the internal setTimeout immediately
  const result = await promise;

  expect(result.eligible).toBe(false);
  expect(result.reason).toBeTruthy();
  vi.useRealTimers();
});
```

Always restore real timers at the end of the test, or put `vi.useRealTimers()` in an `afterEach`. Leaving fake timers active between tests causes confusing failures in unrelated tests.

---

## Property-based testing with fast-check

Unit tests check specific examples. Property-based tests check invariants — rules that must hold across all possible inputs. For a workflow, the most important invariants are things like: "the same data always produces the same step sequence" and "the billing step is visited if and only if the plan requires billing details." These are hard to exhaust with hand-written cases; a property test runs them hundreds of times with automatically generated inputs.

Pathwrite's own engine test suite uses [fast-check](https://fast-check.dev) extensively. The files `packages/core/test/path-engine.properties.test.ts` and `packages/core/test/workflow-demos.properties.test.ts` are the reference examples. You can apply the same pattern to your own workflow.

### Defining arbitraries

An **arbitrary** is a generator for random values of a specific type. Define your domain arbitraries at the top of the properties test file:

```ts
import fc from "fast-check";

const KNOWN_PLANS = ["free", "pro", "team"] as const;

// Exercises both known plan IDs and arbitrary strings
const arbPlanId = fc.oneof(
  fc.constantFrom(...KNOWN_PLANS),
  fc.string()
);

// Username input as it arrives from a form: various lengths and edge cases
const arbUsername = fc.oneof(
  fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-z0-9]+$/.test(s)),
  fc.constant(""),          // the most common mistake
  fc.constant("ab"),        // too short
  fc.constantFrom("admin", "root", "support"), // known-taken usernames
);
```

Name arbitraries after the domain concept (`arbPlanId`, `arbUsername`) rather than the type (`arbString`). Include boundary cases explicitly — empty strings, zero, known-bad values.

### Service contract properties

```ts
describe("FastMockServices — requiresBillingDetails", () => {
  it("requires billing iff plan is not free, for all known plans", async () => {
    await fc.assert(fc.asyncProperty(
      fc.constantFrom(...KNOWN_PLANS),
      async (planId) => {
        const result = await fast.requiresBillingDetails(planId);
        expect(result).toBe(planId !== "free");
      }
    ));
  });
});
```

`fc.assert` runs the predicate 100 times by default, each time with a different generated input. If it finds a counterexample, it shrinks it to the smallest failing case and reports it.

### Validation rule properties

`fieldErrors` is a pure function. Property-test it with a synchronous predicate:

```ts
describe("createOnboardingPath — username fieldErrors", () => {
  const step = createOnboardingPath(fast).steps[0];

  it("error present iff username is empty or shorter than 3 chars", async () => {
    await fc.assert(fc.asyncProperty(arbUsername, (username) => {
      const errors = step.fieldErrors!({ data: { ...INITIAL_DATA, username } } as any);
      const shouldError = !username.trim() || username.trim().length < 3;
      expect(!!errors.username).toBe(shouldError);
    }));
  });
});
```

The predicate encodes the rule as executable specification. If someone changes the validation logic without updating the rule, the property test will catch it.

### Routing properties

Navigation routing — which steps are visited for which data — is the most important workflow logic to cover with properties:

```ts
describe("createOnboardingPath — billing routing", () => {
  it("billing visited iff plan is not free, for all known plans", async () => {
    await fc.assert(fc.asyncProperty(
      fc.constantFrom(...KNOWN_PLANS),
      async (planId) => {
        const engine = new PathEngine();
        await engine.start(createOnboardingPath(fast), {
          ...INITIAL_DATA,
          username: "alice", // always available in FastMockServices
          planId,
        });
        await engine.next(); // username → plan
        await engine.next(); // plan → billing or confirm
        const stepId = engine.snapshot()?.stepId;
        if (planId === "free") {
          expect(stepId).toBe("confirm");
        } else {
          expect(stepId).toBe("billing");
        }
      }
    ));
  });
});
```

### Determinism properties

A well-written workflow is deterministic: the same inputs always produce the same step sequence. Property-test this by running the engine twice with identical data and comparing the visited step IDs:

```ts
it("the same inputs always visit the same steps", async () => {
  const arbValidData = fc.record({
    username: fc.string({ minLength: 3, maxLength: 20 })
      .filter(s => s !== "admin" && s.trim().length >= 3),
    planId: fc.constantFrom(...KNOWN_PLANS),
    cardNumber: fc.constant("4242424242424242"),
    cardExpiry:  fc.constant("12/28"),
  });

  await fc.assert(fc.asyncProperty(arbValidData, async (data) => {
    async function run() {
      const engine = new PathEngine();
      await engine.start(createOnboardingPath(fast), data);
      const visited: string[] = [];
      while (engine.snapshot()) {
        visited.push(engine.snapshot()!.stepId);
        if (!engine.snapshot()!.canMoveNext) break;
        await engine.next();
      }
      return visited;
    }

    const [first, second] = await Promise.all([run(), run()]);
    expect(first).toEqual(second);
  }));
});
```

### Engine invariants

The engine's own test suite asserts on invariants like "stepIndex is always within `[0, stepCount)`" and "`previous()` never increases stepIndex." You can apply the same pattern to verify your workflow does not accidentally violate these invariants with unusual data:

```ts
it("stepIndex stays in bounds while navigating", async () => {
  const arbActions = fc.array(
    fc.oneof(fc.constant("next"), fc.constant("previous")),
    { minLength: 1, maxLength: 15 }
  );

  await fc.assert(fc.asyncProperty(arbActions, async (actions) => {
    const engine = new PathEngine();
    await engine.start(createOnboardingPath(fast), { ...INITIAL_DATA, username: "alice", planId: "pro" });

    for (const action of actions) {
      if (!engine.snapshot()) break;
      action === "next" ? await engine.next() : await engine.previous();
      const snap = engine.snapshot();
      if (snap) {
        expect(snap.stepIndex).toBeGreaterThanOrEqual(0);
        expect(snap.stepIndex).toBeLessThan(snap.stepCount);
      }
    }
  }));
});
```

### Common pitfalls

**`fc.float` requires 32-bit float boundaries.** `fc.float({ min: 0, max: 1.5 })` will throw because `1.5`'s boundary representation is sometimes rejected. Use integer arithmetic and map to the type you want:

```ts
// ✗ may throw at runtime
fc.float({ min: 0, max: 1.9, noNaN: true })

// ✓ generates 0 to 1.9 as strings
fc.integer({ min: 0, max: 19 }).map(n => (n / 10).toFixed(1))
```

**`fc.string()` generates whitespace-only strings.** If a test navigates past a step that validates fields, a whitespace-only value will block navigation before reaching the step under test — a correct failure, but for the wrong reason. Filter it:

```ts
fc.string({ minLength: 1 }).filter(s => s.trim().length > 0)
```

**Slow property tests from too many async operations.** Each `fc.asyncProperty` iteration starts a fresh engine and runs several `next()` calls. With 100 runs and 4 navigations per run, that is 400 async operations. With `FastMockServices`, this is negligible. If a test becomes slow, check whether a delay-introducing mock has crept in.

---

## What not to test

Do not write tests that assert on Pathwrite's own behaviour — that `next()` advances the step, that `shouldSkip` is respected, that the snapshot is immutable. The engine's test suite covers those invariants.

Your tests should cover your business logic:

- Does your `canMoveNext` guard encode the right rule?
- Does your `fieldErrors` function catch every required field?
- Does your `shouldSkip` condition branch on the right data key?
- Does your `onSubPathComplete` merge data correctly into the parent?
- Does your service produce the right outcome for the inputs your guards depend on?

The boundary is clear: you wrote it, you test it. Everything else is the engine's responsibility.

---

The final chapter steps back from mechanics and looks at the broader range of problems Pathwrite can solve — including many that don't look like wizards at all.

© 2026 Devjoy Ltd. MIT License.
