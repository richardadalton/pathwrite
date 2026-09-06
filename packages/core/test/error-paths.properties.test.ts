import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { PathEngine } from "@daltonr/pathwrite-core";
import type { PathDefinition, PathEvent } from "@daltonr/pathwrite-core";

/**
 * Invariants for the engine's *failure* paths.
 *
 * The existing property suites model successful navigation: index bounds,
 * progress, step statuses, immutability, nesting depth. Every bug found in the
 * September 2026 review lived somewhere those suites do not go — a hook that
 * throws, a selector that returns garbage, an error that is cleared without an
 * event. Half of those bugs were introduced by the previous round of fixes,
 * because each fix was tested against the finding it addressed rather than
 * against the guarantees it touched.
 *
 * These assert the guarantees. They are deliberately written to constrain any
 * future fix, not to describe the current implementation.
 */

const arbStepId = fc.nat(99).map((n) => `step${n}`);

/** 2–6 plain steps with unique ids. */
const arbPath: fc.Arbitrary<PathDefinition> = fc
  .uniqueArray(arbStepId, { minLength: 2, maxLength: 6 })
  .map((ids) => ({ id: "test", steps: ids.map((id) => ({ id })) }));

/** Drives an engine through a settled navigation, ignoring rejections. */
const settle = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
  } catch {
    /* a rejecting navigation is a legitimate outcome; the invariant is about state */
  }
};

describe("invariant: a snapshot is always obtainable", () => {
  // snapshot() is called by every adapter on every render. If it can throw, a
  // data-driven failure takes the host application's UI down with it.
  it("snapshot() never throws, whatever a StepChoice selector does", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant("throw" as const),
          fc.constant("unknown" as const),
          fc.constant("empty" as const)
        ),
        async (mode) => {
          const path: PathDefinition = {
            id: "p",
            steps: [
              {
                id: "choice",
                select: () => {
                  if (mode === "throw") throw new Error("boom");
                  if (mode === "unknown") return "not-a-real-step";
                  return "";
                },
                steps: [{ id: "inner" }],
              },
            ],
          };
          const engine = new PathEngine();
          await settle(() => engine.start(path, {}));

          expect(() => engine.snapshot()).not.toThrow();
          await settle(() => engine.setData("x", 1));
          expect(() => engine.snapshot()).not.toThrow();
        }
      ),
      { numRuns: 30 }
    );
  });

  it("an engine is still usable after a failed start: restart() recovers it", async () => {
    const bad: PathDefinition = {
      id: "p",
      steps: [{ id: "choice", select: () => "nope", steps: [{ id: "inner" }] }],
    };
    const engine = new PathEngine();
    await settle(() => engine.start(bad, {}));

    await settle(() => engine.restart());
    expect(() => engine.snapshot()).not.toThrow();
  });
});

describe("invariant: error state is never lost silently", () => {
  // A shell renders "Try again" from snapshot.error and calls retry(). If the
  // error can be cleared without an event, the button stays on screen and does
  // nothing: the user is stuck with no way to recover.
  it("clearing an error always emits, so subscribers can re-render", async () => {
    // The error is raised while still on the FIRST step, so that previous()
    // takes its documented no-op branch. That is the branch where the error is
    // cleared by an operation which then does nothing else.
    const path: PathDefinition = {
      id: "p",
      steps: [
        {
          id: "a",
          onLeave: () => {
            throw new Error("leave failed");
          },
        },
        { id: "b" },
      ],
    };
    const engine = new PathEngine();
    await engine.start(path, {});
    await settle(() => engine.next());

    // Precondition, asserted rather than skipped: a test that never reaches the
    // interesting state must fail, not pass.
    expect(engine.snapshot()?.status).toBe("error");
    expect(engine.snapshot()?.stepIndex).toBe(0);

    const events: PathEvent[] = [];
    const off = engine.subscribe((e) => events.push(e));
    await settle(() => engine.previous());
    off();

    const cleared = engine.snapshot()?.error == null;
    expect(cleared && events.length === 0).toBe(false);
  });

  it("a no-op previous() leaves the pending retry intact and usable", async () => {
    // The failure happens on the FIRST step, so previous() takes its no-op
    // branch. Navigating back off a later step is allowed to clear the error:
    // the user moved somewhere, which is a real recovery. Doing nothing is not.
    let attempts = 0;
    const path: PathDefinition = {
      id: "p",
      steps: [
        {
          id: "a",
          onLeave: () => {
            attempts++;
            if (attempts === 1) throw new Error("leave failed");
          },
        },
        { id: "b" },
      ],
    };
    const engine = new PathEngine();
    await engine.start(path, {});
    await settle(() => engine.next());

    expect(engine.snapshot()?.status).toBe("error");
    expect(engine.snapshot()?.stepIndex).toBe(0);

    await settle(() => engine.previous()); // documented no-op
    expect(engine.snapshot()?.status, "previous() consumed the error while navigating nowhere").toBe("error");

    // The retry the shell was offering still works, and re-runs the failed
    // phase rather than starting from scratch.
    await settle(() => engine.retry());
    expect(engine.snapshot()?.stepId).toBe("b");
    expect(engine.snapshot()?.error).toBeNull();
  });
});

describe("invariant: blockingError describes the current step only", () => {
  // Shells render blockingError between the step body and the nav buttons. A
  // value that outlives the step that produced it is a phantom error on a
  // screen the user has already left.
  it("a completed path never reports a blockingError", async () => {
    await fc.assert(
      fc.asyncProperty(arbPath, async (path) => {
        const steps = path.steps.map((s, i) =>
          i === path.steps.length - 1
            ? {
                ...s,
                canMoveNext: ({ data }: { data: Record<string, unknown> }) => ({
                  allowed: data.ok === true,
                  reason: "not ready",
                }),
              }
            : s
        );
        const engine = new PathEngine();
        await settle(() => engine.start({ ...path, steps }, {}));
        for (let i = 0; i < steps.length - 1; i++) await settle(() => engine.next());

        await settle(() => engine.next()); // blocked, sets blockingError
        await settle(() => engine.setData("ok", true));
        await settle(() => engine.next()); // now completes

        const snap = engine.snapshot();
        if (snap?.status !== "completed") return;
        expect(snap.blockingError).toBeNull();
      }),
      { numRuns: 25 }
    );
  });

  it("a parent path never inherits a blockingError raised inside a sub-path", async () => {
    const sub: PathDefinition = {
      id: "sub",
      steps: [{ id: "s1", canMoveNext: () => ({ allowed: false, reason: "sub blocked" }) }],
    };
    const parent: PathDefinition = { id: "parent", steps: [{ id: "p1" }, { id: "p2" }] };

    const engine = new PathEngine();
    await engine.start(parent, {});
    await engine.startSubPath(sub);
    await settle(() => engine.next()); // blocked inside the sub-path

    // Preconditions asserted: we really are in the sub-path and really blocked.
    expect(engine.snapshot()?.pathId).toBe("sub");
    expect(engine.snapshot()?.blockingError).toBe("sub blocked");

    await engine.cancel(); // pops back to the parent

    const snap = engine.snapshot();
    expect(snap?.pathId).toBe("parent");
    expect(snap?.blockingError).toBeNull();
  });
});
