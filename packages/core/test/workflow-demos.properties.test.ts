import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { PathEngine } from "@daltonr/pathwrite-core";

// Demo path definitions live in apps/. All adapter imports there are type-only
// (import type ...) so they are stripped at runtime and cause no resolution issue.
import { subscriptionPath }   from "../../../apps/react-demos/demo-react-skip/src/subscription";
import { onboardingPath }      from "../../../apps/react-demos/demo-react-wizard/src/onboarding";
import { addressPath, INITIAL_DATA as ADDRESS_INITIAL } from "../../../apps/react-demos/demo-react-stepchoice/src/address-path";
import { skipPath }            from "../../../apps/react-native-demos/demo-rn-skip/src/skip-path";
import { coursePath, getQuizScore, INITIAL_DATA as COURSE_INITIAL } from "../../../apps/vue-demos/demo-vue-course/src/course";
import { TOPIC_IDS, TOPICS }   from "../../../apps/vue-demos/demo-vue-course/src/topics";
import { contactFormPath }     from "../../../apps/react-demos/demo-react-form/src/path";
import { approvalWorkflowPath } from "../../../apps/react-demos/demo-react-subwizard/src/approval";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Drive a path forward with the provided data until either the path completes
 * or canMoveNext is false (step is blocked). Returns every stepId visited in order.
 */
async function traversePath(
  path: Parameters<PathEngine["start"]>[0],
  data: Record<string, unknown>,
): Promise<string[]> {
  const engine = new PathEngine();
  await engine.start(path as any, data);
  const visited: string[] = [];
  let guard = 0;
  while (engine.snapshot() && guard++ < 50) {
    visited.push(engine.snapshot()!.stepId);
    if (!engine.snapshot()!.canMoveNext) break;
    await engine.next();
  }
  return visited;
}

// ---------------------------------------------------------------------------
// subscriptionPath — skip conditions
// ---------------------------------------------------------------------------

describe("workflow demo — subscriptionPath skip conditions", () => {
  const paymentStep   = subscriptionPath.steps.find(s => s.id === "payment")!;
  const billingStep   = subscriptionPath.steps.find(s => s.id === "billing-address")!;

  it("payment.shouldSkip is true ↔ plan === 'free', for any plan value", async () => {
    await fc.assert(fc.asyncProperty(
      fc.oneof(fc.constant("free"), fc.constant("paid"), fc.string()),
      (plan) => {
        const result = paymentStep.shouldSkip!({ data: { plan } } as any);
        expect(result).toBe(plan === "free");
      }
    ));
  });

  it("billing-address.shouldSkip ↔ plan === 'free' || billingSameAsShipping, for any inputs", async () => {
    await fc.assert(fc.asyncProperty(
      fc.oneof(fc.constant("free"), fc.constant("paid"), fc.string()),
      fc.boolean(),
      (plan, billingSameAsShipping) => {
        const result = billingStep.shouldSkip!({ data: { plan, billingSameAsShipping } } as any);
        expect(result).toBe(plan === "free" || billingSameAsShipping === true);
      }
    ));
  });

  // Strings with at least one non-whitespace character — passes the .trim() checks
  // used in fieldErrors. fc.string({ minLength: 1 }) can generate " " (single space)
  // which trim()s to "", failing the "required" guards and blocking navigation before
  // the steps under test. This is valid validation behaviour, not a bug, but it means
  // end-to-end traversal tests need non-blank field values.
  const nonBlankString = fc.string({ minLength: 1 }).filter(s => s.trim().length > 0);

  it("free plan: payment and billing-address are never visited regardless of other field values", async () => {
    const arbFreeData = fc.record({
      shippingName:     nonBlankString,
      shippingAddress:  nonBlankString,
      shippingCity:     nonBlankString,
      shippingPostcode: nonBlankString,
      billingSameAsShipping: fc.boolean(),
    }).map(fields => ({
      ...fields,
      plan: "free" as const,
      cardNumber: "4111111111111111", cardExpiry: "12/26", cardCvc: "123",
      billingName: "x", billingAddress: "x", billingCity: "x", billingPostcode: "x",
    }));

    await fc.assert(fc.asyncProperty(arbFreeData, async (data) => {
      const visited = await traversePath(subscriptionPath, data);
      expect(visited).not.toContain("payment");
      expect(visited).not.toContain("billing-address");
      expect(visited).toContain("review");
    }));
  });

  it("paid plan + billingSameAsShipping=false: both payment and billing-address are always visited", async () => {
    const arbPaidNonSameData = fc.record({
      shippingName:     nonBlankString,
      shippingAddress:  nonBlankString,
      shippingCity:     nonBlankString,
      shippingPostcode: nonBlankString,
      cardNumber:       nonBlankString,
      cardExpiry:       nonBlankString,
      cardCvc:          nonBlankString,
      billingName:      nonBlankString,
      billingAddress:   nonBlankString,
      billingCity:      nonBlankString,
      billingPostcode:  nonBlankString,
    }).map(fields => ({ ...fields, plan: "paid" as const, billingSameAsShipping: false }));

    await fc.assert(fc.asyncProperty(arbPaidNonSameData, async (data) => {
      const visited = await traversePath(subscriptionPath, data);
      expect(visited).toContain("payment");
      expect(visited).toContain("billing-address");
    }));
  });
});

// ---------------------------------------------------------------------------
// onboardingPath — guard consistency
// ---------------------------------------------------------------------------

describe("workflow demo — onboardingPath guard consistency", () => {
  it("about-you: canMoveNext and fieldErrors never disagree (no silent block, no unguarded proceed)", async () => {
    const step = onboardingPath.steps.find(s => s.id === "about-you")!;

    await fc.assert(fc.asyncProperty(
      fc.record({
        jobTitle:   fc.string({ maxLength: 50 }),
        experience: fc.oneof(fc.constant(""), fc.string({ minLength: 1, maxLength: 20 })),
      }),
      ({ jobTitle, experience }) => {
        const ctx = {
          data: {
            firstName: "x", lastName: "x", email: "x@x.x",
            jobTitle, experience,
            company: "", theme: "system", notifications: true,
          },
        } as any;

        const canMove  = step.canMoveNext!(ctx);
        const errors   = step.fieldErrors!(ctx);
        const hasError = !!(errors.jobTitle || errors.experience);

        // If canMoveNext and fieldErrors disagree, the wizard either shows no
        // error message when blocked, or allows proceeding despite errors.
        expect(canMove).toBe(!hasError);
      }
    ));
  });
});

// ---------------------------------------------------------------------------
// addressPath — StepChoice routing
// ---------------------------------------------------------------------------

describe("workflow demo — addressPath StepChoice routing", () => {
  const addressStep = addressPath.steps.find(s => s.id === "address")!;
  const validStepIds = addressStep.steps!.map(s => s.id);

  it("select always returns a valid child step ID for any country string", async () => {
    await fc.assert(fc.asyncProperty(
      fc.string(),
      (country) => {
        const selected = addressStep.select!({ data: { ...ADDRESS_INITIAL, country } } as any);
        expect(validStepIds).toContain(selected);
      }
    ));
  });

  it("select returns 'address-us' only for country === 'US'; everything else routes to 'address-ie'", async () => {
    await fc.assert(fc.asyncProperty(
      fc.string(),
      (country) => {
        const selected = addressStep.select!({ data: { ...ADDRESS_INITIAL, country } } as any);
        if (country === "US") {
          expect(selected).toBe("address-us");
        } else {
          expect(selected).toBe("address-ie");
        }
      }
    ));
  });
});

// ---------------------------------------------------------------------------
// skipPath (RN demo) — shouldSkip invariant
// ---------------------------------------------------------------------------

describe("workflow demo — skipPath shouldSkip", () => {
  const optionalStep = skipPath.steps.find(s => s.id === "optional")!;

  it("optional.shouldSkip ↔ skipOptional for any boolean value", async () => {
    await fc.assert(fc.asyncProperty(
      fc.boolean(),
      (skipOptional) => {
        const result = optionalStep.shouldSkip!({ data: { name: "test", skipOptional } } as any);
        expect(result).toBe(skipOptional);
      }
    ));
  });
});

// ---------------------------------------------------------------------------
// coursePath — quiz scoring
// ---------------------------------------------------------------------------

describe("workflow demo — coursePath quiz scoring", () => {
  it("getQuizScore returns a value in [0, 100] for any answer dictionary", async () => {
    await fc.assert(fc.asyncProperty(
      fc.constantFrom(...TOPIC_IDS),
      fc.dictionary(
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.string({ minLength: 1, maxLength: 10 }),
      ),
      (topicId, answers) => {
        const data = {
          ...COURSE_INITIAL,
          quizAnswers: { ...COURSE_INITIAL.quizAnswers, [topicId]: answers },
        };
        const score = getQuizScore(topicId, data);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
    ));
  });

  it("FINDING — 3-question topics: getting 2/3 correct scores 67%, which fails the >70 pass threshold", async () => {
    // All topics have exactly 3 questions. Math.round((2/3) * 100) = 67.
    // 67 is not > 70, so learners must answer all three correctly to advance.
    // There is no partial-credit route: only 100% passes.
    await fc.assert(fc.asyncProperty(
      fc.constantFrom(...TOPIC_IDS),
      fc.integer({ min: 0, max: 2 }), // 0, 1, or 2 correct answers — never all 3
      (topicId, numCorrect) => {
        const topic = TOPICS[topicId];
        const answers = Object.fromEntries(
          topic.quizQuestions.map((q, i) => [q.id, i < numCorrect ? q.correctOptionId : "wrong"])
        );
        const data = {
          ...COURSE_INITIAL,
          quizAnswers: { ...COURSE_INITIAL.quizAnswers, [topicId]: answers },
        };
        const score = getQuizScore(topicId, data);

        // At most 67 (2/3 = 66.67 → 67), never 100
        expect(score).toBeLessThanOrEqual(67);
        // And it always fails the >70 threshold
        expect(score > 70).toBe(false);
      }
    ));
  });

  it("getQuizScore === 100 iff every question is answered correctly", async () => {
    await fc.assert(fc.asyncProperty(
      fc.constantFrom(...TOPIC_IDS),
      (topicId) => {
        const topic = TOPICS[topicId];
        const allCorrect = Object.fromEntries(
          topic.quizQuestions.map(q => [q.id, q.correctOptionId])
        );
        const data = {
          ...COURSE_INITIAL,
          quizAnswers: { ...COURSE_INITIAL.quizAnswers, [topicId]: allCorrect },
        };
        expect(getQuizScore(topicId, data)).toBe(100);
      }
    ));
  });
});

// ---------------------------------------------------------------------------
// contactFormPath — field warnings
// ---------------------------------------------------------------------------

describe("workflow demo — contactFormPath field warnings", () => {
  const step = contactFormPath.steps[0];
  const validBase = { name: "Test", subject: "support", message: "x".repeat(10) };

  it("gmail typo detector fires for all four known misspellings", async () => {
    await fc.assert(fc.asyncProperty(
      fc.constantFrom("gmial", "gmali", "gmal", "gamil"),
      fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-z0-9]+$/i.test(s)),
      fc.string({ minLength: 2, maxLength: 10 }).filter(s => /^[a-z0-9]+$/i.test(s)),
      (misspelling, localPart, tld) => {
        const email = `${localPart}@${misspelling}.${tld}`;
        const warnings = step.fieldWarnings!({ data: { ...validBase, email } } as any);
        expect(warnings.email).toBeTruthy();
      }
    ));
  });

  it("gmail typo detector never fires for @gmail.com addresses", async () => {
    await fc.assert(fc.asyncProperty(
      fc.string({ minLength: 1, maxLength: 30 }).filter(s => /^[a-z0-9.+_-]+$/i.test(s)),
      (localPart) => {
        const email = `${localPart}@gmail.com`;
        const warnings = step.fieldWarnings!({ data: { ...validBase, email } } as any);
        expect(warnings.email).toBeUndefined();
      }
    ));
  });
});

// ---------------------------------------------------------------------------
// approvalWorkflowPath — approval gate
// ---------------------------------------------------------------------------

describe("workflow demo — approvalWorkflowPath approval gate", () => {
  const reviewStep = approvalWorkflowPath.steps.find(s => s.id === "approval-review")!;

  it("approval-review is blocked while any selected approver has no decision", async () => {
    const arbApprovers = fc.uniqueArray(
      fc.constantFrom("alice", "bob", "carol", "dave", "eve"),
      { minLength: 1, maxLength: 5 },
    );

    await fc.assert(fc.asyncProperty(
      arbApprovers,
      arbApprovers,
      (selectedApprovers, decidedSubset) => {
        // Build a results map from the intersection of decided ∩ selected
        const decided = decidedSubset.filter(id => selectedApprovers.includes(id));
        const results = Object.fromEntries(
          decided.map(id => [id, { decision: "approved" as const, comment: "" }])
        );
        const data = {
          title: "Doc", description: "Desc",
          approvers: selectedApprovers,
          approvalResults: results,
        };
        const errors = reviewStep.fieldErrors!({ data } as any);
        const pending = selectedApprovers.filter(id => !results[id]);

        if (pending.length > 0) {
          expect(errors._).toBeTruthy();
          expect(errors._).toContain(`${pending.length}`);
        } else {
          expect(errors._).toBeUndefined();
        }
      }
    ));
  });
});
