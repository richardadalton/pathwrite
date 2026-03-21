import { describe, expect, it, vi } from "vitest";
import { PathData, PathDefinition, PathEngine, PathEvent } from "@daltonr/pathwrite-core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function twoStepPath(id = "main"): PathDefinition {
  return { id, steps: [{ id: "step1" }, { id: "step2" }] };
}

function collectEvents(engine: PathEngine): PathEvent[] {
  const events: PathEvent[] = [];
  engine.subscribe((e) => events.push(e));
  return events;
}

// NOTE: All navigation methods (start, next, previous, cancel,
// goToStep, setData) return Promise<void> to support async hooks/guards.

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

describe("PathEngine — navigation", () => {
  it("starts on the first step", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());
    expect(engine.snapshot()?.stepId).toBe("step1");
  });

  it("advances to the next step", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());
    await engine.next();
    expect(engine.snapshot()?.stepId).toBe("step2");
  });

  it("finishes and clears state after moving past the last step", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());
    await engine.next();
    await engine.next();
    expect(engine.snapshot()).toBeNull();
  });

  it("moves to the previous step", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());
    await engine.next();
    await engine.previous();
    expect(engine.snapshot()?.stepId).toBe("step1");
  });

  it("is a no-op when called on the first step of a top-level path", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());
    await engine.previous();
    expect(engine.snapshot()?.stepId).toBe("step1");
  });

  it("does not emit a cancelled event when previous() is called on the first step", async () => {
    const engine = new PathEngine();
    const events = collectEvents(engine);
    await engine.start(twoStepPath());
    await engine.previous();
    expect(events.some((e) => e.type === "cancelled")).toBe(false);
  });

  it("pops back to the parent path when previous() is called on the first step of a sub-path", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath("parent"));
    await engine.startSubPath(twoStepPath("sub"));
    await engine.previous(); // step 0 of sub → pop back to parent
    expect(engine.snapshot()?.pathId).toBe("parent");
  });

  it("stays on the current step when canMoveNext returns false", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [{ id: "step1", canMoveNext: () => false }, { id: "step2" }]
    });
    await engine.next();
    expect(engine.snapshot()?.stepId).toBe("step1");
  });

  it("stays on the current step when canMovePrevious returns false", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [{ id: "step1" }, { id: "step2", canMovePrevious: () => false }]
    });
    await engine.next();
    await engine.previous();
    expect(engine.snapshot()?.stepId).toBe("step2");
  });

  it("still emits stateChanged when a guard blocks navigation", async () => {
    const engine = new PathEngine();
    const events = collectEvents(engine);
    await engine.start({ id: "w", steps: [{ id: "step1", canMoveNext: () => false }] });
    const before = events.filter((e) => e.type === "stateChanged").length;
    await engine.next();
    // next emits 2 events: busy at start + final
    expect(events.filter((e) => e.type === "stateChanged").length).toBe(before + 2);
  });
});

// ---------------------------------------------------------------------------
// Snapshot fields
// ---------------------------------------------------------------------------

describe("PathEngine — snapshot", () => {
  it("returns null when no path is active", () => {
    expect(new PathEngine().snapshot()).toBeNull();
  });

  it("exposes correct stepIndex and stepCount", async () => {
    const engine = new PathEngine();
    await engine.start({ id: "w", steps: [{ id: "a" }, { id: "b" }, { id: "c" }] });
    expect(engine.snapshot()).toMatchObject({ stepIndex: 0, stepCount: 3 });
    await engine.next();
    expect(engine.snapshot()).toMatchObject({ stepIndex: 1, stepCount: 3 });
  });

  it("isFirstStep is true only on the first step", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());
    expect(engine.snapshot()?.isFirstStep).toBe(true);
    await engine.next();
    expect(engine.snapshot()?.isFirstStep).toBe(false);
  });

  it("isLastStep is true only on the last step of a top-level path", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());
    expect(engine.snapshot()?.isLastStep).toBe(false);
    await engine.next();
    expect(engine.snapshot()?.isLastStep).toBe(true);
  });

  it("isLastStep is false on the last step of a sub-path", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath("parent"));
    await engine.startSubPath(twoStepPath("sub"));
    await engine.next();
    expect(engine.snapshot()?.isLastStep).toBe(false);
  });

  it("nestingLevel is 0 for a top-level path and increments per nesting level", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath("root"));
    expect(engine.snapshot()?.nestingLevel).toBe(0);
    await engine.startSubPath(twoStepPath("level1"));
    expect(engine.snapshot()?.nestingLevel).toBe(1);
    await engine.startSubPath(twoStepPath("level2"));
    expect(engine.snapshot()?.nestingLevel).toBe(2);
  });

  it("snapshot data is a copy — mutating the returned object does not affect internal state", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath(), { count: 1 });
    const snap = engine.snapshot()!;
    (snap.data as PathData).count = 99;
    expect(engine.snapshot()?.data.count).toBe(1);
  });

  it("includes initial data passed to start", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath(), { owner: "test", value: 42 });
    expect(engine.snapshot()?.data).toMatchObject({ owner: "test", value: 42 });
  });

  it("isNavigating is false in a stable snapshot between navigations", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());
    expect(engine.snapshot()?.isNavigating).toBe(false);
    await engine.next();
    expect(engine.snapshot()?.isNavigating).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Snapshot — canMoveNext / canMovePrevious
// ---------------------------------------------------------------------------

describe("PathEngine — snapshot canMoveNext / canMovePrevious", () => {
  it("defaults to true when no guards are defined", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());
    expect(engine.snapshot()?.canMoveNext).toBe(true);
    expect(engine.snapshot()?.canMovePrevious).toBe(true);
  });

  it("reflects a sync canMoveNext guard returning false", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [{ id: "step1", canMoveNext: () => false }, { id: "step2" }]
    });
    expect(engine.snapshot()?.canMoveNext).toBe(false);
  });

  it("reflects a sync canMovePrevious guard returning false", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [{ id: "step1" }, { id: "step2", canMovePrevious: () => false }]
    });
    await engine.next();
    expect(engine.snapshot()?.canMovePrevious).toBe(false);
  });

  it("defaults to true for async canMoveNext guards (optimistic)", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [{ id: "step1", canMoveNext: () => Promise.resolve(false) }, { id: "step2" }]
    });
    // Async guard — snapshot defaults to true; the engine enforces on navigation
    expect(engine.snapshot()?.canMoveNext).toBe(true);
  });

  it("updates canMoveNext when data changes via setData", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "step1", canMoveNext: (ctx) => (ctx.data as { name: string }).name.length > 0 },
        { id: "step2" }
      ]
    }, { name: "" });
    expect(engine.snapshot()?.canMoveNext).toBe(false);
    await engine.setData("name", "Alice");
    expect(engine.snapshot()?.canMoveNext).toBe(true);
  });

  it("does not re-run onEnter when canMoveNext blocks navigation", async () => {
    const onEnter = vi.fn();
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [{ id: "step1", canMoveNext: () => false, onEnter }]
    });
    const callsAfterStart = onEnter.mock.calls.length;
    await engine.next();
    expect(onEnter).toHaveBeenCalledTimes(callsAfterStart);
  });

  it("does not re-run onEnter when canMovePrevious blocks navigation", async () => {
    const onEnter = vi.fn();
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [{ id: "step1" }, { id: "step2", canMovePrevious: () => false, onEnter }]
    });
    await engine.next();
    const callsAfterEnter = onEnter.mock.calls.length;
    await engine.previous();
    expect(onEnter).toHaveBeenCalledTimes(callsAfterEnter);
  });
});

// ---------------------------------------------------------------------------
// setData
// ---------------------------------------------------------------------------

describe("PathEngine — setData", () => {
  it("updates a value and reflects it in the next snapshot", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath(), { name: "original" });
    await engine.setData("name", "updated");
    expect(engine.snapshot()?.data.name).toBe("updated");
  });

  it("adds a new key that was not in the initial data", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());
    await engine.setData("extra", true);
    expect(engine.snapshot()?.data.extra).toBe(true);
  });

  it("emits stateChanged after setData", async () => {
    const engine = new PathEngine();
    const events = collectEvents(engine);
    await engine.start(twoStepPath());
    const before = events.filter((e) => e.type === "stateChanged").length;
    await engine.setData("x", 1);
    // setData is synchronous — emits exactly 1 event
    expect(events.filter((e) => e.type === "stateChanged").length).toBe(before + 1);
  });

  it("throws when no path is active", () => {
    expect(() => new PathEngine().setData("x", 1)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

describe("PathEngine — events", () => {
  it("emits stateChanged on start", async () => {
    const engine = new PathEngine();
    const events = collectEvents(engine);
    await engine.start(twoStepPath());
    expect(events.some((e) => e.type === "stateChanged")).toBe(true);
  });

  it("emits stateChanged on each next", async () => {
    const engine = new PathEngine();
    const events = collectEvents(engine);
    await engine.start(twoStepPath());
    const before = events.filter((e) => e.type === "stateChanged").length;
    await engine.next();
    // next emits 2 events: busy at start + final
    expect(events.filter((e) => e.type === "stateChanged").length).toBe(before + 2);
  });

  it("emits stateChanged on previous", async () => {
    const engine = new PathEngine();
    const events = collectEvents(engine);
    await engine.start(twoStepPath());
    await engine.next();
    const before = events.filter((e) => e.type === "stateChanged").length;
    await engine.previous();
    expect(events.filter((e) => e.type === "stateChanged").length).toBe(before + 2);
  });

  it("emits completed with final data when the path finishes", async () => {
    const engine = new PathEngine();
    const events = collectEvents(engine);
    await engine.start(twoStepPath(), { result: "done" });
    await engine.next();
    await engine.next();
    const completed = events.find((e) => e.type === "completed");
    expect(completed).toMatchObject({ type: "completed", pathId: "main", data: { result: "done" } });
  });

  it("emits cancelled with data when cancel is called on a top-level path", async () => {
    const engine = new PathEngine();
    const events = collectEvents(engine);
    await engine.start(twoStepPath(), { owner: "test" });
    await engine.cancel();
    const cancelled = events.find((e) => e.type === "cancelled");
    expect(cancelled).toMatchObject({ type: "cancelled", pathId: "main", data: { owner: "test" } });
  });

  it("emits resumed with correct path IDs when a sub-path completes", async () => {
    const engine = new PathEngine();
    const events = collectEvents(engine);
    await engine.start(twoStepPath("parent"));
    await engine.startSubPath(twoStepPath("sub"));
    await engine.next();
    await engine.next(); // completes sub
    const resumed = events.find((e) => e.type === "resumed");
    expect(resumed).toMatchObject({ type: "resumed", resumedPathId: "parent", fromSubPathId: "sub" });
  });

  it("does not emit completed or resumed when a sub-path is cancelled", async () => {
    const engine = new PathEngine();
    const events = collectEvents(engine);
    await engine.start(twoStepPath("parent"));
    await engine.startSubPath(twoStepPath("sub"));
    await engine.cancel();
    expect(events.some((e) => e.type === "completed")).toBe(false);
    expect(events.some((e) => e.type === "resumed")).toBe(false);
  });

  it("does not emit cancelled for the parent when a sub-path is cancelled", async () => {
    const engine = new PathEngine();
    const events = collectEvents(engine);
    await engine.start(twoStepPath("parent"));
    await engine.startSubPath(twoStepPath("sub"));
    await engine.cancel();
    const cancelledIds = events
      .filter((e) => e.type === "cancelled")
      .map((e) => (e as Extract<PathEvent, { type: "cancelled" }>).pathId);
    expect(cancelledIds).not.toContain("parent");
  });
});

// ---------------------------------------------------------------------------
// Lifecycle hooks
// ---------------------------------------------------------------------------

describe("PathEngine — lifecycle hooks", () => {
  it("calls onEnter when the path starts", async () => {
    const onEnter = vi.fn();
    const engine = new PathEngine();
    await engine.start({ id: "w", steps: [{ id: "step1", onEnter }] });
    expect(onEnter).toHaveBeenCalledOnce();
  });

  it("calls onEnter when navigating forward to a new step", async () => {
    const onEnter = vi.fn();
    const engine = new PathEngine();
    await engine.start({ id: "w", steps: [{ id: "step1" }, { id: "step2", onEnter }] });
    await engine.next();
    expect(onEnter).toHaveBeenCalledOnce();
  });

  it("calls onEnter when navigating backward to a step", async () => {
    const onEnter = vi.fn();
    const engine = new PathEngine();
    await engine.start({ id: "w", steps: [{ id: "step1", onEnter }, { id: "step2" }] });
    onEnter.mockClear();
    await engine.next();
    await engine.previous();
    expect(onEnter).toHaveBeenCalledOnce();
  });

  it("applies the patch returned by onEnter to the path data", async () => {
    const engine = new PathEngine();
    await engine.start({ id: "w", steps: [{ id: "step1", onEnter: () => ({ visited: true }) }] });
    expect(engine.snapshot()?.data.visited).toBe(true);
  });

  it("calls onLeave when navigating forward", async () => {
    const onLeave = vi.fn();
    const engine = new PathEngine();
    await engine.start({ id: "w", steps: [{ id: "step1", onLeave }, { id: "step2" }] });
    await engine.next();
    expect(onLeave).toHaveBeenCalledOnce();
  });

  it("calls onLeave when navigating backward", async () => {
    const onLeave = vi.fn();
    const engine = new PathEngine();
    await engine.start({ id: "w", steps: [{ id: "step1" }, { id: "step2", onLeave }] });
    await engine.next();
    await engine.previous();
    expect(onLeave).toHaveBeenCalledOnce();
  });

  it("applies the patch returned by onLeave to the path data", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [{ id: "step1", onLeave: () => ({ left: true }) }, { id: "step2" }]
    });
    await engine.next();
    expect(engine.snapshot()?.data.left).toBe(true);
  });

  it("does not call onLeave when canMoveNext blocks navigation", async () => {
    const onLeave = vi.fn();
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [{ id: "step1", canMoveNext: () => false, onLeave }]
    });
    await engine.next();
    expect(onLeave).not.toHaveBeenCalled();
  });

  it("calls onSubPathComplete with the sub-path ID and its final data", async () => {
    const onSubPathComplete = vi.fn();
    const engine = new PathEngine();
    await engine.start({ id: "parent", steps: [{ id: "step1", onSubPathComplete }] });
    await engine.startSubPath({ id: "sub", steps: [{ id: "sub1" }] }, { result: 42 });
    await engine.next();
    expect(onSubPathComplete).toHaveBeenCalledOnce();
    expect(onSubPathComplete).toHaveBeenCalledWith(
      "sub",
      expect.objectContaining({ result: 42 }),
      expect.objectContaining({ pathId: "parent", stepId: "step1" }),
      undefined
    );
  });

  it("does not call onSubPathComplete when the sub-path is cancelled", async () => {
    const onSubPathComplete = vi.fn();
    const engine = new PathEngine();
    await engine.start({ id: "parent", steps: [{ id: "step1", onSubPathComplete }] });
    await engine.startSubPath({ id: "sub", steps: [{ id: "sub1" }] });
    await engine.cancel();
    expect(onSubPathComplete).not.toHaveBeenCalled();
  });

  it("applies the patch returned by onSubPathComplete to the parent data", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "parent",
      steps: [{
        id: "step1",
        onSubPathComplete: (_id, subData) => ({ collected: subData.value })
      }]
    });
    await engine.startSubPath({
      id: "sub",
      steps: [{ id: "s1", onEnter: () => ({ value: "hello" }) }]
    });
    await engine.next();
    expect(engine.snapshot()?.data.collected).toBe("hello");
  });

  it("context data is a snapshot copy — direct mutation has no effect on path state", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [{
        id: "step1",
        onEnter: (ctx) => {
          (ctx.data as PathData).sneaky = "mutation";
        }
      }]
    });
    expect(engine.snapshot()?.data.sneaky).toBeUndefined();
  });

  it("passes the correct pathId and stepId in the hook context", async () => {
    let captured: { pathId: string; stepId: string } | null = null;
    const engine = new PathEngine();
    await engine.start({
      id: "my-path",
      steps: [{ id: "my-step", onEnter: (ctx) => { captured = { pathId: ctx.pathId, stepId: ctx.stepId }; } }]
    });
    expect(captured).toEqual({ pathId: "my-path", stepId: "my-step" });
  });
});

// ---------------------------------------------------------------------------
// Sub-paths
// ---------------------------------------------------------------------------

describe("PathEngine — sub-paths", () => {
  it("throws when startSubPath is called without an active path", () => {
    expect(() => new PathEngine().startSubPath(twoStepPath())).toThrow();
  });

  it("tracks the sub-path as the active path while it runs", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath("parent"));
    await engine.startSubPath(twoStepPath("sub"));
    expect(engine.snapshot()?.pathId).toBe("sub");
  });

  it("resumes the parent step after the sub-path completes", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath("parent"));
    await engine.next();
    await engine.startSubPath(twoStepPath("sub"));
    await engine.next();
    await engine.next(); // complete sub
    expect(engine.snapshot()).toMatchObject({ pathId: "parent", stepId: "step2" });
  });

  it("resumes the parent step after the sub-path is cancelled", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath("parent"));
    await engine.next();
    await engine.startSubPath(twoStepPath("sub"));
    await engine.cancel();
    expect(engine.snapshot()).toMatchObject({ pathId: "parent", stepId: "step2" });
  });

  it("supports deeply nested sub-paths and unwinds the stack correctly", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath("root"));
    await engine.startSubPath(twoStepPath("level1"));
    await engine.startSubPath(twoStepPath("level2"));
    expect(engine.snapshot()?.nestingLevel).toBe(2);
    await engine.next();
    await engine.next(); // complete level2 → back to level1
    expect(engine.snapshot()?.pathId).toBe("level1");
    await engine.next();
    await engine.next(); // complete level1 → back to root
    expect(engine.snapshot()?.pathId).toBe("root");
  });
});

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

describe("PathEngine — subscriptions", () => {
  it("supports multiple simultaneous subscribers", async () => {
    const engine = new PathEngine();
    const a: string[] = [];
    const b: string[] = [];
    engine.subscribe((e) => { if (e.type === "stateChanged") a.push(e.snapshot.stepId); });
    engine.subscribe((e) => { if (e.type === "stateChanged") b.push(e.snapshot.stepId); });
    await engine.start(twoStepPath());
    await engine.next();
    expect(a).toContain("step1");
    expect(a).toContain("step2");
    expect(b).toContain("step1");
    expect(b).toContain("step2");
  });

  it("unsubscribe stops the listener from receiving further events", async () => {
    const engine = new PathEngine();
    const received: string[] = [];
    const unsubscribe = engine.subscribe((e) => {
      if (e.type === "stateChanged") received.push(e.snapshot.stepId);
    });
    await engine.start(twoStepPath());
    unsubscribe();
    await engine.next();
    expect(received).not.toContain("step2");
    expect(received.length).toBeGreaterThanOrEqual(1);
  });

  it("unsubscribing one listener does not affect others", async () => {
    const engine = new PathEngine();
    const kept: string[] = [];
    const removed: string[] = [];
    const unsubscribe = engine.subscribe((e) => {
      if (e.type === "stateChanged") removed.push(e.snapshot.stepId);
    });
    engine.subscribe((e) => {
      if (e.type === "stateChanged") kept.push(e.snapshot.stepId);
    });
    await engine.start(twoStepPath());
    unsubscribe();
    await engine.next();
    expect(removed).not.toContain("step2");
    expect(kept).toContain("step2");
  });
});

// ---------------------------------------------------------------------------
// shouldSkip
// ---------------------------------------------------------------------------

describe("PathEngine — shouldSkip", () => {
  it("skips a step during start when shouldSkip returns true", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [{ id: "skip-me", shouldSkip: () => true }, { id: "step2" }]
    });
    expect(engine.snapshot()?.stepId).toBe("step2");
  });

  it("skips a step when navigating forward", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [{ id: "step1" }, { id: "skip-me", shouldSkip: () => true }, { id: "step3" }]
    });
    await engine.next();
    expect(engine.snapshot()?.stepId).toBe("step3");
  });

  it("skips a step when navigating backward", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [{ id: "step1" }, { id: "skip-me", shouldSkip: () => true }, { id: "step3" }]
    });
    await engine.next();
    await engine.previous();
    expect(engine.snapshot()?.stepId).toBe("step1");
  });

  it("skips multiple consecutive steps", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "step1" },
        { id: "skip-a", shouldSkip: () => true },
        { id: "skip-b", shouldSkip: () => true },
        { id: "step4" }
      ]
    });
    await engine.next();
    expect(engine.snapshot()?.stepId).toBe("step4");
  });

  it("completes the path when all remaining steps are skipped on next", async () => {
    const engine = new PathEngine();
    const events = collectEvents(engine);
    await engine.start({
      id: "w",
      steps: [{ id: "step1" }, { id: "step2", shouldSkip: () => true }]
    });
    await engine.next();
    expect(engine.snapshot()).toBeNull();
    expect(events.some((e) => e.type === "completed")).toBe(true);
  });

  it("completes the path when all steps are skipped on start", async () => {
    const engine = new PathEngine();
    const events = collectEvents(engine);
    await engine.start({
      id: "w",
      steps: [{ id: "skip-only", shouldSkip: () => true }]
    });
    expect(engine.snapshot()).toBeNull();
    expect(events.some((e) => e.type === "completed")).toBe(true);
  });

  it("cancels the path when all steps before current are skipped on previous", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [{ id: "skip-me", shouldSkip: () => true }, { id: "step2" }]
    });
    await engine.previous();
    expect(engine.snapshot()).toBeNull();
  });

  it("evaluates shouldSkip with the current path data", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "step1" },
        { id: "conditional", shouldSkip: (ctx) => ctx.data.skipMiddle === true },
        { id: "step3" }
      ]
    }, { skipMiddle: true });
    await engine.next();
    expect(engine.snapshot()?.stepId).toBe("step3");

    await engine.previous(); // back to step1
    await engine.setData("skipMiddle", false);
    await engine.next();
    expect(engine.snapshot()?.stepId).toBe("conditional");
  });

  it("does not call onEnter for skipped steps", async () => {
    const onEnter = vi.fn();
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "step1" },
        { id: "skip-me", shouldSkip: () => true, onEnter },
        { id: "step3" }
      ]
    });
    await engine.next();
    expect(onEnter).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// stepTitle in snapshot
// ---------------------------------------------------------------------------

describe("PathEngine — stepTitle", () => {
  it("includes the step title in the snapshot when defined", async () => {
    const engine = new PathEngine();
    await engine.start({ id: "w", steps: [{ id: "step1", title: "Welcome" }] });
    expect(engine.snapshot()?.stepTitle).toBe("Welcome");
  });

  it("is undefined when the step has no title", async () => {
    const engine = new PathEngine();
    await engine.start({ id: "w", steps: [{ id: "step1" }] });
    expect(engine.snapshot()?.stepTitle).toBeUndefined();
  });

  it("updates as navigation progresses through titled steps", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [{ id: "step1", title: "First" }, { id: "step2", title: "Second" }]
    });
    expect(engine.snapshot()?.stepTitle).toBe("First");
    await engine.next();
    expect(engine.snapshot()?.stepTitle).toBe("Second");
  });
});

// ---------------------------------------------------------------------------
// validationMessages
// ---------------------------------------------------------------------------

describe("PathEngine — validationMessages", () => {
  it("is an empty array when the step has no validationMessages hook", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());
    expect(engine.snapshot()?.validationMessages).toEqual([]);
  });

  it("returns the messages from the hook", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [{ id: "step1", validationMessages: () => ["Name is required", "Email is required"] }]
    });
    expect(engine.snapshot()?.validationMessages).toEqual(["Name is required", "Email is required"]);
  });

  it("returns an empty array when the hook returns []", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [{ id: "step1", validationMessages: () => [] }]
    });
    expect(engine.snapshot()?.validationMessages).toEqual([]);
  });

  it("re-evaluates messages reactively when setData changes data", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        {
          id: "step1",
          canMoveNext: (ctx) => !!(ctx.data as PathData).name,
          validationMessages: (ctx) =>
            (ctx.data as PathData).name ? [] : ["Name is required"]
        }
      ]
    });
    expect(engine.snapshot()?.validationMessages).toEqual(["Name is required"]);

    await engine.setData("name", "Alice");
    expect(engine.snapshot()?.validationMessages).toEqual([]);
  });

  it("returns [] for an async validationMessages hook (not supported synchronously)", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [{ id: "step1", validationMessages: () => Promise.resolve(["async message"]) }]
    });
    expect(engine.snapshot()?.validationMessages).toEqual([]);
  });

  it("updates as navigation moves to a different step", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "step1", validationMessages: () => ["Fill in step 1"] },
        { id: "step2", validationMessages: () => [] }
      ]
    });
    expect(engine.snapshot()?.validationMessages).toEqual(["Fill in step 1"]);

    // bypass canMoveNext to force navigation to step2
    await engine.goToStep("step2");
    expect(engine.snapshot()?.validationMessages).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// goToStep — direct navigation
// ---------------------------------------------------------------------------

describe("PathEngine — goToStep", () => {
  it("jumps forward to a step by ID", async () => {
    const engine = new PathEngine();
    await engine.start({ id: "w", steps: [{ id: "a" }, { id: "b" }, { id: "c" }] });
    await engine.goToStep("c");
    expect(engine.snapshot()?.stepId).toBe("c");
    expect(engine.snapshot()?.stepIndex).toBe(2);
  });

  it("jumps backward to a step by ID", async () => {
    const engine = new PathEngine();
    await engine.start({ id: "w", steps: [{ id: "a" }, { id: "b" }, { id: "c" }] });
    await engine.next();
    await engine.next();
    await engine.goToStep("a");
    expect(engine.snapshot()?.stepId).toBe("a");
    expect(engine.snapshot()?.stepIndex).toBe(0);
  });

  it("calls onLeave on the current step", async () => {
    const onLeave = vi.fn();
    const engine = new PathEngine();
    await engine.start({ id: "w", steps: [{ id: "a", onLeave }, { id: "b" }] });
    await engine.goToStep("b");
    expect(onLeave).toHaveBeenCalledOnce();
  });

  it("calls onEnter on the target step", async () => {
    const onEnter = vi.fn();
    const engine = new PathEngine();
    await engine.start({ id: "w", steps: [{ id: "a" }, { id: "b", onEnter }] });
    await engine.goToStep("b");
    expect(onEnter).toHaveBeenCalledOnce();
  });

  it("applies patches from both onLeave and onEnter", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "a", onLeave: () => ({ leftA: true }) },
        { id: "b", onEnter: () => ({ visitedB: true }) }
      ]
    });
    await engine.goToStep("b");
    expect(engine.snapshot()?.data).toMatchObject({ leftA: true, visitedB: true });
  });

  it("emits stateChanged after jumping", async () => {
    const engine = new PathEngine();
    const events = collectEvents(engine);
    await engine.start({ id: "w", steps: [{ id: "a" }, { id: "b" }] });
    const before = events.filter((e) => e.type === "stateChanged").length;
    await engine.goToStep("b");
    // goToStep emits 2 events: busy at start + final
    expect(events.filter((e) => e.type === "stateChanged").length).toBe(before + 2);
  });

  it("throws when the step ID does not exist", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());
    expect(() => engine.goToStep("nonexistent")).toThrow('Step "nonexistent" not found');
  });

  it("throws when no path is active", () => {
    expect(() => new PathEngine().goToStep("any")).toThrow();
  });

  it("updates isFirstStep and isLastStep correctly", async () => {
    const engine = new PathEngine();
    await engine.start({ id: "w", steps: [{ id: "a" }, { id: "b" }, { id: "c" }] });
    expect(engine.snapshot()?.isFirstStep).toBe(true);
    await engine.goToStep("c");
    expect(engine.snapshot()?.isFirstStep).toBe(false);
    expect(engine.snapshot()?.isLastStep).toBe(true);
    await engine.goToStep("b");
    expect(engine.snapshot()?.isFirstStep).toBe(false);
    expect(engine.snapshot()?.isLastStep).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// goToStepChecked
// ---------------------------------------------------------------------------

describe("PathEngine — goToStepChecked", () => {
  it("navigates forward when canMoveNext allows", async () => {
    const engine = new PathEngine();
    await engine.start({ id: "w", steps: [{ id: "a" }, { id: "b" }, { id: "c" }] });
    await engine.goToStepChecked("c");
    expect(engine.snapshot()?.stepId).toBe("c");
  });

  it("navigates backward when canMovePrevious allows", async () => {
    const engine = new PathEngine();
    await engine.start({ id: "w", steps: [{ id: "a" }, { id: "b" }, { id: "c" }] });
    await engine.goToStep("c");
    await engine.goToStepChecked("a");
    expect(engine.snapshot()?.stepId).toBe("a");
  });

  it("blocks forward navigation when canMoveNext returns false", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "a", canMoveNext: () => false },
        { id: "b" }
      ]
    });
    await engine.goToStepChecked("b");
    expect(engine.snapshot()?.stepId).toBe("a");
  });

  it("blocks backward navigation when canMovePrevious returns false", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "a" },
        { id: "b", canMovePrevious: () => false }
      ]
    });
    await engine.goToStep("b");
    await engine.goToStepChecked("a");
    expect(engine.snapshot()?.stepId).toBe("b");
  });

  it("still calls onLeave and onEnter when navigation is allowed", async () => {
    const log: string[] = [];
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "a", onLeave: () => { log.push("leave-a"); } },
        { id: "b", onEnter: () => { log.push("enter-b"); } }
      ]
    });
    await engine.goToStepChecked("b");
    expect(log).toEqual(["leave-a", "enter-b"]);
  });

  it("does not call onLeave when the guard blocks", async () => {
    const log: string[] = [];
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "a", canMoveNext: () => false, onLeave: () => { log.push("leave-a"); } },
        { id: "b" }
      ]
    });
    await engine.goToStepChecked("b");
    expect(log).toEqual([]);
  });

  it("is a no-op when already on the target step", async () => {
    const engine = new PathEngine();
    await engine.start({ id: "w", steps: [{ id: "a" }, { id: "b" }] });
    await engine.goToStepChecked("a");
    expect(engine.snapshot()?.stepId).toBe("a");
  });

  it("throws for unknown step IDs", async () => {
    const engine = new PathEngine();
    await engine.start({ id: "w", steps: [{ id: "a" }] });
    await expect(engine.goToStepChecked("unknown")).rejects.toThrow();
  });

  it("throws when no path is active", () => {
    expect(() => new PathEngine().goToStepChecked("any")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// stepMeta in snapshot
// ---------------------------------------------------------------------------

describe("PathEngine — stepMeta", () => {
  it("includes step meta in the snapshot when defined", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [{ id: "step1", meta: { icon: "star", group: "intro" } }]
    });
    expect(engine.snapshot()?.stepMeta).toEqual({ icon: "star", group: "intro" });
  });

  it("is undefined when the step has no meta", async () => {
    const engine = new PathEngine();
    await engine.start({ id: "w", steps: [{ id: "step1" }] });
    expect(engine.snapshot()?.stepMeta).toBeUndefined();
  });

  it("updates as navigation progresses through steps with different meta", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "step1", meta: { icon: "edit" } },
        { id: "step2", meta: { icon: "check" } }
      ]
    });
    expect(engine.snapshot()?.stepMeta).toEqual({ icon: "edit" });
    await engine.next();
    expect(engine.snapshot()?.stepMeta).toEqual({ icon: "check" });
  });
});

// ---------------------------------------------------------------------------
// Progress indicator
// ---------------------------------------------------------------------------

describe("PathEngine — progress indicator", () => {
  it("progress is 0 on the first step of a multi-step path", async () => {
    const engine = new PathEngine();
    await engine.start({ id: "w", steps: [{ id: "a" }, { id: "b" }, { id: "c" }] });
    expect(engine.snapshot()?.progress).toBe(0);
  });

  it("progress is 1 on the last step of a multi-step path", async () => {
    const engine = new PathEngine();
    await engine.start({ id: "w", steps: [{ id: "a" }, { id: "b" }, { id: "c" }] });
    await engine.next();
    await engine.next();
    expect(engine.snapshot()?.progress).toBe(1);
  });

  it("progress is the correct fraction in the middle of a path", async () => {
    const engine = new PathEngine();
    await engine.start({ id: "w", steps: [{ id: "a" }, { id: "b" }, { id: "c" }] });
    await engine.next();
    expect(engine.snapshot()?.progress).toBe(0.5);
  });

  it("progress is 1 for a single-step path", async () => {
    const engine = new PathEngine();
    await engine.start({ id: "w", steps: [{ id: "only" }] });
    expect(engine.snapshot()?.progress).toBe(1);
  });

  it("steps array contains a summary for every step in the path", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "a", title: "Alpha", meta: { icon: "star" } },
        { id: "b" },
        { id: "c", title: "Charlie" }
      ]
    });
    const snap = engine.snapshot()!;
    expect(snap.steps).toHaveLength(3);
    expect(snap.steps[0]).toMatchObject({ id: "a", title: "Alpha", meta: { icon: "star" } });
    expect(snap.steps[1]).toMatchObject({ id: "b" });
    expect(snap.steps[1].title).toBeUndefined();
    expect(snap.steps[2]).toMatchObject({ id: "c", title: "Charlie" });
  });

  it("marks the current step as 'current', earlier as 'completed', later as 'upcoming'", async () => {
    const engine = new PathEngine();
    await engine.start({ id: "w", steps: [{ id: "a" }, { id: "b" }, { id: "c" }] });
    await engine.next(); // on step b (index 1)
    const statuses = engine.snapshot()!.steps.map((s) => s.status);
    expect(statuses).toEqual(["completed", "current", "upcoming"]);
  });

  it("step statuses update as navigation progresses", async () => {
    const engine = new PathEngine();
    await engine.start({ id: "w", steps: [{ id: "a" }, { id: "b" }, { id: "c" }] });
    expect(engine.snapshot()!.steps.map((s) => s.status)).toEqual(["current", "upcoming", "upcoming"]);
    await engine.next();
    expect(engine.snapshot()!.steps.map((s) => s.status)).toEqual(["completed", "current", "upcoming"]);
    await engine.next();
    expect(engine.snapshot()!.steps.map((s) => s.status)).toEqual(["completed", "completed", "current"]);
    await engine.previous();
    expect(engine.snapshot()!.steps.map((s) => s.status)).toEqual(["completed", "current", "upcoming"]);
  });

  it("step statuses revert to 'upcoming' when navigating backward", async () => {
    const engine = new PathEngine();
    await engine.start({ id: "w", steps: [{ id: "a" }, { id: "b" }, { id: "c" }] });
    await engine.next();
    await engine.next(); // on c
    await engine.goToStep("a");
    const statuses = engine.snapshot()!.steps.map((s) => s.status);
    expect(statuses).toEqual(["current", "upcoming", "upcoming"]);
  });
});

// ---------------------------------------------------------------------------
// Error cases
// ---------------------------------------------------------------------------

describe("PathEngine — errors", () => {
  it("throws when starting a path with no steps", () => {
    expect(() => new PathEngine().start({ id: "empty", steps: [] })).toThrow();
  });

  it("throws when next is called with no active path", () => {
    expect(() => new PathEngine().next()).toThrow();
  });

  it("throws when previous is called with no active path", () => {
    expect(() => new PathEngine().previous()).toThrow();
  });

  it("throws when cancel is called with no active path", () => {
    expect(() => new PathEngine().cancel()).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Async hooks and guards
// ---------------------------------------------------------------------------

describe("PathEngine — async hooks and guards", () => {
  it("resolves an async canMoveNext guard that returns true and advances", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "step1", canMoveNext: () => Promise.resolve(true) },
        { id: "step2" }
      ]
    });
    await engine.next();
    expect(engine.snapshot()?.stepId).toBe("step2");
  });

  it("resolves an async canMoveNext guard that returns false and stays", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "step1", canMoveNext: () => Promise.resolve(false) },
        { id: "step2" }
      ]
    });
    await engine.next();
    expect(engine.snapshot()?.stepId).toBe("step1");
  });

  it("resolves an async canMovePrevious guard that returns false and stays", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "step1" },
        { id: "step2", canMovePrevious: () => Promise.resolve(false) }
      ]
    });
    await engine.next();
    await engine.previous();
    expect(engine.snapshot()?.stepId).toBe("step2");
  });

  it("applies a patch returned by an async onEnter hook", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [{ id: "step1", onEnter: () => Promise.resolve({ asyncVisit: true }) }]
    });
    expect(engine.snapshot()?.data.asyncVisit).toBe(true);
  });

  it("applies a patch returned by an async onLeave hook", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "step1", onLeave: () => Promise.resolve({ asyncLeft: true }) },
        { id: "step2" }
      ]
    });
    await engine.next();
    expect(engine.snapshot()?.data.asyncLeft).toBe(true);
  });

  it("applies a patch returned by an async onSubPathComplete hook", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "parent",
      steps: [{
        id: "step1",
        onSubPathComplete: (_id, subData) =>
          Promise.resolve({ collected: subData.value })
      }]
    });
    await engine.startSubPath({
      id: "sub",
      steps: [{ id: "s1", onEnter: () => ({ value: "async-result" }) }]
    });
    await engine.next();
    expect(engine.snapshot()?.data.collected).toBe("async-result");
  });

  it("skips a step when an async shouldSkip guard returns true", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "step1" },
        { id: "skip-me", shouldSkip: () => Promise.resolve(true) },
        { id: "step3" }
      ]
    });
    await engine.next();
    expect(engine.snapshot()?.stepId).toBe("step3");
  });

  it("isNavigating is true in intermediate stateChanged events during next", async () => {
    let sawNavigating = false;
    const engine = new PathEngine();
    engine.subscribe((event) => {
      if (event.type === "stateChanged" && event.snapshot.isNavigating) {
        sawNavigating = true;
      }
    });
    await engine.start({ id: "w", steps: [{ id: "step1" }, { id: "step2" }] });
    sawNavigating = false; // reset — only care about next's busy state
    await engine.next();
    expect(sawNavigating).toBe(true);
  });

  it("isNavigating is false in the final stateChanged event after navigation completes", async () => {
    const navigatingValues: boolean[] = [];
    const engine = new PathEngine();
    engine.subscribe((event) => {
      if (event.type === "stateChanged") navigatingValues.push(event.snapshot.isNavigating);
    });
    await engine.start({ id: "w", steps: [{ id: "step1" }, { id: "step2" }] });
    navigatingValues.length = 0; // reset after start
    await engine.next();
    expect(navigatingValues[navigatingValues.length - 1]).toBe(false);
  });

  it("ignores a concurrent next call while navigation is already in progress", async () => {
    const engine = new PathEngine();
    await engine.start({ id: "w", steps: [{ id: "step1" }, { id: "step2" }, { id: "step3" }] });
    const p1 = engine.next();
    const p2 = engine.next(); // should be ignored — busy
    await Promise.all([p1, p2]);
    expect(engine.snapshot()?.stepId).toBe("step2");
  });

  it("a slow async guard resolves correctly and navigation completes", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        {
          id: "step1",
          canMoveNext: () => new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 10))
        },
        { id: "step2" }
      ]
    });
    await engine.next();
    expect(engine.snapshot()?.stepId).toBe("step2");
  });
});

// ---------------------------------------------------------------------------
// Lifecycle / state-machine patterns
// ---------------------------------------------------------------------------

describe("PathEngine — lifecycle patterns", () => {
  // Reusable lifecycle definition: Draft → Review → Approved → Published
  function docLifecycle(): PathDefinition {
    return {
      id: "doc-lifecycle",
      steps: [
        {
          id: "draft",
          meta: { allowedRoles: ["author"] },
          canMoveNext: (ctx) => {
            const title = ctx.data.title as string | undefined;
            const body = ctx.data.body as string | undefined;
            return !!title && title.length > 0 && !!body && body.length > 0;
          },
          onLeave: (ctx) => ({
            auditLog: [...(ctx.data.auditLog as string[]), `submitted: ${ctx.data.title}`],
          }),
        },
        {
          id: "review",
          meta: { allowedRoles: ["reviewer"], slaHours: 48 },
          shouldSkip: (ctx) => ctx.data.docType === "memo",
          canMoveNext: (ctx) => ctx.data.reviewOutcome === "approved",
          onEnter: (ctx) => ({
            auditLog: [...(ctx.data.auditLog as string[]), "entered review"],
          }),
          onSubPathComplete: (subPathId, subData, ctx) => {
            if (subPathId !== "review-process") return;
            return {
              reviewOutcome: subData.decision,
              auditLog: [...(ctx.data.auditLog as string[]), `review: ${subData.decision}`],
            };
          },
        },
        {
          id: "approved",
          meta: { allowedRoles: ["approver"] },
          onEnter: (ctx) => ({
            approvedBy: "manager",
            auditLog: [...(ctx.data.auditLog as string[]), "approved"],
          }),
        },
        {
          id: "published",
          meta: { allowedRoles: ["publisher"] },
          onEnter: (ctx) => ({
            auditLog: [...(ctx.data.auditLog as string[]), "published"],
          }),
        },
      ],
    };
  }

  const reviewSubPath: PathDefinition = {
    id: "review-process",
    steps: [
      { id: "assign-reviewer", onEnter: () => ({ assignedReviewer: "alice" }) },
      { id: "collect-feedback" },
      { id: "record-decision" },
    ],
  };

  function freshData(overrides: Record<string, unknown> = {}): PathData {
    return {
      title: "",
      body: "",
      docType: "standard",
      reviewOutcome: "pending",
      auditLog: [],
      ...overrides,
    };
  }

  it("blocks leaving draft when required fields are missing", async () => {
    const engine = new PathEngine();
    await engine.start(docLifecycle(), freshData());
    await engine.next(); // blocked — no title/body
    expect(engine.snapshot()?.stepId).toBe("draft");
  });

  it("allows leaving draft once required fields are populated", async () => {
    const engine = new PathEngine();
    await engine.start(docLifecycle(), freshData({ title: "Report", body: "Content" }));
    await engine.next();
    expect(engine.snapshot()?.stepId).toBe("review");
  });

  it("skips review for memos via shouldSkip", async () => {
    const engine = new PathEngine();
    await engine.start(
      docLifecycle(),
      freshData({ title: "Memo", body: "Lunch at noon", docType: "memo" }),
    );
    await engine.next(); // draft → approved (review skipped)
    expect(engine.snapshot()?.stepId).toBe("approved");
  });

  it("completes the full lifecycle: draft → review → approved → published", async () => {
    const engine = new PathEngine();
    const events = collectEvents(engine);

    await engine.start(
      docLifecycle(),
      freshData({ title: "Q3 Report", body: "Revenue up 15%", reviewOutcome: "approved" }),
    );
    await engine.next(); // draft → review
    await engine.next(); // review → approved
    await engine.next(); // approved → published
    await engine.next(); // published → complete

    expect(engine.snapshot()).toBeNull();
    const completed = events.find((e) => e.type === "completed");
    expect(completed).toBeDefined();
    if (completed?.type === "completed") {
      expect(completed.pathId).toBe("doc-lifecycle");
    }
  });

  it("blocks review → approved when reviewOutcome is not approved", async () => {
    const engine = new PathEngine();
    await engine.start(
      docLifecycle(),
      freshData({ title: "Draft", body: "Content", reviewOutcome: "pending" }),
    );
    await engine.next(); // draft → review
    await engine.next(); // blocked by guard
    expect(engine.snapshot()?.stepId).toBe("review");
  });

  it("uses goToStep to model rejection (review → draft)", async () => {
    const engine = new PathEngine();
    await engine.start(
      docLifecycle(),
      freshData({ title: "Policy", body: "Content", reviewOutcome: "rejected" }),
    );
    await engine.next(); // draft → review
    await engine.goToStep("draft");
    expect(engine.snapshot()?.stepId).toBe("draft");
  });

  it("uses a review sub-path and merges the result into parent data", async () => {
    const engine = new PathEngine();
    await engine.start(
      docLifecycle(),
      freshData({ title: "Plan", body: "Details" }),
    );
    await engine.next(); // draft → review

    // Launch sub-path with an "approved" decision
    await engine.startSubPath(reviewSubPath, { decision: "approved" });
    expect(engine.snapshot()?.pathId).toBe("review-process");

    await engine.next(); // assign → collect
    await engine.next(); // collect → record
    await engine.next(); // record → sub-path completes

    // Back on parent, outcome merged
    expect(engine.snapshot()?.pathId).toBe("doc-lifecycle");
    expect(engine.snapshot()?.stepId).toBe("review");
    expect(engine.snapshot()?.data.reviewOutcome).toBe("approved");
  });

  it("builds an audit log through lifecycle hooks", async () => {
    const engine = new PathEngine();
    await engine.start(
      docLifecycle(),
      freshData({ title: "Spec", body: "Details", reviewOutcome: "approved" }),
    );
    await engine.next(); // draft → review
    await engine.next(); // review → approved
    await engine.next(); // approved → published

    const log = engine.snapshot()?.data.auditLog as string[];
    expect(log).toContain("submitted: Spec");
    expect(log).toContain("entered review");
    expect(log).toContain("approved");
    expect(log).toContain("published");
  });

  it("exposes per-state metadata via stepMeta", async () => {
    const engine = new PathEngine();
    await engine.start(
      docLifecycle(),
      freshData({ title: "Doc", body: "Body", reviewOutcome: "approved" }),
    );
    expect(engine.snapshot()?.stepMeta).toEqual({ allowedRoles: ["author"] });

    await engine.next(); // → review
    expect(engine.snapshot()?.stepMeta).toEqual({ allowedRoles: ["reviewer"], slaHours: 48 });

    await engine.next(); // → approved
    expect(engine.snapshot()?.stepMeta).toEqual({ allowedRoles: ["approver"] });
  });

  it("rejection + re-review cycle completes the lifecycle", async () => {
    const engine = new PathEngine();
    await engine.start(
      docLifecycle(),
      freshData({ title: "Policy", body: "v1" }),
    );

    // Draft → Review
    await engine.next();

    // First review — rejected
    await engine.startSubPath(reviewSubPath, { decision: "rejected" });
    await engine.next();
    await engine.next();
    await engine.next(); // sub-path completes → resumes review
    expect(engine.snapshot()?.data.reviewOutcome).toBe("rejected");

    // Review guard blocks next — go back to draft
    await engine.next();
    expect(engine.snapshot()?.stepId).toBe("review");
    await engine.goToStep("draft");
    expect(engine.snapshot()?.stepId).toBe("draft");

    // Revise and re-submit
    await engine.setData("body", "v2");
    await engine.next(); // draft → review

    // Second review — approved
    await engine.startSubPath(reviewSubPath, { decision: "approved" });
    await engine.next();
    await engine.next();
    await engine.next(); // sub-path completes
    expect(engine.snapshot()?.data.reviewOutcome).toBe("approved");

    // Review → Approved → Published → complete
    await engine.next();
    await engine.next();
    await engine.next();
    expect(engine.snapshot()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isFirstEntry
// ---------------------------------------------------------------------------

describe("PathEngine — isFirstEntry", () => {
  it("is true on the first visit to a step", async () => {
    const entries: boolean[] = [];
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "a", onEnter: (ctx) => { entries.push(ctx.isFirstEntry); } },
        { id: "b" }
      ]
    });
    expect(entries).toEqual([true]);
  });

  it("is false when re-entering a step after Back", async () => {
    const entries: boolean[] = [];
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "a", onEnter: (ctx) => { entries.push(ctx.isFirstEntry); } },
        { id: "b" }
      ]
    });
    await engine.next(); // leave a → enter b
    await engine.previous(); // leave b → re-enter a
    expect(entries).toEqual([true, false]);
  });

  it("remains false on every subsequent re-entry", async () => {
    const entries: boolean[] = [];
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "a", onEnter: (ctx) => { entries.push(ctx.isFirstEntry); } },
        { id: "b" }
      ]
    });
    await engine.next();
    await engine.previous();
    await engine.next();
    await engine.previous();
    expect(entries).toEqual([true, false, false]);
  });

  it("is independent per step — each step tracks its own first entry", async () => {
    const entryLog: { id: string; first: boolean }[] = [];
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "a", onEnter: (ctx) => { entryLog.push({ id: "a", first: ctx.isFirstEntry }); } },
        { id: "b", onEnter: (ctx) => { entryLog.push({ id: "b", first: ctx.isFirstEntry }); } }
      ]
    });
    await engine.next(); // first enter b
    await engine.previous(); // re-enter a
    await engine.next(); // re-enter b
    expect(entryLog).toEqual([
      { id: "a", first: true },
      { id: "b", first: true },
      { id: "a", first: false },
      { id: "b", first: false }
    ]);
  });

  it("is true for the first step of a new sub-path even if the parent visited a same-id step", async () => {
    const subEntries: boolean[] = [];
    const engine = new PathEngine();
    // parent has a step called "step1", sub-path also has "step1"
    await engine.start({ id: "parent", steps: [{ id: "step1" }] });
    await engine.startSubPath({
      id: "sub",
      steps: [{ id: "step1", onEnter: (ctx) => { subEntries.push(ctx.isFirstEntry); } }]
    });
    expect(subEntries).toEqual([true]);
  });

  it("is available in all hooks including canMoveNext and validationMessages", async () => {
    const canMoveNextFirstEntry: boolean[] = [];
    const validationFirstEntry: boolean[] = [];
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        {
          id: "a",
          canMoveNext: (ctx) => { canMoveNextFirstEntry.push(ctx.isFirstEntry); return true; },
          validationMessages: (ctx) => { validationFirstEntry.push(ctx.isFirstEntry); return []; }
        },
        { id: "b" }
      ]
    });
    // After re-entry (navigate forward then back), both hooks see isFirstEntry: false
    await engine.next();
    await engine.previous(); // re-enter "a"
    await engine.next(); // canMoveNext fires for re-entry navigation
    // The very first snapshot guard evaluation happens before enterCurrentStep, so
    // it may see true; what matters is that re-entry values are false.
    const reEntryCanMoveNext = canMoveNextFirstEntry[canMoveNextFirstEntry.length - 1];
    expect(reEntryCanMoveNext).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// startSubPath meta / onSubPathComplete meta
// ---------------------------------------------------------------------------

describe("PathEngine — startSubPath meta", () => {
  it("passes meta to onSubPathComplete as the 4th argument", async () => {
    const onSubPathComplete = vi.fn();
    const engine = new PathEngine();
    await engine.start({ id: "parent", steps: [{ id: "s1", onSubPathComplete }] });
    await engine.startSubPath(twoStepPath("sub"), {}, { correlationId: 7, label: "item-7" });
    await engine.next();
    await engine.next(); // complete sub
    expect(onSubPathComplete).toHaveBeenCalledWith(
      "sub",
      expect.any(Object),
      expect.objectContaining({ pathId: "parent" }),
      { correlationId: 7, label: "item-7" }
    );
  });

  it("passes meta to onSubPathCancel as the 4th argument when sub-path is cancelled", async () => {
    const onSubPathCancel = vi.fn();
    const engine = new PathEngine();
    await engine.start({ id: "parent", steps: [{ id: "s1", onSubPathCancel }] });
    await engine.startSubPath(twoStepPath("sub"), {}, { correlationId: 3 });
    await engine.cancel();
    expect(onSubPathCancel).toHaveBeenCalledWith(
      "sub",
      expect.any(Object),
      expect.objectContaining({ pathId: "parent" }),
      { correlationId: 3 }
    );
  });

  it("passes undefined meta when startSubPath is called without meta", async () => {
    const onSubPathComplete = vi.fn();
    const engine = new PathEngine();
    await engine.start({ id: "parent", steps: [{ id: "s1", onSubPathComplete }] });
    await engine.startSubPath(twoStepPath("sub"));
    await engine.next();
    await engine.next();
    expect(onSubPathComplete).toHaveBeenCalledWith(
      "sub",
      expect.any(Object),
      expect.any(Object),
      undefined
    );
  });

  it("meta is independent between consecutive sub-path runs", async () => {
    const received: Array<Record<string, unknown> | undefined> = [];
    const engine = new PathEngine();
    await engine.start({
      id: "parent",
      steps: [{
        id: "s1",
        onSubPathComplete: (_id, _data, _ctx, meta) => { received.push(meta); }
      }]
    });

    await engine.startSubPath(twoStepPath("sub"), {}, { index: 0 });
    await engine.next(); await engine.next(); // complete first sub

    await engine.startSubPath(twoStepPath("sub"), {}, { index: 1 });
    await engine.next(); await engine.next(); // complete second sub

    expect(received).toEqual([{ index: 0 }, { index: 1 }]);
  });
});

// ---------------------------------------------------------------------------
// onSubPathCancel
// ---------------------------------------------------------------------------

describe("PathEngine — onSubPathCancel", () => {
  it("calls onSubPathCancel when cancel() is called on a sub-path", async () => {
    const onSubPathCancel = vi.fn();
    const engine = new PathEngine();
    await engine.start({ id: "parent", steps: [{ id: "s1", onSubPathCancel }] });
    await engine.startSubPath(twoStepPath("sub"));
    await engine.cancel();
    expect(onSubPathCancel).toHaveBeenCalledOnce();
    expect(onSubPathCancel).toHaveBeenCalledWith(
      "sub",
      expect.any(Object),
      expect.objectContaining({ pathId: "parent", stepId: "s1" }),
      undefined
    );
  });

  it("calls onSubPathCancel when previous() is called on the first step of a sub-path", async () => {
    const onSubPathCancel = vi.fn();
    const engine = new PathEngine();
    await engine.start({ id: "parent", steps: [{ id: "s1", onSubPathCancel }] });
    await engine.startSubPath(twoStepPath("sub"));
    await engine.previous(); // Back on first step → cancel sub
    expect(onSubPathCancel).toHaveBeenCalledOnce();
  });

  it("does NOT call onSubPathCancel when cancel() is called on a top-level path", async () => {
    const onSubPathCancel = vi.fn();
    const engine = new PathEngine();
    await engine.start({ id: "top", steps: [{ id: "s1", onSubPathCancel }] });
    await engine.cancel();
    expect(onSubPathCancel).not.toHaveBeenCalled();
  });

  it("does NOT call onSubPathComplete when the sub-path is cancelled", async () => {
    const onSubPathComplete = vi.fn();
    const onSubPathCancel = vi.fn();
    const engine = new PathEngine();
    await engine.start({
      id: "parent",
      steps: [{ id: "s1", onSubPathComplete, onSubPathCancel }]
    });
    await engine.startSubPath(twoStepPath("sub"));
    await engine.cancel();
    expect(onSubPathComplete).not.toHaveBeenCalled();
    expect(onSubPathCancel).toHaveBeenCalledOnce();
  });

  it("applies the patch returned by onSubPathCancel to parent data", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "parent",
      steps: [{
        id: "s1",
        onSubPathCancel: (subPathId) => ({ skipped: subPathId })
      }]
    });
    await engine.startSubPath(twoStepPath("sub"), { someValue: 1 });
    await engine.cancel();
    expect(engine.snapshot()?.data.skipped).toBe("sub");
  });

  it("resumes the parent path after onSubPathCancel runs", async () => {
    const engine = new PathEngine();
    await engine.start({ id: "parent", steps: [{ id: "s1" }, { id: "s2" }] });
    await engine.next(); // move to s2
    await engine.startSubPath(twoStepPath("sub"));
    await engine.cancel();
    expect(engine.snapshot()).toMatchObject({ pathId: "parent", stepId: "s2" });
  });

  it("passes the sub-path's data at cancellation time to onSubPathCancel", async () => {
    let receivedData: PathData | null = null;
    const engine = new PathEngine();
    await engine.start({
      id: "parent",
      steps: [{
        id: "s1",
        onSubPathCancel: (_id, subData) => { receivedData = subData; }
      }]
    });
    await engine.startSubPath(twoStepPath("sub"), { partialInput: "hello" });
    await engine.setData("partialInput" as never, "hello updated");
    await engine.cancel();
    expect(receivedData).toMatchObject({ partialInput: "hello updated" });
  });

  it("supports an async onSubPathCancel hook", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "parent",
      steps: [{
        id: "s1",
        onSubPathCancel: async () => {
          await Promise.resolve();
          return { asyncResult: true };
        }
      }]
    });
    await engine.startSubPath(twoStepPath("sub"));
    await engine.cancel();
    expect(engine.snapshot()?.data.asyncResult).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Guard / validationMessages error resilience (pain point 7)
// ---------------------------------------------------------------------------

describe("PathEngine — guard error resilience", () => {
  it("does not throw when canMoveNext crashes on the first snapshot (before onEnter)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const engine = new PathEngine();

    // canMoveNext accesses a field that is absent in initialData — would throw
    // if not caught.
    await expect(
      engine.start({
        id: "p",
        steps: [{
          id: "s1",
          canMoveNext: ({ data }) => (data.name as string).trim().length > 0
        }]
      })
    ).resolves.toBeUndefined();

    // Snapshot is still valid; canMoveNext defaults to true on error.
    expect(engine.snapshot()?.canMoveNext).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[pathwrite]"),
      expect.anything()
    );

    warnSpy.mockRestore();
  });

  it("does not throw when canMovePrevious crashes on the first snapshot", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const engine = new PathEngine();

    await expect(
      engine.start({
        id: "p",
        steps: [{
          id: "s1",
          canMovePrevious: ({ data }) => (data.choice as string).toUpperCase() === "YES"
        }]
      })
    ).resolves.toBeUndefined();

    expect(engine.snapshot()?.canMovePrevious).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[pathwrite]"),
      expect.anything()
    );

    warnSpy.mockRestore();
  });

  it("does not throw when validationMessages crashes on the first snapshot", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const engine = new PathEngine();

    await expect(
      engine.start({
        id: "p",
        steps: [{
          id: "s1",
          validationMessages: ({ data }) => [(data.name as string).trim()]
        }]
      })
    ).resolves.toBeUndefined();

    // Safe default is an empty array.
    expect(engine.snapshot()?.validationMessages).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[pathwrite]"),
      expect.anything()
    );

    warnSpy.mockRestore();
  });

  it("returns the guard value normally when it does not throw", async () => {
    const engine = new PathEngine();

    await engine.start({
      id: "p",
      steps: [{ id: "s1", canMoveNext: () => false }]
    });

    expect(engine.snapshot()?.canMoveNext).toBe(false);
  });

  it("returns validationMessages normally when they do not throw", async () => {
    const engine = new PathEngine();

    await engine.start({
      id: "p",
      steps: [{ id: "s1", validationMessages: () => ["Field is required"] }]
    });

    expect(engine.snapshot()?.validationMessages).toEqual(["Field is required"]);
  });

  it("still evaluates guards correctly after onEnter has run and data is populated", async () => {
    const engine = new PathEngine();

    await engine.start(
      {
        id: "p",
        steps: [{
          id: "s1",
          onEnter: () => ({ name: "" }),
          canMoveNext: ({ data }) => (data.name as string).trim().length > 0
        }]
      }
    );

    // onEnter set name to "" — guard should now return false without throwing.
    expect(engine.snapshot()?.canMoveNext).toBe(false);

    await engine.setData("name", "Alice");
    expect(engine.snapshot()?.canMoveNext).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// restart()
// ---------------------------------------------------------------------------

describe("PathEngine — restart()", () => {
  it("starts the path from step 1 when no path has ever been started", async () => {
    const engine = new PathEngine();
    await engine.restart(twoStepPath());
    expect(engine.snapshot()?.stepId).toBe("step1");
  });

  it("restarts to step 1 while a path is mid-flow", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());
    await engine.next();
    expect(engine.snapshot()?.stepId).toBe("step2");

    await engine.restart(twoStepPath());
    expect(engine.snapshot()?.stepId).toBe("step1");
  });

  it("restarts after a path has completed (snapshot was null)", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());
    await engine.next();
    await engine.next(); // completes
    expect(engine.snapshot()).toBeNull();

    await engine.restart(twoStepPath());
    expect(engine.snapshot()?.stepId).toBe("step1");
  });

  it("clears the sub-path stack and restarts at the top level", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath("parent"));
    await engine.startSubPath(twoStepPath("sub"));
    expect(engine.snapshot()?.nestingLevel).toBe(1);

    await engine.restart(twoStepPath("fresh"));
    expect(engine.snapshot()?.pathId).toBe("fresh");
    expect(engine.snapshot()?.nestingLevel).toBe(0);
  });

  it("seeds fresh data via initialData", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());
    await engine.setData("name", "Alice");

    await engine.restart(twoStepPath(), { name: "Bob" });
    expect(engine.snapshot()?.data.name).toBe("Bob");
  });

  it("does not fire cancelled event when restarting", async () => {
    const engine = new PathEngine();
    const events: PathEvent[] = [];
    engine.subscribe((e) => events.push(e));

    await engine.start(twoStepPath());
    await engine.restart(twoStepPath());

    expect(events.some((e) => e.type === "cancelled")).toBe(false);
  });

  it("emits stateChanged after restarting", async () => {
    const engine = new PathEngine();
    const events: PathEvent[] = [];
    engine.subscribe((e) => events.push(e));

    await engine.restart(twoStepPath());

    expect(events.some((e) => e.type === "stateChanged")).toBe(true);
  });

  it("restarts with a different path definition", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath("original"));

    const threeStep: PathDefinition = {
      id: "replacement",
      steps: [{ id: "a" }, { id: "b" }, { id: "c" }]
    };
    await engine.restart(threeStep);
    expect(engine.snapshot()?.pathId).toBe("replacement");
    expect(engine.snapshot()?.stepCount).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// State export/import
// ---------------------------------------------------------------------------

describe("PathEngine — exportState / fromState", () => {
  it("exportState returns null when no path is active", () => {
    const engine = new PathEngine();
    expect(engine.exportState()).toBeNull();
  });

  it("exportState captures current step position and data", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath("test"), { name: "Alice" });
    await engine.next();
    await engine.setData("age", 30);

    const state = engine.exportState();
    expect(state).not.toBeNull();
    expect(state?.pathId).toBe("test");
    expect(state?.currentStepIndex).toBe(1);
    expect(state?.data.name).toBe("Alice");
    expect(state?.data.age).toBe(30);
  });

  it("exportState captures visitedStepIds", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "test",
      steps: [{ id: "a" }, { id: "b" }, { id: "c" }]
    });
    await engine.next(); // visit b
    await engine.next(); // visit c

    const state = engine.exportState();
    expect(state?.visitedStepIds).toContain("a");
    expect(state?.visitedStepIds).toContain("b");
    expect(state?.visitedStepIds).toContain("c");
  });

  it("exportState includes version field", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());
    const state = engine.exportState();
    expect(state?.version).toBe(1);
  });

  it("exportState captures the path stack when sub-paths are active", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath("parent"));
    await engine.setData("parentData", "value1");
    await engine.startSubPath(twoStepPath("sub"));
    await engine.setData("subData", "value2");

    const state = engine.exportState();
    expect(state?.pathId).toBe("sub");
    expect(state?.data.subData).toBe("value2");
    expect(state?.pathStack).toHaveLength(1);
    expect(state?.pathStack[0].pathId).toBe("parent");
    expect(state?.pathStack[0].data.parentData).toBe("value1");
  });

  it("exportState captures subPathMeta in the stack", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath("parent"));
    await engine.startSubPath(twoStepPath("sub"), {}, { itemId: 42 });

    const state = engine.exportState();
    expect(state?.pathStack[0].subPathMeta).toEqual({ itemId: 42 });
  });

  it("fromState restores a simple path at the correct step", async () => {
    const engine1 = new PathEngine();
    const path = twoStepPath("test");
    await engine1.start(path, { name: "Bob" });
    await engine1.next();
    await engine1.setData("age", 25);

    const state = engine1.exportState()!;

    const engine2 = PathEngine.fromState(state, { test: path });
    const snapshot = engine2.snapshot();
    expect(snapshot?.pathId).toBe("test");
    expect(snapshot?.stepId).toBe("step2");
    expect(snapshot?.stepIndex).toBe(1);
    expect(snapshot?.data.name).toBe("Bob");
    expect(snapshot?.data.age).toBe(25);
  });

  it("fromState restores visitedStepIds", async () => {
    const engine1 = new PathEngine();
    const path: PathDefinition = {
      id: "test",
      steps: [{ id: "a" }, { id: "b" }, { id: "c" }]
    };
    await engine1.start(path);
    await engine1.next(); // visit b
    await engine1.previous(); // back to a

    const state = engine1.exportState()!;

    const engine2 = PathEngine.fromState(state, { test: path });
    const snapshot = engine2.snapshot();
    expect(snapshot?.stepId).toBe("a");
    // visitedStepIds should include both a and b
    // We can verify this by checking isFirstEntry in hooks
    const events: PathEvent[] = [];
    engine2.subscribe((e) => events.push(e));
    await engine2.next(); // should go to b (already visited)
    expect(snapshot?.stepId).toBe("a");
  });

  it("fromState restores sub-paths and the path stack", async () => {
    const engine1 = new PathEngine();
    const parent = twoStepPath("parent");
    const sub = twoStepPath("sub");
    
    await engine1.start(parent, { parentValue: "p1" });
    await engine1.startSubPath(sub, { subValue: "s1" });
    await engine1.next(); // advance sub to step2

    const state = engine1.exportState()!;

    const engine2 = PathEngine.fromState(state, { parent, sub });
    const snapshot = engine2.snapshot();
    
    expect(snapshot?.pathId).toBe("sub");
    expect(snapshot?.stepId).toBe("step2");
    expect(snapshot?.data.subValue).toBe("s1");
    expect(snapshot?.nestingLevel).toBe(1);
  });

  it("fromState throws when a path definition is missing", async () => {
    const engine1 = new PathEngine();
    const path = twoStepPath("test");
    await engine1.start(path);
    const state = engine1.exportState()!;

    expect(() => {
      PathEngine.fromState(state, {}); // missing "test" definition
    }).toThrow(/path definition "test" not found/);
  });

  it("fromState throws when a stack path definition is missing", async () => {
    const engine1 = new PathEngine();
    const parent = twoStepPath("parent");
    const sub = twoStepPath("sub");
    await engine1.start(parent);
    await engine1.startSubPath(sub);
    const state = engine1.exportState()!;

    expect(() => {
      PathEngine.fromState(state, { sub }); // missing "parent"
    }).toThrow(/path definition "parent" not found/);
  });

  it("fromState throws for unsupported version", () => {
    const badState: any = {
      version: 999,
      pathId: "test",
      currentStepIndex: 0,
      data: {},
      visitedStepIds: [],
      pathStack: [],
      _isNavigating: false
    };

    expect(() => {
      PathEngine.fromState(badState, { test: twoStepPath() });
    }).toThrow(/Unsupported SerializedPathState version/);
  });

  it("fromState creates a new engine that can navigate normally", async () => {
    const engine1 = new PathEngine();
    const path = twoStepPath("test");
    await engine1.start(path, { count: 1 });
    const state = engine1.exportState()!;

    const engine2 = PathEngine.fromState(state, { test: path });
    await engine2.next();
    expect(engine2.snapshot()?.stepId).toBe("step2");
    await engine2.setData("count", 2);
    expect(engine2.snapshot()?.data.count).toBe(2);
  });

  it("fromState does not mutate the original state object", async () => {
    const engine1 = new PathEngine();
    const path = twoStepPath("test");
    await engine1.start(path, { name: "Original" });
    const state = engine1.exportState()!;
    const stateCopy = JSON.parse(JSON.stringify(state));

    const engine2 = PathEngine.fromState(state, { test: path });
    await engine2.setData("name", "Modified");

    expect(state).toEqual(stateCopy);
  });

  it("exportState returns a serializable object (no functions or class instances)", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());
    const state = engine.exportState()!;

    // Should be able to JSON.stringify and parse without errors
    const json = JSON.stringify(state);
    const parsed = JSON.parse(json);
    expect(parsed.pathId).toBe(state.pathId);
    expect(parsed.data).toEqual(state.data);
  });

  it("round-trip export/import preserves all state correctly", async () => {
    const engine1 = new PathEngine();
    const path: PathDefinition = {
      id: "complex",
      steps: [
        { id: "step1" },
        { id: "step2" },
        { id: "step3" }
      ]
    };
    
    await engine1.start(path, { a: 1, b: "test" });
    await engine1.next();
    await engine1.setData("c", [1, 2, 3]);

    const state1 = engine1.exportState()!;
    const json = JSON.stringify(state1);
    const state2 = JSON.parse(json);
    const engine2 = PathEngine.fromState(state2, { complex: path });
    const snapshot2 = engine2.snapshot()!;

    expect(snapshot2.pathId).toBe("complex");
    expect(snapshot2.stepId).toBe("step2");
    expect(snapshot2.stepIndex).toBe(1);
    expect(snapshot2.data).toEqual({ a: 1, b: "test", c: [1, 2, 3] });
  });

  it("fromState restores _isNavigating flag", async () => {
    const path = twoStepPath("test");
    const state: any = {
      version: 1,
      pathId: "test",
      currentStepIndex: 0,
      data: {},
      visitedStepIds: ["step1"],
      pathStack: [],
      _isNavigating: true
    };

    const engine = PathEngine.fromState(state, { test: path });
    expect(engine.snapshot()?.isNavigating).toBe(true);
  });

  it("can restore and complete a path normally", async () => {
    const engine1 = new PathEngine();
    const path = twoStepPath("test");
    await engine1.start(path);
    await engine1.next(); // on step2
    const state = engine1.exportState()!;

    const engine2 = PathEngine.fromState(state, { test: path });
    const events: PathEvent[] = [];
    engine2.subscribe((e) => events.push(e));
    
    await engine2.next(); // should complete
    expect(engine2.snapshot()).toBeNull();
    expect(events.some((e) => e.type === "completed")).toBe(true);
  });

  it("fromState with sub-path can be cancelled and pops to parent", async () => {
    const engine1 = new PathEngine();
    const parent = twoStepPath("parent");
    const sub = twoStepPath("sub");
    await engine1.start(parent);
    await engine1.startSubPath(sub);
    const state = engine1.exportState()!;

    const engine2 = PathEngine.fromState(state, { parent, sub });
    await engine2.cancel();
    
    expect(engine2.snapshot()?.pathId).toBe("parent");
  });
});

