import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { PathEngine } from "@daltonr/pathwrite-core";
import type { PathDefinition, PathSnapshot, SerializedPathState } from "@daltonr/pathwrite-core";

/**
 * Serialization invariants.
 *
 * Restore is the only place in the engine where a defect costs the user work
 * rather than patience, and it has produced several: a restored engine that
 * could not restart, a mid-flight status that made every navigation a silent
 * no-op, an export missing the attempted/skipped/validated state. There were 86
 * example-based assertions about export/restore and no generated ones.
 *
 * Two properties. The first says a round trip changes nothing the user can see.
 * The second says no input at all — including a hand-edited or truncated record
 * — can produce an engine that is stuck.
 */

const arbStepId = fc.nat(20).map((n) => `s${n}`);

/** Paths with a mix of plain steps, skips and guards, plus an optional choice. */
const arbPath: fc.Arbitrary<PathDefinition> = fc
  .uniqueArray(arbStepId, { minLength: 2, maxLength: 6 })
  .chain((ids) =>
    fc
      .array(fc.constantFrom("plain", "skip", "guard"), {
        minLength: ids.length,
        maxLength: ids.length,
      })
      .map((kinds) => ({
        id: "root",
        steps: ids.map((id, i) => {
          if (kinds[i] === "skip" && i > 0) return { id, shouldSkip: () => true as boolean };
          if (kinds[i] === "guard")
            return { id, canMoveNext: ({ data }: { data: PathData }) => data.ok === true };
          return { id };
        }),
      }))
  )
  // keep at least one reachable, non-skipped step
  .filter((p) => p.steps.some((s) => !("shouldSkip" in s)));

type PathData = Record<string, unknown>;

/**
 * A sub-path, so the generated states include a non-empty `pathStack`. Without
 * it the round trip only ever covered nestingLevel 0, which is the simple half
 * of the format; the stack is where restore has actually gone wrong before.
 */
const subPath: PathDefinition = { id: "sub", steps: [{ id: "x" }, { id: "y" }] };

/** A step whose first leave throws, so `status: "error"` states are covered too. */
const boomPath: PathDefinition = {
  id: "boom",
  steps: [
    {
      id: "b1",
      onLeave: () => {
        throw new Error("leave failed");
      },
    },
    { id: "b2" },
  ],
};

const arbActions = fc.array(
  fc.constantFrom(
    "next" as const,
    "previous" as const,
    "setOk" as const,
    "attempt" as const,
    "startSub" as const,
    "cancel" as const
  ),
  { minLength: 0, maxLength: 14 }
);

const allDefs = (path: PathDefinition) => ({ [path.id]: path, sub: subPath, boom: boomPath });

/** Applies one generated action, ignoring the ones that are no-ops in context. */
async function apply(engine: PathEngine, action: string) {
  if (action === "next" || action === "attempt") await settle(() => engine.next());
  else if (action === "previous") await settle(() => engine.previous());
  else if (action === "setOk") await settle(() => engine.setData("ok", true));
  else if (action === "startSub") await settle(() => engine.startSubPath(subPath));
  else if (action === "cancel") await settle(() => engine.cancel());
}

const settle = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
  } catch {
    /* a rejecting navigation is a legitimate outcome */
  }
};

/**
 * The parts of a snapshot a restored engine must reproduce. Timestamps are
 * excluded deliberately: `stepEnteredAt` is wall-clock and is allowed to differ.
 */
function observable(s: PathSnapshot | null) {
  if (!s) return null;
  return {
    pathId: s.pathId,
    stepId: s.stepId,
    stepIndex: s.stepIndex,
    stepCount: s.stepCount,
    progress: s.progress,
    isFirstStep: s.isFirstStep,
    isLastStep: s.isLastStep,
    nestingLevel: s.nestingLevel,
    status: s.status,
    canMoveNext: s.canMoveNext,
    canMovePrevious: s.canMovePrevious,
    hasValidated: s.hasValidated,
    hasAttemptedNext: s.hasAttemptedNext,
    blockingError: s.blockingError,
    data: s.data,
    steps: s.steps.map((x) => ({ id: x.id, status: x.status })),
  };
}

describe("invariant: a round trip through serialization changes nothing observable", () => {
  it("fromState(exportState()) reproduces the snapshot, for any path and navigation", async () => {
    await fc.assert(
      fc.asyncProperty(arbPath, arbActions, async (path, actions) => {
        const engine = new PathEngine();
        await engine.start(path, {});

        for (const action of actions) await apply(engine, action);

        const state = engine.exportState();
        if (!state) return; // path dismissed after completion; nothing to restore

        const restored = PathEngine.fromState(state, allDefs(path));
        expect(observable(restored.snapshot())).toEqual(observable(engine.snapshot()));
      }),
      { numRuns: 100 }
    );
  });

  it("a restored engine can still be restarted", async () => {
    // restart() on a restored engine used to throw "engine has not been
    // started", which broke every "Start over" button in a resumed session.
    await fc.assert(
      fc.asyncProperty(arbPath, arbActions, async (path, actions) => {
        const engine = new PathEngine();
        await engine.start(path, { seeded: 1 });
        for (const a of actions) await apply(engine, a);

        const state = engine.exportState();
        if (!state) return;

        const restored = PathEngine.fromState(state, allDefs(path));
        await settle(() => restored.restart());

        const snap = restored.snapshot();
        expect(snap).not.toBeNull();
        expect(snap!.status).not.toBe("error");
        expect(snap!.data.seeded).toBe(1);
      }),
      { numRuns: 50 }
    );
  });

  it("an error state restores as idle and navigable, not as a wedged engine", async () => {
    // Deliberate asymmetry, and the reason the round-trip property above only
    // ever sees idle/completed: a retry closure cannot be serialized, and a
    // persisted busy status made every navigation method a silent no-op. So
    // `fromState` normalises anything mid-flight — including "error" — to idle.
    // Pinned here so the normalisation is a decision rather than an accident.
    const engine = new PathEngine();
    await engine.start(boomPath, {});
    await settle(() => engine.next());
    expect(engine.snapshot()?.status).toBe("error");

    const state = engine.exportState();
    expect(state).not.toBeNull();

    const restored = PathEngine.fromState(state!, { boom: boomPath });
    expect(restored.snapshot()?.status).toBe("idle");
    expect(restored.snapshot()?.error).toBeNull();

    await settle(() => restored.next());
    expect(restored.snapshot()).not.toBeNull();
  });

  it("a round trip is stable: exporting a restored engine gives the same state again", async () => {
    await fc.assert(
      fc.asyncProperty(arbPath, arbActions, async (path, actions) => {
        const engine = new PathEngine();
        await engine.start(path, {});
        for (const a of actions) await apply(engine, a);

        const first = engine.exportState();
        if (!first) return;
        const restored = PathEngine.fromState(first, allDefs(path));
        const second = restored.exportState();

        // stepEnteredAt is wall-clock; everything else must survive unchanged.
        const strip = (s: SerializedPathState | null) => (s ? { ...s, stepEnteredAt: undefined } : null);
        expect(strip(second)).toEqual(strip(first));
      }),
      { numRuns: 50 }
    );
  });
});

describe("invariant: no stored record can produce a stuck engine", () => {
  /** Arbitrary junk in the shape of a record, including hand-edited nonsense. */
  const arbCorrupt = fc.record(
    {
      version: fc.constantFrom(1, 0, 2, 99),
      pathId: fc.constantFrom("root", "renamed", ""),
      currentStepIndex: fc.integer({ min: -5, max: 50 }),
      data: fc.oneof(
        fc.constant({}),
        fc.dictionary(fc.string(), fc.anything()),
        fc.constant(null as unknown as PathData)
      ),
      visitedStepIds: fc.oneof(fc.array(fc.string()), fc.constant(undefined as unknown as string[])),
      pathStack: fc.oneof(
        fc.constant([]),
        fc.constant(undefined as unknown as []),
        fc.constant([{ pathId: "nope", currentStepIndex: 3, data: {}, visitedStepIds: [] }])
      ),
      _status: fc.constantFrom(
        "idle",
        "entering",
        "validating",
        "leaving",
        "completing",
        "completed",
        "error",
        "nonsense"
      ),
    },
    { requiredKeys: ["version", "pathId", "currentStepIndex"] }
  );

  it("fromState either rejects the record or returns an engine that works", async () => {
    const path: PathDefinition = { id: "root", steps: [{ id: "a" }, { id: "b" }, { id: "c" }] };

    await fc.assert(
      fc.asyncProperty(arbCorrupt, async (raw) => {
        let engine: PathEngine;
        try {
          engine = PathEngine.fromState(raw as unknown as SerializedPathState, { root: path });
        } catch (err) {
          // Rejecting junk is a valid outcome; it must say why.
          expect(err).toBeInstanceOf(Error);
          expect(String((err as Error).message).length).toBeGreaterThan(0);
          return;
        }

        // If it accepted the record, the engine must be usable rather than wedged.
        expect(() => engine.snapshot()).not.toThrow();

        const snap = engine.snapshot();
        if (snap) {
          // A restored engine must never sit in a transient status: every
          // navigation method drops calls unless the status is idle, so a
          // persisted "entering" would make the whole engine inert.
          expect(["idle", "completed", "error"]).toContain(snap.status);
          expect(snap.stepIndex).toBeGreaterThanOrEqual(0);
          expect(snap.stepIndex).toBeLessThan(Math.max(snap.stepCount, 1));
        }

        // And it must still respond to navigation.
        await settle(() => engine.next());
        expect(() => engine.snapshot()).not.toThrow();
        await settle(() => engine.restart());
        expect(engine.snapshot()).not.toBeNull();
      }),
      { numRuns: 200 }
    );
  });
});
