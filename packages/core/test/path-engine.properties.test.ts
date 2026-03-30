import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { PathEngine } from "@daltonr/pathwrite-core";
import type { PathDefinition } from "@daltonr/pathwrite-core";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

// "step0" … "step99" — simple pool of IDs, easy to keep unique
const arbStepId = fc.nat(99).map(n => `step${n}`);

/** 1–8 plain steps with unique IDs; no guards or hooks */
const arbPlainPath: fc.Arbitrary<PathDefinition> = fc
  .uniqueArray(arbStepId, { minLength: 1, maxLength: 8 })
  .map(ids => ({ id: "test", steps: ids.map(id => ({ id })) }));

/**
 * 2–6 steps each with a static (sync) canMoveNext guard.
 * Guards are independently randomised per step — every combination of
 * true/false across the path is possible.
 */
const arbGuardedPath: fc.Arbitrary<PathDefinition> = fc
  .uniqueArray(arbStepId, { minLength: 2, maxLength: 6 })
  .chain(ids =>
    fc.array(fc.boolean(), { minLength: ids.length, maxLength: ids.length })
      .map(guards => ({
        id: "test",
        steps: ids.map((id, i) => ({ id, canMoveNext: () => guards[i] })),
      }))
  );

/**
 * 2–8 steps where each step is independently randomly skipped (permanently).
 * At least one step is never skipped so the engine always has somewhere to land.
 */
const arbSkippablePath: fc.Arbitrary<PathDefinition> = fc
  .uniqueArray(arbStepId, { minLength: 2, maxLength: 8 })
  .chain(ids =>
    fc.array(fc.boolean(), { minLength: ids.length, maxLength: ids.length })
      .map(skips => ({
        id: "test",
        steps: ids.map((id, i) => ({
          id,
          ...(skips[i] ? { shouldSkip: () => true as boolean } : {}),
        })),
      }))
      .filter(path => path.steps.some(s => !s.shouldSkip))
  );

/** An arbitrary sequence of next / previous navigation actions */
const arbActions = fc.array(
  fc.oneof(fc.constant("next" as const), fc.constant("previous" as const)),
  { minLength: 1, maxLength: 30 }
);

// ---------------------------------------------------------------------------
// Navigation invariants
// ---------------------------------------------------------------------------

describe("PathEngine (property) — navigation invariants", () => {
  it("stepIndex is always within [0, stepCount) while path is active", async () => {
    await fc.assert(fc.asyncProperty(arbPlainPath, arbActions, async (path, actions) => {
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
    }));
  });

  it("isFirstStep ↔ stepIndex === 0", async () => {
    await fc.assert(fc.asyncProperty(arbPlainPath, arbActions, async (path, actions) => {
      const engine = new PathEngine();
      await engine.start(path);
      for (const action of actions) {
        const cur = engine.snapshot();
        if (!cur || cur.status === 'completed') break;
        action === "next" ? await engine.next() : await engine.previous();
        const snap = engine.snapshot();
        if (snap && snap.status !== 'completed') expect(snap.isFirstStep).toBe(snap.stepIndex === 0);
      }
    }));
  });

  it("isLastStep ↔ stepIndex === stepCount - 1 at the top level", async () => {
    await fc.assert(fc.asyncProperty(arbPlainPath, arbActions, async (path, actions) => {
      const engine = new PathEngine();
      await engine.start(path);
      for (const action of actions) {
        if (!engine.snapshot()) break;
        action === "next" ? await engine.next() : await engine.previous();
        const snap = engine.snapshot();
        if (snap) {
          expect(snap.isLastStep).toBe(
            snap.stepIndex === snap.stepCount - 1 && snap.nestingLevel === 0
          );
        }
      }
    }));
  });

  it("progress is always in [0, 1]", async () => {
    await fc.assert(fc.asyncProperty(arbPlainPath, arbActions, async (path, actions) => {
      const engine = new PathEngine();
      await engine.start(path);
      for (const action of actions) {
        if (!engine.snapshot()) break;
        action === "next" ? await engine.next() : await engine.previous();
        const snap = engine.snapshot();
        if (snap) {
          expect(snap.progress).toBeGreaterThanOrEqual(0);
          expect(snap.progress).toBeLessThanOrEqual(1);
        }
      }
    }));
  });

  it("progress is 0 on the first step and 1 on the last step (no guards)", async () => {
    await fc.assert(fc.asyncProperty(
      // minLength 2 avoids the degenerate 1-step case (0/0)
      fc.uniqueArray(arbStepId, { minLength: 2, maxLength: 8 })
        .map(ids => ({ id: "test", steps: ids.map(id => ({ id })) })),
      async (path) => {
        const engine = new PathEngine();
        await engine.start(path);
        expect(engine.snapshot()!.progress).toBe(0);
        for (let i = 1; i < path.steps.length; i++) await engine.next();
        expect(engine.snapshot()!.progress).toBe(1);
      }
    ));
  });

  it("snapshot.steps always has exactly one step with status 'current'", async () => {
    await fc.assert(fc.asyncProperty(arbPlainPath, arbActions, async (path, actions) => {
      const engine = new PathEngine();
      await engine.start(path);
      for (const action of actions) {
        const cur = engine.snapshot();
        if (!cur || cur.status === 'completed') break;
        action === "next" ? await engine.next() : await engine.previous();
        const snap = engine.snapshot();
        if (snap && snap.status !== 'completed') {
          expect(snap.steps.filter(s => s.status === "current")).toHaveLength(1);
        }
      }
    }));
  });

  it("in snapshot.steps, all completed steps precede current and all upcoming steps follow", async () => {
    await fc.assert(fc.asyncProperty(arbPlainPath, arbActions, async (path, actions) => {
      const engine = new PathEngine();
      await engine.start(path);
      for (const action of actions) {
        const cur = engine.snapshot();
        if (!cur || cur.status === 'completed') break;
        action === "next" ? await engine.next() : await engine.previous();
        const snap = engine.snapshot();
        if (snap && snap.status !== 'completed') {
          const curIdx = snap.steps.findIndex(s => s.status === "current");
          snap.steps.slice(0, curIdx).forEach(s => expect(s.status).toBe("completed"));
          snap.steps.slice(curIdx + 1).forEach(s => expect(s.status).toBe("upcoming"));
        }
      }
    }));
  });
});

// ---------------------------------------------------------------------------
// Guard contracts
// ---------------------------------------------------------------------------

describe("PathEngine (property) — guard contracts", () => {
  it("canMoveNext returning false always blocks forward navigation", async () => {
    await fc.assert(fc.asyncProperty(arbGuardedPath, arbActions, async (path, actions) => {
      const engine = new PathEngine();
      await engine.start(path);
      for (const action of actions) {
        const snap = engine.snapshot();
        if (!snap) break;
        if (action === "previous") { await engine.previous(); continue; }
        const { stepIndex, canMoveNext } = snap;
        await engine.next();
        const after = engine.snapshot();
        if (!canMoveNext && after !== null) {
          expect(after.stepIndex).toBe(stepIndex);
        }
      }
    }));
  });

  it("canMoveNext returning true always advances or completes the path", async () => {
    await fc.assert(fc.asyncProperty(arbGuardedPath, arbActions, async (path, actions) => {
      const engine = new PathEngine();
      await engine.start(path);
      for (const action of actions) {
        const snap = engine.snapshot();
        if (!snap || snap.status === 'completed') break;
        if (action === "previous") { await engine.previous(); continue; }
        const { stepIndex, canMoveNext } = snap;
        await engine.next();
        const after = engine.snapshot();
        if (canMoveNext && after !== null && after.status !== 'completed') {
          expect(after.stepIndex).toBeGreaterThan(stepIndex);
        }
      }
    }));
  });
});

// ---------------------------------------------------------------------------
// shouldSkip invariant
// ---------------------------------------------------------------------------

describe("PathEngine (property) — shouldSkip", () => {
  it("the active step never has shouldSkip() returning true", async () => {
    await fc.assert(fc.asyncProperty(arbSkippablePath, arbActions, async (path, actions) => {
      const engine = new PathEngine();
      await engine.start(path);
      for (const action of actions) {
        const cur = engine.snapshot();
        if (!cur || cur.status === 'completed') break;
        action === "next" ? await engine.next() : await engine.previous();
        const snap = engine.snapshot();
        if (snap && snap.status !== 'completed') {
          const def = path.steps.find(s => s.id === snap.stepId);
          if (def?.shouldSkip) {
            // shouldSkip returning true on the active step is a bug
            expect(def.shouldSkip({} as any)).toBe(false);
          }
        }
      }
    }));
  });
});

// ---------------------------------------------------------------------------
// Data contracts
// ---------------------------------------------------------------------------

describe("PathEngine (property) — data contracts", () => {
  it("setData is always reflected in the immediate next snapshot", async () => {
    await fc.assert(fc.asyncProperty(
      arbPlainPath,
      fc.string({ minLength: 1, maxLength: 20 }),
      fc.jsonValue(),
      async (path, key, value) => {
        const engine = new PathEngine();
        await engine.start(path);
        await engine.setData(key, value);
        expect(engine.snapshot()!.data[key]).toStrictEqual(value);
      }
    ));
  });

  it("mutating a returned snapshot never affects engine state", async () => {
    await fc.assert(fc.asyncProperty(
      arbPlainPath,
      fc.dictionary(
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.oneof(fc.string(), fc.integer(), fc.boolean()),
        { minKeys: 1, maxKeys: 5 }
      ),
      async (path, initialData) => {
        const engine = new PathEngine();
        await engine.start(path, initialData);
        const snap = engine.snapshot()!;
        for (const key of Object.keys(snap.data)) {
          (snap.data as Record<string, unknown>)[key] = "POISONED";
        }
        const snap2 = engine.snapshot()!;
        for (const [key, expected] of Object.entries(initialData)) {
          expect(snap2.data[key]).toStrictEqual(expected);
        }
      }
    ));
  });
});

// ---------------------------------------------------------------------------
// Restart invariant
// ---------------------------------------------------------------------------

describe("PathEngine (property) — restart", () => {
  it("restart always resets to step 0 with original initialData regardless of prior navigation", async () => {
    await fc.assert(fc.asyncProperty(
      arbPlainPath,
      arbActions,
      fc.dictionary(
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.oneof(fc.string(), fc.integer(), fc.boolean()),
        { maxKeys: 4 }
      ),
      async (path, actions, initialData) => {
        const engine = new PathEngine();
        await engine.start(path, initialData);
        for (const action of actions) {
          if (!engine.snapshot()) break;
          action === "next" ? await engine.next() : await engine.previous();
        }
        await engine.restart();
        const snap = engine.snapshot()!;
        expect(snap.stepIndex).toBe(0);
        expect(snap.pathId).toBe(path.id);
        for (const [key, value] of Object.entries(initialData)) {
          expect(snap.data[key]).toStrictEqual(value);
        }
      }
    ));
  });
});

// ---------------------------------------------------------------------------
// Sub-path nesting
// ---------------------------------------------------------------------------

describe("PathEngine (property) — sub-path nesting", () => {
  it("nestingLevel always equals the active sub-path stack depth", async () => {
    await fc.assert(fc.asyncProperty(
      fc.integer({ min: 1, max: 4 }),
      async (depth) => {
        const engine = new PathEngine();
        await engine.start({ id: "root", steps: [{ id: "r1" }, { id: "r2" }] });
        expect(engine.snapshot()!.nestingLevel).toBe(0);

        for (let i = 1; i <= depth; i++) {
          await engine.startSubPath({
            id: `sub${i}`,
            steps: [{ id: `s${i}a` }, { id: `s${i}b` }],
          });
          expect(engine.snapshot()!.nestingLevel).toBe(i);
        }

        for (let i = depth; i >= 1; i--) {
          await engine.cancel();
          const snap = engine.snapshot();
          if (snap) expect(snap.nestingLevel).toBe(i - 1);
        }
      }
    ));
  });
});
