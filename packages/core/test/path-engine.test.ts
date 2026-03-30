import { describe, expect, it, vi } from "vitest";
import { PathData, PathDefinition, PathEngine, PathEvent, StepChoice, matchesStrategy } from "@daltonr/pathwrite-core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function twoStepPath(id = "main"): PathDefinition {
  return { id, steps: [{ id: "step1" }, { id: "step2" }] };
}

function threeStepPath(id = "main"): PathDefinition {
  return { id, steps: [{ id: "step1" }, { id: "step2" }, { id: "step3" }] };
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
      steps: [{ id: "step1", canMoveNext: () => ({ allowed: false }) }, { id: "step2" }]
    });
    await engine.next();
    expect(engine.snapshot()?.stepId).toBe("step1");
  });

  it("stays on the current step when canMovePrevious returns false", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [{ id: "step1" }, { id: "step2", canMovePrevious: () => ({ allowed: false }) }]
    });
    await engine.next();
    await engine.previous();
    expect(engine.snapshot()?.stepId).toBe("step2");
  });

  it("still emits stateChanged when a guard blocks navigation", async () => {
    const engine = new PathEngine();
    const events = collectEvents(engine);
    await engine.start({ id: "w", steps: [{ id: "step1", canMoveNext: () => ({ allowed: false }) }] });
    const before = events.filter((e) => e.type === "stateChanged").length;
    await engine.next();
    // next emits 2 events: busy at start + final
    expect(events.filter((e) => e.type === "stateChanged").length).toBe(before + 2);
  });

  it("sets blockingError when canMoveNext returns { allowed: false, reason }", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "step1", canMoveNext: () => ({ allowed: false, reason: "Not eligible." }) },
        { id: "step2" }
      ]
    });
    expect(engine.snapshot()?.blockingError).toBeNull();
    await engine.next();
    expect(engine.snapshot()?.stepId).toBe("step1");
    expect(engine.snapshot()?.blockingError).toBe("Not eligible.");
  });

  it("clears blockingError when navigating to a new step", async () => {
    let block = true;
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "step1", canMoveNext: () => block ? ({ allowed: false, reason: "Not yet." }) : true },
        { id: "step2" }
      ]
    });
    await engine.next();
    expect(engine.snapshot()?.blockingError).toBe("Not yet.");
    block = false;
    await engine.next();
    expect(engine.snapshot()?.stepId).toBe("step2");
    expect(engine.snapshot()?.blockingError).toBeNull();
  });

  it("sets no blockingError when canMoveNext returns { allowed: false } without reason", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "step1", canMoveNext: () => ({ allowed: false }) },
        { id: "step2" }
      ]
    });
    await engine.next();
    expect(engine.snapshot()?.blockingError).toBeNull();
  });

  it("sets blockingError from async canMoveNext returning { allowed: false, reason }", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "step1", canMoveNext: async () => ({ allowed: false, reason: "Async blocked." }) },
        { id: "step2" }
      ]
    });
    await engine.next();
    expect(engine.snapshot()?.blockingError).toBe("Async blocked.");
  });

  it("clears blockingError on restart()", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "step1", canMoveNext: () => ({ allowed: false, reason: "Blocked." }) },
        { id: "step2" }
      ]
    });
    await engine.next();
    expect(engine.snapshot()?.blockingError).toBe("Blocked.");
    await engine.restart();
    expect(engine.snapshot()?.blockingError).toBeNull();
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

  it("status is 'idle' in a stable snapshot between navigations", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());
    expect(engine.snapshot()?.status).toBe("idle");
    await engine.next();
    expect(engine.snapshot()?.status).toBe("idle");
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
      steps: [{ id: "step1", canMoveNext: () => ({ allowed: false }) }, { id: "step2" }]
    });
    expect(engine.snapshot()?.canMoveNext).toBe(false);
  });

  it("reflects a sync canMovePrevious guard returning false", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [{ id: "step1" }, { id: "step2", canMovePrevious: () => ({ allowed: false }) }]
    });
    await engine.next();
    expect(engine.snapshot()?.canMovePrevious).toBe(false);
  });

  it("defaults to true for async canMoveNext guards (optimistic)", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [{ id: "step1", canMoveNext: () => Promise.resolve({ allowed: false }) }, { id: "step2" }]
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
      steps: [{ id: "step1", canMoveNext: () => ({ allowed: false }), onEnter }]
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
      steps: [{ id: "step1" }, { id: "step2", canMovePrevious: () => ({ allowed: false }), onEnter }]
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
    // next emits multiple phase-transition events (validating, leaving, idle + any onEnter)
    expect(events.filter((e) => e.type === "stateChanged").length).toBeGreaterThan(before);
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
// StateChangeCause — cause field on stateChanged events
// ---------------------------------------------------------------------------

describe("PathEngine — stateChanged cause field", () => {
  function stateChangedCauses(events: PathEvent[]): string[] {
    return events
      .filter((e) => e.type === "stateChanged")
      .map((e) => (e as Extract<PathEvent, { type: "stateChanged" }>).cause);
  }

  it("start() emits stateChanged events with cause 'start'", async () => {
    const engine = new PathEngine();
    const events = collectEvents(engine);
    await engine.start(twoStepPath());
    const causes = stateChangedCauses(events);
    expect(causes.length).toBeGreaterThan(0);
    expect(causes.every((c) => c === "start")).toBe(true);
  });

  it("next() emits stateChanged events with cause 'next'", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());
    const events = collectEvents(engine);
    await engine.next();
    const causes = stateChangedCauses(events);
    expect(causes.length).toBeGreaterThan(0);
    expect(causes.every((c) => c === "next")).toBe(true);
  });

  it("previous() emits stateChanged events with cause 'previous'", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());
    await engine.next();
    const events = collectEvents(engine);
    await engine.previous();
    const causes = stateChangedCauses(events);
    expect(causes.length).toBeGreaterThan(0);
    expect(causes.every((c) => c === "previous")).toBe(true);
  });

  it("setData() emits stateChanged with cause 'setData'", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath(), { name: "a" });
    const events = collectEvents(engine);
    await engine.setData("name", "b");
    const causes = stateChangedCauses(events);
    expect(causes).toEqual(["setData"]);
  });

  it("cancel() emits stateChanged events with cause 'cancel'", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath("parent"));
    await engine.startSubPath(twoStepPath("sub"));
    const events = collectEvents(engine);
    await engine.cancel();
    const causes = stateChangedCauses(events);
    expect(causes.length).toBeGreaterThan(0);
    expect(causes.every((c) => c === "cancel")).toBe(true);
  });

  it("goToStep() emits stateChanged events with cause 'goToStep'", async () => {
    const engine = new PathEngine();
    await engine.start({ id: "w", steps: [{ id: "a" }, { id: "b" }, { id: "c" }] });
    const events = collectEvents(engine);
    await engine.goToStep("c");
    const causes = stateChangedCauses(events);
    expect(causes.length).toBeGreaterThan(0);
    expect(causes.every((c) => c === "goToStep")).toBe(true);
  });

  it("goToStepChecked() emits stateChanged events with cause 'goToStepChecked'", async () => {
    const engine = new PathEngine();
    await engine.start({ id: "w", steps: [{ id: "a" }, { id: "b" }, { id: "c" }] });
    const events = collectEvents(engine);
    await engine.goToStepChecked("c");
    const causes = stateChangedCauses(events);
    expect(causes.length).toBeGreaterThan(0);
    expect(causes.every((c) => c === "goToStepChecked")).toBe(true);
  });

  it("restart() emits stateChanged events with cause 'start'", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());
    await engine.next();
    const events = collectEvents(engine);
    await engine.restart();
    const causes = stateChangedCauses(events);
    expect(causes.length).toBeGreaterThan(0);
    expect(causes.every((c) => c === "start")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Snapshot fields
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
      steps: [{ id: "step1", canMoveNext: () => ({ allowed: false }), onLeave }]
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

  it("rootProgress is undefined at the top level", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath("root"));
    expect(engine.snapshot()?.rootProgress).toBeUndefined();
  });

  it("rootProgress reflects the root path when a sub-path is active", async () => {
    const engine = new PathEngine();
    const root: PathDefinition = {
      id: "root",
      steps: [
        { id: "a", title: "Alpha" },
        { id: "b", title: "Beta" },
        { id: "c", title: "Gamma" }
      ]
    };
    await engine.start(root);
    await engine.next(); // advance root to step b
    await engine.startSubPath(twoStepPath("sub"));

    const snap = engine.snapshot()!;
    expect(snap.nestingLevel).toBe(1);
    expect(snap.rootProgress).toBeDefined();
    expect(snap.rootProgress!.pathId).toBe("root");
    expect(snap.rootProgress!.stepIndex).toBe(1);
    expect(snap.rootProgress!.stepCount).toBe(3);
    expect(snap.rootProgress!.progress).toBeCloseTo(0.5);
    expect(snap.rootProgress!.steps).toHaveLength(3);
    expect(snap.rootProgress!.steps[0]).toMatchObject({ id: "a", status: "completed" });
    expect(snap.rootProgress!.steps[1]).toMatchObject({ id: "b", status: "current" });
    expect(snap.rootProgress!.steps[2]).toMatchObject({ id: "c", status: "upcoming" });
  });

  it("rootProgress always shows the root path, even when deeply nested", async () => {
    const engine = new PathEngine();
    const root: PathDefinition = {
      id: "root",
      steps: [{ id: "r1", title: "Root 1" }, { id: "r2", title: "Root 2" }]
    };
    await engine.start(root);
    await engine.startSubPath(twoStepPath("level1"));
    await engine.startSubPath(twoStepPath("level2"));

    const snap = engine.snapshot()!;
    expect(snap.nestingLevel).toBe(2);
    expect(snap.rootProgress!.pathId).toBe("root");
    expect(snap.rootProgress!.stepIndex).toBe(0);
  });

  it("rootProgress disappears after returning to the root path", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath("root"));
    await engine.startSubPath(twoStepPath("sub"));
    expect(engine.snapshot()?.rootProgress).toBeDefined();
    await engine.cancel(); // pop back to root
    expect(engine.snapshot()?.rootProgress).toBeUndefined();
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

describe("PathEngine — fieldErrors", () => {
  it("is an empty object when the step has no fieldErrors hook", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());
    expect(engine.snapshot()?.fieldErrors).toEqual({});
  });

  it("returns the messages from the hook", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [{ id: "step1", fieldErrors: () => ({ name: "Required", email: "Required" }) }]
    });
    expect(engine.snapshot()?.fieldErrors).toEqual({ name: "Required", email: "Required" });
  });

  it("returns an empty object when the hook returns no defined messages", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [{ id: "step1", fieldErrors: () => ({}) }]
    });
    expect(engine.snapshot()?.fieldErrors).toEqual({});
  });

  it("strips undefined values from the hook result", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [{ id: "step1", fieldErrors: () => ({ name: "Required", email: undefined }) }]
    });
    expect(engine.snapshot()?.fieldErrors).toEqual({ name: "Required" });
  });

  it("re-evaluates messages reactively when setData changes data", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        {
          id: "step1",
          fieldErrors: (ctx) => ({
            name: (ctx.data as PathData).name ? undefined : "Required"
          })
        }
      ]
    });
    expect(engine.snapshot()?.fieldErrors).toEqual({ name: "Required" });

    await engine.setData("name", "Alice");
    expect(engine.snapshot()?.fieldErrors).toEqual({});
  });

  it("auto-derives canMoveNext as false when fieldErrors has entries", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [{ id: "step1", fieldErrors: () => ({ name: "Required" }) }]
    });
    expect(engine.snapshot()?.canMoveNext).toBe(false);
  });

  it("auto-derives canMoveNext as true when fieldErrors returns no entries", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [{ id: "step1", fieldErrors: () => ({}) }]
    });
    expect(engine.snapshot()?.canMoveNext).toBe(true);
  });

  it("auto-derived canMoveNext blocks next() navigation", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "step1", fieldErrors: () => ({ name: "Required" }) },
        { id: "step2" }
      ]
    });
    expect(engine.snapshot()?.stepId).toBe("step1");
    await engine.next(); // blocked — fieldErrors has entries
    expect(engine.snapshot()?.stepId).toBe("step1");

    // Would need setData to clear the message before next() proceeds
  });

  it("auto-derived canMoveNext allows next() when all messages are cleared", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        {
          id: "step1",
          fieldErrors: (ctx) => ({
            name: (ctx.data as PathData).name ? undefined : "Required"
          })
        },
        { id: "step2" }
      ]
    });
    expect(engine.snapshot()?.canMoveNext).toBe(false);
    await engine.setData("name", "Alice");
    expect(engine.snapshot()?.canMoveNext).toBe(true);
    await engine.next();
    expect(engine.snapshot()?.stepId).toBe("step2");
  });

  it("explicit canMoveNext takes precedence over auto-derive", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [{
        id: "step1",
        fieldErrors: () => ({ name: "Required" }), // has messages
        canMoveNext: () => true                        // explicitly allows anyway
      }]
    });
    expect(engine.snapshot()?.canMoveNext).toBe(true);
  });

  it("returns {} for an async fieldErrors hook (not supported synchronously)", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [{ id: "step1", fieldErrors: () => Promise.resolve({ name: "Required" }) as any }]
    });
    expect(engine.snapshot()?.fieldErrors).toEqual({});
  });

  it("updates as navigation moves to a different step", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "step1", fieldErrors: () => ({ field: "Fill in step 1" }) },
        { id: "step2", fieldErrors: () => ({}) }
      ]
    });
    expect(engine.snapshot()?.fieldErrors).toEqual({ field: "Fill in step 1" });

    await engine.goToStep("step2");
    expect(engine.snapshot()?.fieldErrors).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// validate() / hasValidated
// ---------------------------------------------------------------------------

describe("PathEngine — validate()", () => {
  it("hasValidated is false initially", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());
    expect(engine.snapshot()?.hasValidated).toBe(false);
  });

  it("sets hasValidated to true when validate() is called", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());
    engine.validate();
    expect(engine.snapshot()?.hasValidated).toBe(true);
  });

  it("hasValidated persists across step navigation", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());
    engine.validate();
    await engine.goToStep("step2");
    expect(engine.snapshot()?.hasValidated).toBe(true);
  });

  it("hasValidated resets on restart()", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());
    engine.validate();
    expect(engine.snapshot()?.hasValidated).toBe(true);
    await engine.restart();
    expect(engine.snapshot()?.hasValidated).toBe(false);
  });

  it("validate() emits stateChanged with cause 'validate'", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());
    const events: PathEvent[] = [];
    engine.subscribe(e => events.push(e));
    engine.validate();
    expect(events[0]).toMatchObject({ type: "stateChanged", cause: "validate" });
  });

  it("validate() is a no-op when engine has not been started", () => {
    const engine = new PathEngine();
    expect(() => engine.validate()).not.toThrow();
    expect(engine.snapshot()).toBeNull();
  });

  it("hasValidated resets on start()", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());
    engine.validate();
    await engine.next(); await engine.next(); // complete the path
    await engine.start(twoStepPath());
    expect(engine.snapshot()?.hasValidated).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// fieldWarnings
// ---------------------------------------------------------------------------

describe("PathEngine — fieldWarnings", () => {
  it("is an empty object when the step has no fieldWarnings hook", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());
    expect(engine.snapshot()?.fieldWarnings).toEqual({});
  });

  it("returns the warnings from the hook", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [{ id: "step1", fieldWarnings: () => ({ email: "Did you mean gmail.com?" }) }]
    });
    expect(engine.snapshot()?.fieldWarnings).toEqual({ email: "Did you mean gmail.com?" });
  });

  it("strips undefined values from the hook result", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [{ id: "step1", fieldWarnings: () => ({ name: undefined, email: "Check this" }) }]
    });
    expect(engine.snapshot()?.fieldWarnings).toEqual({ email: "Check this" });
  });

  it("re-evaluates warnings reactively when setData changes data", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        {
          id: "step1",
          fieldWarnings: (ctx) => ({
            email: (ctx.data as PathData).email === "test@gmial.com" ? "Did you mean gmail.com?" : undefined
          })
        }
      ]
    });
    expect(engine.snapshot()?.fieldWarnings).toEqual({});

    await engine.setData("email", "test@gmial.com");
    expect(engine.snapshot()?.fieldWarnings).toEqual({ email: "Did you mean gmail.com?" });
  });

  it("does NOT block canMoveNext", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [{ id: "step1", fieldWarnings: () => ({ email: "Looks odd" }) }]
    });
    expect(engine.snapshot()?.canMoveNext).toBe(true);
  });

  it("does NOT prevent next() navigation", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "step1", fieldWarnings: () => ({ email: "Looks odd" }) },
        { id: "step2" }
      ]
    });
    expect(engine.snapshot()?.stepId).toBe("step1");
    await engine.next();
    expect(engine.snapshot()?.stepId).toBe("step2");
  });

  it("returns {} for an async fieldWarnings hook (not supported synchronously)", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [{ id: "step1", fieldWarnings: () => Promise.resolve({ email: "Warning" }) as any }]
    });
    expect(engine.snapshot()?.fieldWarnings).toEqual({});
  });

  it("updates as navigation moves to a different step", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "step1", fieldWarnings: () => ({ field: "Consider this" }) },
        { id: "step2", fieldWarnings: () => ({}) }
      ]
    });
    expect(engine.snapshot()?.fieldWarnings).toEqual({ field: "Consider this" });

    await engine.goToStep("step2");
    expect(engine.snapshot()?.fieldWarnings).toEqual({});
  });

  it("coexists with fieldErrors — only fieldErrors blocks navigation", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        {
          id: "step1",
          fieldErrors: (ctx) => ({
            name: (ctx.data as PathData).name ? undefined : "Required"
          }),
          fieldWarnings: () => ({ email: "Did you mean gmail.com?" })
        },
        { id: "step2" }
      ]
    });
    // Both populated
    expect(engine.snapshot()?.fieldErrors).toEqual({ name: "Required" });
    expect(engine.snapshot()?.fieldWarnings).toEqual({ email: "Did you mean gmail.com?" });
    // fieldErrors blocks
    expect(engine.snapshot()?.canMoveNext).toBe(false);
    await engine.next();
    expect(engine.snapshot()?.stepId).toBe("step1");

    // Clear fieldErrors — warnings remain but don't block
    await engine.setData("name", "Alice");
    expect(engine.snapshot()?.canMoveNext).toBe(true);
    expect(engine.snapshot()?.fieldWarnings).toEqual({ email: "Did you mean gmail.com?" });
    await engine.next();
    expect(engine.snapshot()?.stepId).toBe("step2");
  });
});

// ---------------------------------------------------------------------------
// hasAttemptedNext
// ---------------------------------------------------------------------------

describe("PathEngine — hasAttemptedNext", () => {
  it("is false on initial step entry", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());
    expect(engine.snapshot()?.hasAttemptedNext).toBe(false);
  });

  it("becomes true after calling next(), even when navigation is blocked", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "step1", canMoveNext: () => ({ allowed: false }) },
        { id: "step2" }
      ]
    });
    expect(engine.snapshot()?.hasAttemptedNext).toBe(false);
    await engine.next(); // blocked but flag still sets
    expect(engine.snapshot()?.hasAttemptedNext).toBe(true);
    expect(engine.snapshot()?.stepId).toBe("step1"); // still on step1
  });

  it("resets to false when entering a new step", async () => {
    const engine = new PathEngine();
    await engine.start(threeStepPath());
    await engine.next(); // step1 → step2
    expect(engine.snapshot()?.stepId).toBe("step2");
    expect(engine.snapshot()?.hasAttemptedNext).toBe(false); // reset
  });

  it("resets when navigating backward to a previous step", async () => {
    const engine = new PathEngine();
    await engine.start(threeStepPath());
    await engine.next(); // step1 → step2
    await engine.next(); // step2 → step3
    expect(engine.snapshot()?.stepId).toBe("step3");
    
    await engine.previous(); // back to step2
    expect(engine.snapshot()?.stepId).toBe("step2");
    expect(engine.snapshot()?.hasAttemptedNext).toBe(false);
  });

  it("resets when using goToStep", async () => {
    const engine = new PathEngine();
    await engine.start(threeStepPath());
    await engine.next(); // advances to step2
    
    await engine.goToStep("step1"); // jump back to step1
    expect(engine.snapshot()?.stepId).toBe("step1");
    expect(engine.snapshot()?.hasAttemptedNext).toBe(false);
  });

  it("resets on restart", async () => {
    const engine = new PathEngine();
    await engine.start(threeStepPath());
    await engine.next(); // advances to step2
    
    await engine.restart();
    expect(engine.snapshot()?.hasAttemptedNext).toBe(false);
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

  it("throws when cancel is called with no active path", async () => {
    await expect(new PathEngine().cancel()).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// onComplete / onCancel callbacks on PathDefinition
// ---------------------------------------------------------------------------

describe("PathEngine — onComplete / onCancel on PathDefinition", () => {
  it("calls onComplete when a top-level path finishes", async () => {
    const onComplete = vi.fn();
    const engine = new PathEngine();
    await engine.start({
      id: "test",
      steps: [{ id: "s1" }, { id: "s2" }],
      onComplete
    });
    await engine.next();
    await engine.next();
    expect(onComplete).toHaveBeenCalledOnce();
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({}));
  });

  it("passes the final path data to onComplete", async () => {
    const onComplete = vi.fn();
    const engine = new PathEngine();
    await engine.start({
      id: "test",
      steps: [{ id: "s1" }],
      onComplete
    }, { name: "Alice" });
    await engine.setData("age", 30);
    await engine.next();
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ name: "Alice", age: 30 }));
  });

  it("calls onCancel when a top-level path is cancelled", async () => {
    const onCancel = vi.fn();
    const engine = new PathEngine();
    await engine.start({
      id: "test",
      steps: [{ id: "s1" }],
      onCancel
    }, { foo: "bar" });
    await engine.cancel();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledWith(expect.objectContaining({ foo: "bar" }));
  });

  it("does not call onComplete for sub-paths", async () => {
    const subOnComplete = vi.fn();
    const parentOnComplete = vi.fn();
    const engine = new PathEngine();
    await engine.start({
      id: "parent",
      steps: [{ id: "s1" }],
      onComplete: parentOnComplete
    });
    await engine.startSubPath({
      id: "sub",
      steps: [{ id: "sub1" }],
      onComplete: subOnComplete
    });
    await engine.next();
    expect(subOnComplete).not.toHaveBeenCalled();
    expect(parentOnComplete).not.toHaveBeenCalled();
  });

  it("does not call onCancel for sub-paths", async () => {
    const subOnCancel = vi.fn();
    const parentOnCancel = vi.fn();
    const engine = new PathEngine();
    await engine.start({
      id: "parent",
      steps: [{ id: "s1" }],
      onCancel: parentOnCancel
    });
    await engine.startSubPath({
      id: "sub",
      steps: [{ id: "sub1" }],
      onCancel: subOnCancel
    });
    await engine.cancel();
    expect(subOnCancel).not.toHaveBeenCalled();
    expect(parentOnCancel).not.toHaveBeenCalled();
  });

  it("supports async onComplete callback", async () => {
    let result: string | null = null;
    const engine = new PathEngine();
    await engine.start({
      id: "test",
      steps: [{ id: "s1" }],
      onComplete: async (data) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        result = "completed-" + data.value;
      }
    }, { value: "test" });
    await engine.next();
    expect(result).toBe("completed-test");
  });

  it("supports async onCancel callback", async () => {
    let result: string | null = null;
    const engine = new PathEngine();
    await engine.start({
      id: "test",
      steps: [{ id: "s1" }],
      onCancel: async (data) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        result = "cancelled-" + data.value;
      }
    }, { value: "test" });
    await engine.cancel();
    expect(result).toBe("cancelled-test");
  });

  it("calls onComplete before emitting the completed event (so errors in onComplete can be caught and retried)", async () => {
    const callOrder: string[] = [];
    const engine = new PathEngine();
    engine.subscribe((event) => {
      if (event.type === "completed") callOrder.push("event");
    });
    await engine.start({
      id: "test",
      steps: [{ id: "s1" }],
      onComplete: () => { callOrder.push("callback"); }
    });
    await engine.next();
    expect(callOrder).toEqual(["callback", "event"]);
  });

  it("calls onCancel after emitting the cancelled event", async () => {
    const callOrder: string[] = [];
    const engine = new PathEngine();
    engine.subscribe((event) => {
      if (event.type === "cancelled") callOrder.push("event");
    });
    await engine.start({
      id: "test",
      steps: [{ id: "s1" }],
      onCancel: () => { callOrder.push("callback"); }
    });
    await engine.cancel();
    expect(callOrder).toEqual(["event", "callback"]);
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
        { id: "step1", canMoveNext: () => Promise.resolve({ allowed: false }) },
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
        { id: "step2", canMovePrevious: () => Promise.resolve({ allowed: false }) }
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

  it("snapshot reflects accurate stepCount and progress after async skip resolves", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "step1" },
        { id: "skip-me", shouldSkip: () => Promise.resolve(true) },
        { id: "step3" }
      ]
    });
    // After start: step1 (index 0). skip-me was checked at start — not applicable at step 1.
    // step1 is index 0 in visible steps [step1, step3] = stepCount 2
    await engine.next();
    const snap = engine.snapshot()!;
    // After navigating: skip-me is now in resolvedSkips
    expect(snap.stepId).toBe("step3");
    expect(snap.stepCount).toBe(2);        // skip-me excluded
    expect(snap.stepIndex).toBe(1);        // step3 is index 1 in [step1, step3]
    expect(snap.progress).toBe(1);         // last visible step
    expect(snap.isLastStep).toBe(true);
    expect(snap.steps.map(s => s.id)).toEqual(["step1", "step3"]);
  });

  it("snapshot stepCount is optimistic (full count) before first navigation", async () => {
    // Before any navigation, resolvedSkips is empty so stepCount = steps.length
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "step1" },
        { id: "skip-me", shouldSkip: () => Promise.resolve(true) },
        { id: "step3" }
      ]
    });
    const snap = engine.snapshot()!;
    expect(snap.stepId).toBe("step1");
    // Before navigation: skip-me not yet resolved for this position, count is optimistic
    expect(snap.stepCount).toBe(3);
  });

  it("removes a step from resolvedSkips when it stops being skipped", async () => {
    let shouldSkipStep2 = true;
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "step1" },
        { id: "step2", shouldSkip: () => shouldSkipStep2 },
        { id: "step3" }
      ]
    });
    await engine.next();
    expect(engine.snapshot()?.stepId).toBe("step3");
    expect(engine.snapshot()?.stepCount).toBe(2); // step2 skipped

    // step2 should no longer be skipped
    shouldSkipStep2 = false;
    await engine.previous();

    // Engine walks back through step2 — resolves as not-skipped, lands on step2
    expect(engine.snapshot()?.stepId).toBe("step2");
    expect(engine.snapshot()?.stepCount).toBe(3); // step2 now visible
  });

  it("status is not 'idle' in intermediate stateChanged events during next", async () => {
    const statusesSeen = new Set<string>();
    const engine = new PathEngine();
    engine.subscribe((event) => {
      if (event.type === "stateChanged") statusesSeen.add(event.snapshot.status);
    });
    await engine.start({ id: "w", steps: [{ id: "step1" }, { id: "step2" }] });
    statusesSeen.clear(); // reset — only care about next's transitions
    await engine.next();
    // Should have seen at least one non-idle status (validating, leaving, entering)
    const busyStatuses = [...statusesSeen].filter(s => s !== "idle");
    expect(busyStatuses.length).toBeGreaterThan(0);
  });

  it("status is 'idle' in the final stateChanged event after navigation completes", async () => {
    const statuses: string[] = [];
    const engine = new PathEngine();
    engine.subscribe((event) => {
      if (event.type === "stateChanged") statuses.push(event.snapshot.status);
    });
    await engine.start({ id: "w", steps: [{ id: "step1" }, { id: "step2" }] });
    statuses.length = 0; // reset after start
    await engine.next();
    expect(statuses[statuses.length - 1]).toBe("idle");
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

  it("sets snapshot.error and status 'error' when an async guard throws", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        {
          id: "step1",
          canMoveNext: () => Promise.reject(new Error("network error"))
        },
        { id: "step2" }
      ]
    });

    await engine.next();
    const snap = engine.snapshot()!;
    expect(snap.stepId).toBe("step1");
    expect(snap.status).toBe("error");
    expect(snap.error).toEqual({ message: "network error", phase: "validating", retryCount: 0 });
  });

  it("allows navigation on a second attempt after a guard initially returns false", async () => {
    let shouldAllow = false;
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        {
          id: "step1",
          canMoveNext: () => Promise.resolve(shouldAllow)
        },
        { id: "step2" }
      ]
    });

    await engine.next();
    expect(engine.snapshot()?.stepId).toBe("step1");

    shouldAllow = true;
    await engine.next();
    expect(engine.snapshot()?.stepId).toBe("step2");
  });

  it("drops a concurrent next() call while a guard is already awaiting", async () => {
    let resolveGuard!: (v: boolean) => void;
    const guardPromise = new Promise<boolean>((resolve) => { resolveGuard = resolve; });

    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "step1", canMoveNext: () => guardPromise },
        { id: "step2" }
      ]
    });

    const first = engine.next();  // guard is now pending
    engine.next();                // second call — should be dropped silently

    resolveGuard(true);
    await first;

    // Only one navigation should have occurred
    expect(engine.snapshot()?.stepId).toBe("step2");
  });
});

// ---------------------------------------------------------------------------
// Error handling — snapshot.error, retry(), suspend()
// ---------------------------------------------------------------------------

describe("PathEngine — error handling", () => {
  it("sets snapshot.error when canMoveNext throws, stays on current step", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "s1", canMoveNext: () => Promise.reject(new Error("server down")) },
        { id: "s2" }
      ]
    });

    await engine.next();
    const snap = engine.snapshot()!;
    expect(snap.stepId).toBe("s1");
    expect(snap.status).toBe("error");
    expect(snap.error).toEqual({ message: "server down", phase: "validating", retryCount: 0 });
  });

  it("sets snapshot.error when onEnter throws on the new step", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "s1" },
        { id: "s2", onEnter: () => Promise.reject(new Error("load failed")) }
      ]
    });

    await engine.next();
    const snap = engine.snapshot()!;
    expect(snap.stepId).toBe("s2");
    expect(snap.error).toEqual({ message: "load failed", phase: "entering", retryCount: 0 });
  });

  it("sets snapshot.error when onLeave throws, stays on current step", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "s1", onLeave: () => Promise.reject(new Error("save failed")) },
        { id: "s2" }
      ]
    });

    await engine.next();
    const snap = engine.snapshot()!;
    expect(snap.stepId).toBe("s1");
    expect(snap.error).toEqual({ message: "save failed", phase: "leaving", retryCount: 0 });
  });

  it("sets snapshot.error when onComplete throws", async () => {
    const engine = new PathEngine();
    let callCount = 0;
    await engine.start({
      id: "w",
      steps: [{ id: "s1" }],
      onComplete: async () => {
        callCount++;
        throw new Error("submit failed");
      }
    });

    await engine.next();
    const snap = engine.snapshot()!;
    expect(snap.stepId).toBe("s1");
    expect(snap.error).toEqual({ message: "submit failed", phase: "completing", retryCount: 0 });
    expect(callCount).toBe(1);
  });

  it("retry() re-runs the failed operation and clears error on success", async () => {
    let shouldFail = true;
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        {
          id: "s1",
          canMoveNext: async () => {
            if (shouldFail) throw new Error("temporary failure");
            return true;
          }
        },
        { id: "s2" }
      ]
    });

    await engine.next();
    expect(engine.snapshot()!.error?.phase).toBe("validating");
    expect(engine.snapshot()!.stepId).toBe("s1");

    shouldFail = false;
    await engine.retry();
    expect(engine.snapshot()!.error).toBeNull();
    expect(engine.snapshot()!.stepId).toBe("s2");
  });

  it("retry() increments retryCount on repeated failure", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        { id: "s1", canMoveNext: () => Promise.reject(new Error("flaky")) },
        { id: "s2" }
      ]
    });

    await engine.next();
    expect(engine.snapshot()!.error?.retryCount).toBe(0);

    await engine.retry();
    expect(engine.snapshot()!.error?.retryCount).toBe(1);

    await engine.retry();
    expect(engine.snapshot()!.error?.retryCount).toBe(2);
  });

  it("calling next() after an error resets retryCount to 0", async () => {
    let fail = true;
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        {
          id: "s1",
          canMoveNext: async () => {
            if (fail) throw new Error("oops");
            return true;
          }
        },
        { id: "s2" }
      ]
    });

    await engine.next();
    expect(engine.snapshot()!.error?.retryCount).toBe(0);
    await engine.retry();
    expect(engine.snapshot()!.error?.retryCount).toBe(1);

    // Call next() fresh — retryCount should reset
    fail = false;
    await engine.next();
    expect(engine.snapshot()!.error).toBeNull();
    expect(engine.snapshot()!.stepId).toBe("s2");
  });

  it("retry() is a no-op when there is no pending error", async () => {
    const engine = new PathEngine();
    await engine.start({ id: "w", steps: [{ id: "s1" }, { id: "s2" }] });
    await engine.retry(); // no error — should not throw or change state
    expect(engine.snapshot()!.stepId).toBe("s1");
  });

  it("suspend() emits a suspended event and clears error state", async () => {
    const events: string[] = [];
    const engine = new PathEngine();
    engine.subscribe((e) => events.push(e.type));

    await engine.start({
      id: "w",
      steps: [
        { id: "s1", canMoveNext: () => Promise.reject(new Error("down")) },
        { id: "s2" }
      ]
    });

    await engine.next();
    expect(engine.snapshot()!.error).not.toBeNull();

    await engine.suspend();
    expect(events).toContain("suspended");
    expect(engine.snapshot()!.error).toBeNull();
    expect(engine.snapshot()!.status).toBe("idle");
  });

  it("suspend() includes the path id and current data in the suspended event", async () => {
    let suspendedEvent: { type: string; pathId: string; data: Record<string, unknown> } | null = null;
    const engine = new PathEngine();
    engine.subscribe((e) => {
      if (e.type === "suspended") suspendedEvent = e as typeof suspendedEvent;
    });

    await engine.start({ id: "my-path", steps: [{ id: "s1" }] }, { name: "Alice" });
    await engine.suspend();

    expect(suspendedEvent).not.toBeNull();
    expect(suspendedEvent!.pathId).toBe("my-path");
    expect(suspendedEvent!.data).toMatchObject({ name: "Alice" });
  });

  it("hasPersistence defaults to false", async () => {
    const engine = new PathEngine();
    await engine.start({ id: "w", steps: [{ id: "s1" }] });
    expect(engine.snapshot()!.hasPersistence).toBe(false);
  });

  it("hasPersistence is true when set in options", async () => {
    const engine = new PathEngine({ hasPersistence: true });
    await engine.start({ id: "w", steps: [{ id: "s1" }] });
    expect(engine.snapshot()!.hasPersistence).toBe(true);
  });

  it("snapshot.error is null on initial start", async () => {
    const engine = new PathEngine();
    await engine.start({ id: "w", steps: [{ id: "s1" }] });
    expect(engine.snapshot()!.error).toBeNull();
  });

  it("onComplete is called before the completed event fires", async () => {
    const order: string[] = [];
    const engine = new PathEngine();
    engine.subscribe((e) => { if (e.type === "completed") order.push("event"); });
    await engine.start({
      id: "w",
      steps: [{ id: "s1" }],
      onComplete: async () => { order.push("callback"); }
    });

    await engine.next();
    expect(order).toEqual(["callback", "event"]);
  });

  it("completed event does NOT fire when onComplete throws", async () => {
    const events: string[] = [];
    const engine = new PathEngine();
    engine.subscribe((e) => events.push(e.type));

    await engine.start({
      id: "w",
      steps: [{ id: "s1" }],
      onComplete: async () => { throw new Error("submit failed"); }
    });

    await engine.next();
    expect(events).not.toContain("completed");
    expect(engine.snapshot()!.error?.phase).toBe("completing");
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

  it("is available in all hooks including canMoveNext and fieldErrors", async () => {
    const canMoveNextFirstEntry: boolean[] = [];
    const fieldErrorsFirstEntry: boolean[] = [];
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [
        {
          id: "a",
          canMoveNext: (ctx) => { canMoveNextFirstEntry.push(ctx.isFirstEntry); return true; },
          fieldErrors: (ctx) => { fieldErrorsFirstEntry.push(ctx.isFirstEntry); return {}; }
        },
        { id: "b" }
      ]
    });
    await engine.next();
    await engine.previous(); // re-enter "a"
    await engine.next();
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

  it("does not throw when fieldErrors crashes on the first snapshot", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const engine = new PathEngine();

    await expect(
      engine.start({
        id: "p",
        steps: [{
          id: "s1",
          fieldErrors: ({ data }) => ({ name: (data.name as string).trim() })
        }]
      })
    ).resolves.toBeUndefined();

    // Safe default is an empty object.
    expect(engine.snapshot()?.fieldErrors).toEqual({});
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
      steps: [{ id: "s1", canMoveNext: () => ({ allowed: false }) }]
    });

    expect(engine.snapshot()?.canMoveNext).toBe(false);
  });

  it("returns fieldErrors normally when they do not throw", async () => {
    const engine = new PathEngine();

    await engine.start({
      id: "p",
      steps: [{ id: "s1", fieldErrors: () => ({ field: "Field is required" }) }]
    });

    expect(engine.snapshot()?.fieldErrors).toEqual({ field: "Field is required" });
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
  it("throws if restart() is called before start()", async () => {
    const engine = new PathEngine();
    expect(() => engine.restart()).toThrow("Cannot restart: engine has not been started");
  });

  it("restarts to step 1 while a path is mid-flow", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());
    await engine.next();
    expect(engine.snapshot()?.stepId).toBe("step2");

    await engine.restart();
    expect(engine.snapshot()?.stepId).toBe("step1");
  });

  it("restarts after a path has completed (snapshot was null)", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());
    await engine.next();
    await engine.next(); // completes
    expect(engine.snapshot()).toBeNull();

    await engine.restart();
    expect(engine.snapshot()?.stepId).toBe("step1");
  });

  it("clears the sub-path stack and restarts at the top level", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath("parent"));
    await engine.startSubPath(twoStepPath("sub"));
    expect(engine.snapshot()?.nestingLevel).toBe(1);

    await engine.restart();
    expect(engine.snapshot()?.pathId).toBe("parent");
    expect(engine.snapshot()?.nestingLevel).toBe(0);
  });

  it("returns to the original initialData passed to start()", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath(), { name: "Bob" });
    await engine.setData("name", "Alice");
    expect(engine.snapshot()?.data.name).toBe("Alice");

    await engine.restart();
    expect(engine.snapshot()?.data.name).toBe("Bob");
  });

  it("does not fire cancelled event when restarting", async () => {
    const engine = new PathEngine();
    const events: PathEvent[] = [];
    engine.subscribe((e) => events.push(e));

    await engine.start(twoStepPath());
    await engine.restart();

    expect(events.some((e) => e.type === "cancelled")).toBe(false);
  });

  it("emits stateChanged after restarting", async () => {
    const engine = new PathEngine();
    const events: PathEvent[] = [];
    engine.subscribe((e) => events.push(e));

    await engine.start(twoStepPath());
    await engine.restart();

    expect(events.some((e) => e.type === "stateChanged")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isDirty tracking
// ---------------------------------------------------------------------------

describe("PathEngine — isDirty", () => {
  it("is false when a step is first entered", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath(), { name: "" });
    expect(engine.snapshot()?.isDirty).toBe(false);
  });

  it("becomes true after setData changes a value", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath(), { name: "" });
    expect(engine.snapshot()?.isDirty).toBe(false);

    await engine.setData("name", "Alice");
    expect(engine.snapshot()?.isDirty).toBe(true);
  });

  it("remains false if setData sets the same value", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath(), { name: "Alice" });
    expect(engine.snapshot()?.isDirty).toBe(false);

    await engine.setData("name", "Alice");
    expect(engine.snapshot()?.isDirty).toBe(false);
  });

  it("becomes false after resetStep() is called", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath(), { name: "Alice" });
    await engine.setData("name", "Bob");
    expect(engine.snapshot()?.isDirty).toBe(true);

    await engine.resetStep();
    expect(engine.snapshot()?.isDirty).toBe(false);
  });

  it("resets to false when navigating to a new step", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath(), { name: "" });
    await engine.setData("name", "Alice");
    expect(engine.snapshot()?.isDirty).toBe(true);

    await engine.next();
    expect(engine.snapshot()?.isDirty).toBe(false);
  });

  it("resets to false when navigating backward", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath(), { name: "" });
    await engine.next();
    await engine.setData("name", "Alice");
    expect(engine.snapshot()?.isDirty).toBe(true);

    await engine.previous();
    expect(engine.snapshot()?.isDirty).toBe(false);
  });

  it("detects changes from multiple setData calls", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath(), { name: "", email: "" });
    await engine.setData("name", "Alice");
    expect(engine.snapshot()?.isDirty).toBe(true);

    await engine.setData("email", "alice@example.com");
    expect(engine.snapshot()?.isDirty).toBe(true);
  });

  it("becomes false if all changes are reverted manually", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath(), { name: "Alice" });
    await engine.setData("name", "Bob");
    expect(engine.snapshot()?.isDirty).toBe(true);

    await engine.setData("name", "Alice"); // revert to original
    expect(engine.snapshot()?.isDirty).toBe(false);
  });

  it("detects when a new key is added that wasn't in entry data", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath(), { name: "Alice" });
    expect(engine.snapshot()?.isDirty).toBe(false);

    await engine.setData("newField", "value");
    expect(engine.snapshot()?.isDirty).toBe(true);
  });

  it("is false after restart", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath(), { name: "" });
    await engine.setData("name", "Alice");
    expect(engine.snapshot()?.isDirty).toBe(true);

    await engine.restart();
    expect(engine.snapshot()?.isDirty).toBe(false);
  });

  it("tracks dirty state independently per step", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath(), { step1Data: "", step2Data: "" });
    
    // Modify on step 1
    await engine.setData("step1Data", "changed");
    expect(engine.snapshot()?.isDirty).toBe(true);
    
    // Navigate to step 2 - should reset to false
    await engine.next();
    expect(engine.snapshot()?.isDirty).toBe(false);
    
    // Modify on step 2
    await engine.setData("step2Data", "changed");
    expect(engine.snapshot()?.isDirty).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// stepEnteredAt timestamp
// ---------------------------------------------------------------------------

describe("PathEngine — stepEnteredAt", () => {
  it("captures a timestamp when a step is first entered", async () => {
    const engine = new PathEngine();
    const before = Date.now();
    await engine.start(twoStepPath("test"), { name: "Alice" });
    const after = Date.now();
    
    const snapshot = engine.snapshot();
    expect(snapshot?.stepEnteredAt).toBeGreaterThanOrEqual(before);
    expect(snapshot?.stepEnteredAt).toBeLessThanOrEqual(after);
  });

  it("updates the timestamp when navigating to a new step", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath("test"), { name: "Alice" });
    const firstTimestamp = engine.snapshot()?.stepEnteredAt;
    
    // Wait a bit to ensure different timestamp
    await new Promise(resolve => setTimeout(resolve, 10));
    
    await engine.next();
    const secondTimestamp = engine.snapshot()?.stepEnteredAt;
    
    expect(secondTimestamp).toBeGreaterThan(firstTimestamp!);
  });

  it("updates the timestamp when navigating backward", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath("test"), { name: "Alice" });
    await engine.next();
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 10));
    
    await engine.previous();
    const backTimestamp = engine.snapshot()?.stepEnteredAt;
    
    // Should have a fresh timestamp for re-entry
    expect(backTimestamp).toBeGreaterThan(0);
  });

  it("is included in exportState", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath("test"), { name: "Alice" });
    
    const state = engine.exportState();
    expect(state?.stepEnteredAt).toBeDefined();
    expect(typeof state?.stepEnteredAt).toBe("number");
    expect(state?.stepEnteredAt).toBeGreaterThan(0);
  });

  it("is restored from state", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath("test"), { name: "Alice" });
    await engine.next();
    
    const state = engine.exportState()!;
    const restoredEngine = PathEngine.fromState(state, { test: twoStepPath("test") });
    
    const snapshot = restoredEngine.snapshot();
    expect(snapshot?.stepEnteredAt).toBe(state.stepEnteredAt);
  });

  it("defaults to current timestamp when restoring state without stepEnteredAt", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath("test"), { name: "Alice" });
    
    const state = engine.exportState()!;
    // Simulate old state without stepEnteredAt
    delete (state as any).stepEnteredAt;
    
    const before = Date.now();
    const restoredEngine = PathEngine.fromState(state, { test: twoStepPath("test") });
    const after = Date.now();
    
    const snapshot = restoredEngine.snapshot();
    expect(snapshot?.stepEnteredAt).toBeGreaterThanOrEqual(before);
    expect(snapshot?.stepEnteredAt).toBeLessThanOrEqual(after);
  });

  it("tracks independently per step", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath("test"), { name: "Alice" });
    const step1Timestamp = engine.snapshot()?.stepEnteredAt;
    
    await new Promise(resolve => setTimeout(resolve, 10));
    await engine.next();
    const step2Timestamp = engine.snapshot()?.stepEnteredAt;
    
    expect(step2Timestamp).toBeGreaterThan(step1Timestamp!);
  });

  it("is updated on restart", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath("test"), { name: "Alice" });
    const firstTimestamp = engine.snapshot()?.stepEnteredAt;
    
    await new Promise(resolve => setTimeout(resolve, 10));
    await engine.restart();
    const restartTimestamp = engine.snapshot()?.stepEnteredAt;
    
    expect(restartTimestamp).toBeGreaterThan(firstTimestamp!);
  });

  it("can be used to compute duration on a step", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath("test"), { name: "Alice" });
    const snapshot = engine.snapshot();
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const duration = Date.now() - snapshot!.stepEnteredAt;
    expect(duration).toBeGreaterThanOrEqual(50);
    expect(duration).toBeLessThan(200); // reasonable upper bound
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
      _status: "idle"
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

  it("fromState restores _status field", async () => {
    const path = twoStepPath("test");
    const state: any = {
      version: 1,
      pathId: "test",
      currentStepIndex: 0,
      data: {},
      visitedStepIds: ["step1"],
      pathStack: [],
      _status: "validating"
    };

    const engine = PathEngine.fromState(state, { test: path });
    expect(engine.snapshot()?.status).toBe("validating");
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

// ---------------------------------------------------------------------------
// StepChoice — conditional step selection
// ---------------------------------------------------------------------------

describe("PathEngine — StepChoice", () => {
  it("exposes formId on the snapshot when a StepChoice is active", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "main",
      steps: [
        {
          id: "contact",
          select: () => "individual",
          steps: [{ id: "individual" }, { id: "company" }],
        } satisfies StepChoice,
      ],
    });
    expect(engine.snapshot()?.stepId).toBe("contact");
    expect(engine.snapshot()?.formId).toBe("individual");
  });

  it("formId is undefined for plain steps", async () => {
    const engine = new PathEngine();
    await engine.start({ id: "main", steps: [{ id: "step1" }] });
    expect(engine.snapshot()?.formId).toBeUndefined();
  });

  it("select receives snapshot data and picks the right step", async () => {
    const engine = new PathEngine();
    await engine.start(
      {
        id: "main",
        steps: [
          {
            id: "contact",
            select: ({ data }) => data.type === "company" ? "company" : "individual",
            steps: [{ id: "individual" }, { id: "company" }],
          } satisfies StepChoice,
        ],
      },
      { type: "company" }
    );
    expect(engine.snapshot()?.formId).toBe("company");
  });

  it("throws when select returns an id not in steps", async () => {
    const engine = new PathEngine();
    await expect(
      engine.start({
        id: "main",
        steps: [
          {
            id: "contact",
            select: () => "nonexistent",
            steps: [{ id: "individual" }],
          } satisfies StepChoice,
        ],
      })
    ).rejects.toThrow(/StepChoice "contact".select\(\) returned "nonexistent"/);
  });

  it("uses the inner step's title and meta; falls back to choice title/meta", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "main",
      steps: [
        {
          id: "contact",
          title: "Contact (fallback)",
          meta: { shared: true },
          select: () => "individual",
          steps: [{ id: "individual", title: "Individual details", meta: { form: "ind" } }],
        } satisfies StepChoice,
      ],
    });
    const snap = engine.snapshot()!;
    expect(snap.stepTitle).toBe("Individual details");
    expect(snap.stepMeta).toEqual({ form: "ind" });
  });

  it("falls back to choice title/meta when the inner step omits them", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "main",
      steps: [
        {
          id: "contact",
          title: "Contact",
          meta: { shared: true },
          select: () => "individual",
          steps: [{ id: "individual" }],
        } satisfies StepChoice,
      ],
    });
    const snap = engine.snapshot()!;
    expect(snap.stepTitle).toBe("Contact");
    expect(snap.stepMeta).toEqual({ shared: true });
  });

  it("uses the inner step's fieldErrors and auto-derives canMoveNext", async () => {
    const engine = new PathEngine();
    await engine.start(
      {
        id: "main",
        steps: [
          {
            id: "contact",
            select: () => "individual",
            steps: [
              {
                id: "individual",
                fieldErrors: ({ data }) => ({ name: !data.name ? "Required." : undefined }),
              },
            ],
          } satisfies StepChoice,
        ],
      },
      { name: "" }
    );
    expect(engine.snapshot()?.canMoveNext).toBe(false);
    expect(engine.snapshot()?.fieldErrors).toEqual({ name: "Required." });

    await engine.setData("name", "Alice");
    expect(engine.snapshot()?.canMoveNext).toBe(true);
  });

  it("uses the inner step's canMoveNext guard", async () => {
    const engine = new PathEngine();
    await engine.start(
      {
        id: "main",
        steps: [
          {
            id: "contact",
            select: () => "individual",
            steps: [
              { id: "individual", canMoveNext: ({ data }) => !!data.agreed },
            ],
          } satisfies StepChoice,
          { id: "step2" },
        ],
      },
      { agreed: false }
    );
    await engine.next();
    expect(engine.snapshot()?.stepId).toBe("contact"); // blocked

    await engine.setData("agreed", true);
    await engine.next();
    expect(engine.snapshot()?.stepId).toBe("step2");
  });

  it("calls the inner step's onEnter and onLeave hooks", async () => {
    const onEnter = vi.fn().mockResolvedValue({ entered: true });
    const onLeave = vi.fn().mockResolvedValue({ left: true });
    const engine = new PathEngine();
    await engine.start({
      id: "main",
      steps: [
        {
          id: "contact",
          select: () => "individual",
          steps: [{ id: "individual", onEnter, onLeave }],
        } satisfies StepChoice,
        { id: "step2" },
      ],
    });
    expect(onEnter).toHaveBeenCalledOnce();
    expect(engine.snapshot()?.data).toMatchObject({ entered: true });

    await engine.next();
    expect(onLeave).toHaveBeenCalledOnce();
    expect(engine.snapshot()?.data).toMatchObject({ left: true });
  });

  it("re-evaluates select when navigating back and data has changed", async () => {
    const engine = new PathEngine();
    await engine.start(
      {
        id: "main",
        steps: [
          { id: "step1" },
          {
            id: "contact",
            select: ({ data }) => data.type === "company" ? "company" : "individual",
            steps: [{ id: "individual" }, { id: "company" }],
          } satisfies StepChoice,
        ],
      },
      { type: "individual" }
    );

    await engine.next();
    expect(engine.snapshot()?.formId).toBe("individual");

    await engine.previous();
    await engine.setData("type", "company");
    await engine.next();
    expect(engine.snapshot()?.formId).toBe("company");
  });

  it("exposes inner step's fieldWarnings on the snapshot", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "main",
      steps: [
        {
          id: "contact",
          select: () => "individual",
          steps: [
            { id: "individual", fieldWarnings: () => ({ email: "Did you mean gmail.com?" }) },
          ],
        } satisfies StepChoice,
      ],
    });
    expect(engine.snapshot()?.fieldWarnings).toEqual({ email: "Did you mean gmail.com?" });
  });

  it("supports shouldSkip to bypass the entire choice slot", async () => {
    const engine = new PathEngine();
    await engine.start(
      {
        id: "main",
        steps: [
          { id: "step1" },
          {
            id: "contact",
            shouldSkip: ({ data }) => !!data.skipContact,
            select: () => "individual",
            steps: [{ id: "individual" }],
          } satisfies StepChoice,
          { id: "step3" },
        ],
      },
      { skipContact: true }
    );
    await engine.next();
    expect(engine.snapshot()?.stepId).toBe("step3");
  });

  it("restores the selected inner step correctly via fromState", async () => {
    const path: PathDefinition = {
      id: "main",
      steps: [
        {
          id: "contact",
          select: ({ data }) => data.mode === "company" ? "company" : "individual",
          steps: [{ id: "individual" }, { id: "company" }],
        } satisfies StepChoice,
      ],
    };

    const engine1 = new PathEngine();
    await engine1.start(path, { mode: "company" });
    expect(engine1.snapshot()?.formId).toBe("company");

    const engine2 = PathEngine.fromState(engine1.exportState()!, { main: path });
    expect(engine2.snapshot()?.formId).toBe("company");
  });

  it("choice appears in the steps summary with its own id and title", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "main",
      steps: [
        { id: "step1", title: "Step 1" },
        {
          id: "contact",
          title: "Contact Details",
          select: () => "individual",
          steps: [{ id: "individual" }],
        } satisfies StepChoice,
      ],
    });
    const summary = engine.snapshot()!.steps;
    expect(summary[1].id).toBe("contact");
    expect(summary[1].title).toBe("Contact Details");
  });
});

