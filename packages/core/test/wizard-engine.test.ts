import { describe, expect, it, vi } from "vitest";
import { PathData, PathDefinition, PathEngine, PathEvent } from "@pathwrite/core";

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
// goToStep, setArg) return Promise<void> to support async hooks/guards.

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

  it("cancels the path when moving previous from the first step", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());
    await engine.previous();
    expect(engine.snapshot()).toBeNull();
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

  it("snapshot args are a copy — mutating the returned object does not affect internal state", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath(), { count: 1 });
    const snap = engine.snapshot()!;
    (snap.args as PathData).count = 99;
    expect(engine.snapshot()?.args.count).toBe(1);
  });

  it("includes initial data passed to start", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath(), { owner: "test", value: 42 });
    expect(engine.snapshot()?.args).toMatchObject({ owner: "test", value: 42 });
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
// setArg
// ---------------------------------------------------------------------------

describe("PathEngine — setArg", () => {
  it("updates a value and reflects it in the next snapshot", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath(), { name: "original" });
    await engine.setArg("name", "updated");
    expect(engine.snapshot()?.args.name).toBe("updated");
  });

  it("adds a new key that was not in the initial data", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());
    await engine.setArg("extra", true);
    expect(engine.snapshot()?.args.extra).toBe(true);
  });

  it("emits stateChanged after setArg", async () => {
    const engine = new PathEngine();
    const events = collectEvents(engine);
    await engine.start(twoStepPath());
    const before = events.filter((e) => e.type === "stateChanged").length;
    await engine.setArg("x", 1);
    // setArg is synchronous — emits exactly 1 event
    expect(events.filter((e) => e.type === "stateChanged").length).toBe(before + 1);
  });

  it("throws when no path is active", () => {
    expect(() => new PathEngine().setArg("x", 1)).toThrow();
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
    expect(completed).toMatchObject({ type: "completed", pathId: "main", args: { result: "done" } });
  });

  it("emits cancelled with data when cancel is called on a top-level path", async () => {
    const engine = new PathEngine();
    const events = collectEvents(engine);
    await engine.start(twoStepPath(), { owner: "test" });
    await engine.cancel();
    const cancelled = events.find((e) => e.type === "cancelled");
    expect(cancelled).toMatchObject({ type: "cancelled", pathId: "main", args: { owner: "test" } });
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
    expect(engine.snapshot()?.args.visited).toBe(true);
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
    expect(engine.snapshot()?.args.left).toBe(true);
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
      expect.objectContaining({ pathId: "parent", stepId: "step1" })
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
    expect(engine.snapshot()?.args.collected).toBe("hello");
  });

  it("context args are a snapshot copy — direct mutation has no effect on path state", async () => {
    const engine = new PathEngine();
    await engine.start({
      id: "w",
      steps: [{
        id: "step1",
        onEnter: (ctx) => {
          (ctx.args as PathData).sneaky = "mutation";
        }
      }]
    });
    expect(engine.snapshot()?.args.sneaky).toBeUndefined();
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
        { id: "conditional", shouldSkip: (ctx) => ctx.args.skipMiddle === true },
        { id: "step3" }
      ]
    }, { skipMiddle: true });
    await engine.next();
    expect(engine.snapshot()?.stepId).toBe("step3");

    await engine.previous(); // back to step1
    await engine.setArg("skipMiddle", false);
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
    expect(engine.snapshot()?.args).toMatchObject({ leftA: true, visitedB: true });
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
    expect(engine.snapshot()?.args.asyncVisit).toBe(true);
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
    expect(engine.snapshot()?.args.asyncLeft).toBe(true);
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
    expect(engine.snapshot()?.args.collected).toBe("async-result");
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
