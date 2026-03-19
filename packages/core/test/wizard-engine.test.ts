import { describe, expect, it, vi } from "vitest";
import { WizardArgs, WizardDefinition, WizardEngine, WizardEngineEvent } from "@pathwrite/core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function twoStepWizard(id = "main"): WizardDefinition {
  return { id, steps: [{ id: "step1" }, { id: "step2" }] };
}

function collectEvents(engine: WizardEngine): WizardEngineEvent[] {
  const events: WizardEngineEvent[] = [];
  engine.subscribe((e) => events.push(e));
  return events;
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

describe("WizardEngine — navigation", () => {
  it("starts on the first step", () => {
    const engine = new WizardEngine();
    engine.start(twoStepWizard());
    expect(engine.getSnapshot()?.stepId).toBe("step1");
  });

  it("advances to the next step", () => {
    const engine = new WizardEngine();
    engine.start(twoStepWizard());
    engine.moveNext();
    expect(engine.getSnapshot()?.stepId).toBe("step2");
  });

  it("finishes and clears state after moving past the last step", () => {
    const engine = new WizardEngine();
    engine.start(twoStepWizard());
    engine.moveNext();
    engine.moveNext();
    expect(engine.getSnapshot()).toBeNull();
  });

  it("moves to the previous step", () => {
    const engine = new WizardEngine();
    engine.start(twoStepWizard());
    engine.moveNext();
    engine.movePrevious();
    expect(engine.getSnapshot()?.stepId).toBe("step1");
  });

  it("cancels the wizard when moving previous from the first step", () => {
    const engine = new WizardEngine();
    engine.start(twoStepWizard());
    engine.movePrevious();
    expect(engine.getSnapshot()).toBeNull();
  });

  it("stays on the current step when okToMoveNext returns false", () => {
    const engine = new WizardEngine();
    engine.start({
      id: "w",
      steps: [{ id: "step1", okToMoveNext: () => false }, { id: "step2" }]
    });
    engine.moveNext();
    expect(engine.getSnapshot()?.stepId).toBe("step1");
  });

  it("stays on the current step when okToMovePrevious returns false", () => {
    const engine = new WizardEngine();
    engine.start({
      id: "w",
      steps: [{ id: "step1" }, { id: "step2", okToMovePrevious: () => false }]
    });
    engine.moveNext();
    engine.movePrevious();
    expect(engine.getSnapshot()?.stepId).toBe("step2");
  });

  it("still emits stateChanged when a guard blocks navigation", () => {
    const engine = new WizardEngine();
    const events = collectEvents(engine);
    engine.start({ id: "w", steps: [{ id: "step1", okToMoveNext: () => false }] });
    const before = events.filter((e) => e.type === "stateChanged").length;
    engine.moveNext();
    expect(events.filter((e) => e.type === "stateChanged").length).toBe(before + 1);
  });
});

// ---------------------------------------------------------------------------
// Snapshot fields
// ---------------------------------------------------------------------------

describe("WizardEngine — snapshot", () => {
  it("returns null when no wizard is active", () => {
    expect(new WizardEngine().getSnapshot()).toBeNull();
  });

  it("exposes correct stepIndex and stepCount", () => {
    const engine = new WizardEngine();
    engine.start({ id: "w", steps: [{ id: "a" }, { id: "b" }, { id: "c" }] });
    expect(engine.getSnapshot()).toMatchObject({ stepIndex: 0, stepCount: 3 });
    engine.moveNext();
    expect(engine.getSnapshot()).toMatchObject({ stepIndex: 1, stepCount: 3 });
  });

  it("isFirstStep is true only on the first step", () => {
    const engine = new WizardEngine();
    engine.start(twoStepWizard());
    expect(engine.getSnapshot()?.isFirstStep).toBe(true);
    engine.moveNext();
    expect(engine.getSnapshot()?.isFirstStep).toBe(false);
  });

  it("isLastStep is true only on the last step of a top-level wizard", () => {
    const engine = new WizardEngine();
    engine.start(twoStepWizard());
    expect(engine.getSnapshot()?.isLastStep).toBe(false);
    engine.moveNext();
    expect(engine.getSnapshot()?.isLastStep).toBe(true);
  });

  it("isLastStep is false on the last step of a sub-wizard", () => {
    const engine = new WizardEngine();
    engine.start(twoStepWizard("parent"));
    engine.startSubWizard(twoStepWizard("sub"));
    engine.moveNext(); // advance sub to its last step
    expect(engine.getSnapshot()?.isLastStep).toBe(false);
  });

  it("stackDepth is 0 for a top-level wizard and increments per nesting level", () => {
    const engine = new WizardEngine();
    engine.start(twoStepWizard("root"));
    expect(engine.getSnapshot()?.stackDepth).toBe(0);
    engine.startSubWizard(twoStepWizard("level1"));
    expect(engine.getSnapshot()?.stackDepth).toBe(1);
    engine.startSubWizard(twoStepWizard("level2"));
    expect(engine.getSnapshot()?.stackDepth).toBe(2);
  });

  it("snapshot args are a copy — mutating the returned object does not affect internal state", () => {
    const engine = new WizardEngine();
    engine.start(twoStepWizard(), { count: 1 });
    const snap = engine.getSnapshot()!;
    (snap.args as WizardArgs).count = 99;
    expect(engine.getSnapshot()?.args.count).toBe(1);
  });

  it("includes initial args passed to start", () => {
    const engine = new WizardEngine();
    engine.start(twoStepWizard(), { owner: "test", value: 42 });
    expect(engine.getSnapshot()?.args).toMatchObject({ owner: "test", value: 42 });
  });
});

// ---------------------------------------------------------------------------
// setArg
// ---------------------------------------------------------------------------

describe("WizardEngine — setArg", () => {
  it("updates a value and reflects it in the next snapshot", () => {
    const engine = new WizardEngine();
    engine.start(twoStepWizard(), { name: "original" });
    engine.setArg("name", "updated");
    expect(engine.getSnapshot()?.args.name).toBe("updated");
  });

  it("adds a new key that was not in the initial args", () => {
    const engine = new WizardEngine();
    engine.start(twoStepWizard());
    engine.setArg("extra", true);
    expect(engine.getSnapshot()?.args.extra).toBe(true);
  });

  it("emits stateChanged after setArg", () => {
    const engine = new WizardEngine();
    const events = collectEvents(engine);
    engine.start(twoStepWizard());
    const before = events.filter((e) => e.type === "stateChanged").length;
    engine.setArg("x", 1);
    expect(events.filter((e) => e.type === "stateChanged").length).toBe(before + 1);
  });

  it("throws when no wizard is active", () => {
    expect(() => new WizardEngine().setArg("x", 1)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

describe("WizardEngine — events", () => {
  it("emits stateChanged on start", () => {
    const engine = new WizardEngine();
    const events = collectEvents(engine);
    engine.start(twoStepWizard());
    expect(events.some((e) => e.type === "stateChanged")).toBe(true);
  });

  it("emits stateChanged on each moveNext", () => {
    const engine = new WizardEngine();
    const events = collectEvents(engine);
    engine.start(twoStepWizard());
    const before = events.filter((e) => e.type === "stateChanged").length;
    engine.moveNext();
    expect(events.filter((e) => e.type === "stateChanged").length).toBe(before + 1);
  });

  it("emits stateChanged on movePrevious", () => {
    const engine = new WizardEngine();
    const events = collectEvents(engine);
    engine.start(twoStepWizard());
    engine.moveNext();
    const before = events.filter((e) => e.type === "stateChanged").length;
    engine.movePrevious();
    expect(events.filter((e) => e.type === "stateChanged").length).toBe(before + 1);
  });

  it("emits completed with final args when the wizard finishes", () => {
    const engine = new WizardEngine();
    const events = collectEvents(engine);
    engine.start(twoStepWizard(), { result: "done" });
    engine.moveNext();
    engine.moveNext();
    const completed = events.find((e) => e.type === "completed");
    expect(completed).toMatchObject({ type: "completed", wizardId: "main", args: { result: "done" } });
  });

  it("emits cancelled with args when cancel is called on a top-level wizard", () => {
    const engine = new WizardEngine();
    const events = collectEvents(engine);
    engine.start(twoStepWizard(), { owner: "test" });
    engine.cancel();
    const cancelled = events.find((e) => e.type === "cancelled");
    expect(cancelled).toMatchObject({ type: "cancelled", wizardId: "main", args: { owner: "test" } });
  });

  it("emits resumed with correct wizard IDs when a sub-wizard completes", () => {
    const engine = new WizardEngine();
    const events = collectEvents(engine);
    engine.start(twoStepWizard("parent"));
    engine.startSubWizard(twoStepWizard("sub"));
    engine.moveNext();
    engine.moveNext(); // completes sub
    const resumed = events.find((e) => e.type === "resumed");
    expect(resumed).toMatchObject({ type: "resumed", resumedWizardId: "parent", fromSubWizardId: "sub" });
  });

  it("does not emit completed or resumed when a sub-wizard is cancelled", () => {
    const engine = new WizardEngine();
    const events = collectEvents(engine);
    engine.start(twoStepWizard("parent"));
    engine.startSubWizard(twoStepWizard("sub"));
    engine.cancel();
    expect(events.some((e) => e.type === "completed")).toBe(false);
    expect(events.some((e) => e.type === "resumed")).toBe(false);
  });

  it("does not emit cancelled for the parent when a sub-wizard is cancelled", () => {
    const engine = new WizardEngine();
    const events = collectEvents(engine);
    engine.start(twoStepWizard("parent"));
    engine.startSubWizard(twoStepWizard("sub"));
    engine.cancel();
    const cancelledIds = events
      .filter((e) => e.type === "cancelled")
      .map((e) => (e as Extract<WizardEngineEvent, { type: "cancelled" }>).wizardId);
    expect(cancelledIds).not.toContain("parent");
  });
});

// ---------------------------------------------------------------------------
// Lifecycle hooks
// ---------------------------------------------------------------------------

describe("WizardEngine — lifecycle hooks", () => {
  it("calls onVisit when the wizard starts", () => {
    const onVisit = vi.fn();
    const engine = new WizardEngine();
    engine.start({ id: "w", steps: [{ id: "step1", onVisit }] });
    expect(onVisit).toHaveBeenCalledOnce();
  });

  it("calls onVisit when navigating forward to a new step", () => {
    const onVisit = vi.fn();
    const engine = new WizardEngine();
    engine.start({ id: "w", steps: [{ id: "step1" }, { id: "step2", onVisit }] });
    engine.moveNext();
    expect(onVisit).toHaveBeenCalledOnce();
  });

  it("calls onVisit when navigating backward to a step", () => {
    const onVisit = vi.fn();
    const engine = new WizardEngine();
    engine.start({ id: "w", steps: [{ id: "step1", onVisit }, { id: "step2" }] });
    onVisit.mockClear();
    engine.moveNext();
    engine.movePrevious();
    expect(onVisit).toHaveBeenCalledOnce();
  });

  it("applies the patch returned by onVisit to the wizard args", () => {
    const engine = new WizardEngine();
    engine.start({ id: "w", steps: [{ id: "step1", onVisit: () => ({ visited: true }) }] });
    expect(engine.getSnapshot()?.args.visited).toBe(true);
  });

  it("calls onLeavingStep when navigating forward", () => {
    const onLeavingStep = vi.fn();
    const engine = new WizardEngine();
    engine.start({ id: "w", steps: [{ id: "step1", onLeavingStep }, { id: "step2" }] });
    engine.moveNext();
    expect(onLeavingStep).toHaveBeenCalledOnce();
  });

  it("calls onLeavingStep when navigating backward", () => {
    const onLeavingStep = vi.fn();
    const engine = new WizardEngine();
    engine.start({ id: "w", steps: [{ id: "step1" }, { id: "step2", onLeavingStep }] });
    engine.moveNext();
    engine.movePrevious();
    expect(onLeavingStep).toHaveBeenCalledOnce();
  });

  it("applies the patch returned by onLeavingStep to the wizard args", () => {
    const engine = new WizardEngine();
    engine.start({
      id: "w",
      steps: [{ id: "step1", onLeavingStep: () => ({ left: true }) }, { id: "step2" }]
    });
    engine.moveNext();
    expect(engine.getSnapshot()?.args.left).toBe(true);
  });

  it("does not call onLeavingStep when okToMoveNext blocks navigation", () => {
    const onLeavingStep = vi.fn();
    const engine = new WizardEngine();
    engine.start({
      id: "w",
      steps: [{ id: "step1", okToMoveNext: () => false, onLeavingStep }]
    });
    engine.moveNext();
    expect(onLeavingStep).not.toHaveBeenCalled();
  });

  it("calls onResumeFromSubWizard with the sub-wizard ID and its final args", () => {
    const onResume = vi.fn();
    const engine = new WizardEngine();
    engine.start({ id: "parent", steps: [{ id: "step1", onResumeFromSubWizard: onResume }] });
    engine.startSubWizard({ id: "sub", steps: [{ id: "sub1" }] }, { result: 42 });
    engine.moveNext();
    expect(onResume).toHaveBeenCalledOnce();
    expect(onResume).toHaveBeenCalledWith(
      "sub",
      expect.objectContaining({ result: 42 }),
      expect.objectContaining({ wizardId: "parent", stepId: "step1" })
    );
  });

  it("does not call onResumeFromSubWizard when the sub-wizard is cancelled", () => {
    const onResume = vi.fn();
    const engine = new WizardEngine();
    engine.start({ id: "parent", steps: [{ id: "step1", onResumeFromSubWizard: onResume }] });
    engine.startSubWizard({ id: "sub", steps: [{ id: "sub1" }] });
    engine.cancel();
    expect(onResume).not.toHaveBeenCalled();
  });

  it("applies the patch returned by onResumeFromSubWizard to the parent args", () => {
    const engine = new WizardEngine();
    engine.start({
      id: "parent",
      steps: [{
        id: "step1",
        onResumeFromSubWizard: (_id, subArgs) => ({ collected: subArgs.value })
      }]
    });
    engine.startSubWizard({
      id: "sub",
      steps: [{ id: "s1", onVisit: () => ({ value: "hello" }) }]
    });
    engine.moveNext();
    expect(engine.getSnapshot()?.args.collected).toBe("hello");
  });

  it("context args are a snapshot copy — direct mutation has no effect on wizard state", () => {
    const engine = new WizardEngine();
    engine.start({
      id: "w",
      steps: [{
        id: "step1",
        onVisit: (ctx) => {
          (ctx.args as WizardArgs).sneaky = "mutation";
          // intentionally return nothing
        }
      }]
    });
    expect(engine.getSnapshot()?.args.sneaky).toBeUndefined();
  });

  it("passes the correct wizardId and stepId in the hook context", () => {
    let captured: { wizardId: string; stepId: string } | null = null;
    const engine = new WizardEngine();
    engine.start({
      id: "my-wizard",
      steps: [{ id: "my-step", onVisit: (ctx) => { captured = { wizardId: ctx.wizardId, stepId: ctx.stepId }; } }]
    });
    expect(captured).toEqual({ wizardId: "my-wizard", stepId: "my-step" });
  });
});

// ---------------------------------------------------------------------------
// Sub-wizards
// ---------------------------------------------------------------------------

describe("WizardEngine — sub-wizards", () => {
  it("throws when startSubWizard is called without an active wizard", () => {
    expect(() => new WizardEngine().startSubWizard(twoStepWizard())).toThrow();
  });

  it("tracks the sub-wizard as the active wizard while it runs", () => {
    const engine = new WizardEngine();
    engine.start(twoStepWizard("parent"));
    engine.startSubWizard(twoStepWizard("sub"));
    expect(engine.getSnapshot()?.wizardId).toBe("sub");
  });

  it("resumes the parent step after the sub-wizard completes", () => {
    const engine = new WizardEngine();
    engine.start(twoStepWizard("parent"));
    engine.moveNext();
    engine.startSubWizard(twoStepWizard("sub"));
    engine.moveNext();
    engine.moveNext(); // complete sub
    expect(engine.getSnapshot()).toMatchObject({ wizardId: "parent", stepId: "step2" });
  });

  it("resumes the parent step after the sub-wizard is cancelled", () => {
    const engine = new WizardEngine();
    engine.start(twoStepWizard("parent"));
    engine.moveNext();
    engine.startSubWizard(twoStepWizard("sub"));
    engine.cancel();
    expect(engine.getSnapshot()).toMatchObject({ wizardId: "parent", stepId: "step2" });
  });

  it("supports deeply nested sub-wizards and unwinds the stack correctly", () => {
    const engine = new WizardEngine();
    engine.start(twoStepWizard("root"));
    engine.startSubWizard(twoStepWizard("level1"));
    engine.startSubWizard(twoStepWizard("level2"));

    expect(engine.getSnapshot()?.stackDepth).toBe(2);

    engine.moveNext();
    engine.moveNext(); // complete level2 → back to level1
    expect(engine.getSnapshot()?.wizardId).toBe("level1");

    engine.moveNext();
    engine.moveNext(); // complete level1 → back to root
    expect(engine.getSnapshot()?.wizardId).toBe("root");
  });
});

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

describe("WizardEngine — subscriptions", () => {
  it("supports multiple simultaneous subscribers", () => {
    const engine = new WizardEngine();
    const a: string[] = [];
    const b: string[] = [];
    engine.subscribe((e) => { if (e.type === "stateChanged") a.push(e.snapshot.stepId); });
    engine.subscribe((e) => { if (e.type === "stateChanged") b.push(e.snapshot.stepId); });
    engine.start(twoStepWizard());
    engine.moveNext();
    expect(a).toEqual(["step1", "step2"]);
    expect(b).toEqual(["step1", "step2"]);
  });

  it("unsubscribe stops the listener from receiving further events", () => {
    const engine = new WizardEngine();
    const received: string[] = [];
    const unsubscribe = engine.subscribe((e) => {
      if (e.type === "stateChanged") received.push(e.snapshot.stepId);
    });
    engine.start(twoStepWizard());
    unsubscribe();
    engine.moveNext();
    expect(received).toEqual(["step1"]);
  });

  it("unsubscribing one listener does not affect others", () => {
    const engine = new WizardEngine();
    const kept: string[] = [];
    const removed: string[] = [];
    const unsubscribe = engine.subscribe((e) => {
      if (e.type === "stateChanged") removed.push(e.snapshot.stepId);
    });
    engine.subscribe((e) => {
      if (e.type === "stateChanged") kept.push(e.snapshot.stepId);
    });
    engine.start(twoStepWizard());
    unsubscribe();
    engine.moveNext();
    expect(removed).toEqual(["step1"]);
    expect(kept).toEqual(["step1", "step2"]);
  });
});

// ---------------------------------------------------------------------------
// shouldSkip
// ---------------------------------------------------------------------------

describe("WizardEngine — shouldSkip", () => {
  it("skips a step during start when shouldSkip returns true", () => {
    const engine = new WizardEngine();
    engine.start({
      id: "w",
      steps: [{ id: "skip-me", shouldSkip: () => true }, { id: "step2" }]
    });
    expect(engine.getSnapshot()?.stepId).toBe("step2");
  });

  it("skips a step when navigating forward", () => {
    const engine = new WizardEngine();
    engine.start({
      id: "w",
      steps: [{ id: "step1" }, { id: "skip-me", shouldSkip: () => true }, { id: "step3" }]
    });
    engine.moveNext();
    expect(engine.getSnapshot()?.stepId).toBe("step3");
  });

  it("skips a step when navigating backward", () => {
    const engine = new WizardEngine();
    engine.start({
      id: "w",
      steps: [{ id: "step1" }, { id: "skip-me", shouldSkip: () => true }, { id: "step3" }]
    });
    engine.moveNext(); // lands on step3 (step2 skipped)
    engine.movePrevious(); // should skip step2 again and land on step1
    expect(engine.getSnapshot()?.stepId).toBe("step1");
  });

  it("skips multiple consecutive steps", () => {
    const engine = new WizardEngine();
    engine.start({
      id: "w",
      steps: [
        { id: "step1" },
        { id: "skip-a", shouldSkip: () => true },
        { id: "skip-b", shouldSkip: () => true },
        { id: "step4" }
      ]
    });
    engine.moveNext();
    expect(engine.getSnapshot()?.stepId).toBe("step4");
  });

  it("completes the wizard when all remaining steps are skipped on moveNext", () => {
    const engine = new WizardEngine();
    const events = collectEvents(engine);
    engine.start({
      id: "w",
      steps: [{ id: "step1" }, { id: "step2", shouldSkip: () => true }]
    });
    engine.moveNext();
    expect(engine.getSnapshot()).toBeNull();
    expect(events.some((e) => e.type === "completed")).toBe(true);
  });

  it("completes the wizard when all steps are skipped on start", () => {
    const engine = new WizardEngine();
    const events = collectEvents(engine);
    engine.start({
      id: "w",
      steps: [{ id: "skip-only", shouldSkip: () => true }]
    });
    expect(engine.getSnapshot()).toBeNull();
    expect(events.some((e) => e.type === "completed")).toBe(true);
  });

  it("cancels the wizard when all steps before current are skipped on movePrevious", () => {
    const engine = new WizardEngine();
    engine.start({
      id: "w",
      steps: [{ id: "skip-me", shouldSkip: () => true }, { id: "step2" }]
    });
    // We're on step2 because step1 was skipped at start
    engine.movePrevious();
    expect(engine.getSnapshot()).toBeNull();
  });

  it("evaluates shouldSkip with the current wizard args", () => {
    const engine = new WizardEngine();
    engine.start({
      id: "w",
      steps: [
        { id: "step1" },
        { id: "conditional", shouldSkip: (ctx) => ctx.args.skipMiddle === true },
        { id: "step3" }
      ]
    }, { skipMiddle: true });
    engine.moveNext();
    expect(engine.getSnapshot()?.stepId).toBe("step3");

    // Change args so the step is no longer skipped
    engine.movePrevious(); // back to step1
    engine.setArg("skipMiddle", false);
    engine.moveNext();
    expect(engine.getSnapshot()?.stepId).toBe("conditional");
  });

  it("does not call onVisit for skipped steps", () => {
    const onVisit = vi.fn();
    const engine = new WizardEngine();
    engine.start({
      id: "w",
      steps: [
        { id: "step1" },
        { id: "skip-me", shouldSkip: () => true, onVisit },
        { id: "step3" }
      ]
    });
    engine.moveNext();
    expect(onVisit).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// stepTitle in snapshot
// ---------------------------------------------------------------------------

describe("WizardEngine — stepTitle", () => {
  it("includes the step title in the snapshot when defined", () => {
    const engine = new WizardEngine();
    engine.start({ id: "w", steps: [{ id: "step1", title: "Welcome" }] });
    expect(engine.getSnapshot()?.stepTitle).toBe("Welcome");
  });

  it("is undefined when the step has no title", () => {
    const engine = new WizardEngine();
    engine.start({ id: "w", steps: [{ id: "step1" }] });
    expect(engine.getSnapshot()?.stepTitle).toBeUndefined();
  });

  it("updates as navigation progresses through titled steps", () => {
    const engine = new WizardEngine();
    engine.start({
      id: "w",
      steps: [
        { id: "step1", title: "First" },
        { id: "step2", title: "Second" }
      ]
    });
    expect(engine.getSnapshot()?.stepTitle).toBe("First");
    engine.moveNext();
    expect(engine.getSnapshot()?.stepTitle).toBe("Second");
  });
});

// ---------------------------------------------------------------------------
// goToStep — direct navigation
// ---------------------------------------------------------------------------

describe("WizardEngine — goToStep", () => {
  it("jumps forward to a step by ID", () => {
    const engine = new WizardEngine();
    engine.start({ id: "w", steps: [{ id: "a" }, { id: "b" }, { id: "c" }] });
    engine.goToStep("c");
    expect(engine.getSnapshot()?.stepId).toBe("c");
    expect(engine.getSnapshot()?.stepIndex).toBe(2);
  });

  it("jumps backward to a step by ID", () => {
    const engine = new WizardEngine();
    engine.start({ id: "w", steps: [{ id: "a" }, { id: "b" }, { id: "c" }] });
    engine.moveNext();
    engine.moveNext();
    engine.goToStep("a");
    expect(engine.getSnapshot()?.stepId).toBe("a");
    expect(engine.getSnapshot()?.stepIndex).toBe(0);
  });

  it("calls onLeavingStep on the current step", () => {
    const onLeavingStep = vi.fn();
    const engine = new WizardEngine();
    engine.start({ id: "w", steps: [{ id: "a", onLeavingStep }, { id: "b" }] });
    engine.goToStep("b");
    expect(onLeavingStep).toHaveBeenCalledOnce();
  });

  it("calls onVisit on the target step", () => {
    const onVisit = vi.fn();
    const engine = new WizardEngine();
    engine.start({ id: "w", steps: [{ id: "a" }, { id: "b", onVisit }] });
    engine.goToStep("b");
    expect(onVisit).toHaveBeenCalledOnce();
  });

  it("applies patches from both onLeavingStep and onVisit", () => {
    const engine = new WizardEngine();
    engine.start({
      id: "w",
      steps: [
        { id: "a", onLeavingStep: () => ({ leftA: true }) },
        { id: "b", onVisit: () => ({ visitedB: true }) }
      ]
    });
    engine.goToStep("b");
    expect(engine.getSnapshot()?.args).toMatchObject({ leftA: true, visitedB: true });
  });

  it("emits stateChanged after jumping", () => {
    const engine = new WizardEngine();
    const events = collectEvents(engine);
    engine.start({ id: "w", steps: [{ id: "a" }, { id: "b" }] });
    const before = events.filter((e) => e.type === "stateChanged").length;
    engine.goToStep("b");
    expect(events.filter((e) => e.type === "stateChanged").length).toBe(before + 1);
  });

  it("throws when the step ID does not exist", () => {
    const engine = new WizardEngine();
    engine.start(twoStepWizard());
    expect(() => engine.goToStep("nonexistent")).toThrow('Step "nonexistent" not found');
  });

  it("throws when no wizard is active", () => {
    expect(() => new WizardEngine().goToStep("any")).toThrow();
  });

  it("updates isFirstStep and isLastStep correctly", () => {
    const engine = new WizardEngine();
    engine.start({ id: "w", steps: [{ id: "a" }, { id: "b" }, { id: "c" }] });
    expect(engine.getSnapshot()?.isFirstStep).toBe(true);

    engine.goToStep("c");
    expect(engine.getSnapshot()?.isFirstStep).toBe(false);
    expect(engine.getSnapshot()?.isLastStep).toBe(true);

    engine.goToStep("b");
    expect(engine.getSnapshot()?.isFirstStep).toBe(false);
    expect(engine.getSnapshot()?.isLastStep).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// stepMeta in snapshot
// ---------------------------------------------------------------------------

describe("WizardEngine — stepMeta", () => {
  it("includes step meta in the snapshot when defined", () => {
    const engine = new WizardEngine();
    engine.start({
      id: "w",
      steps: [{ id: "step1", meta: { icon: "star", group: "intro" } }]
    });
    expect(engine.getSnapshot()?.stepMeta).toEqual({ icon: "star", group: "intro" });
  });

  it("is undefined when the step has no meta", () => {
    const engine = new WizardEngine();
    engine.start({ id: "w", steps: [{ id: "step1" }] });
    expect(engine.getSnapshot()?.stepMeta).toBeUndefined();
  });

  it("updates as navigation progresses through steps with different meta", () => {
    const engine = new WizardEngine();
    engine.start({
      id: "w",
      steps: [
        { id: "step1", meta: { icon: "edit" } },
        { id: "step2", meta: { icon: "check" } }
      ]
    });
    expect(engine.getSnapshot()?.stepMeta).toEqual({ icon: "edit" });
    engine.moveNext();
    expect(engine.getSnapshot()?.stepMeta).toEqual({ icon: "check" });
  });
});

// ---------------------------------------------------------------------------
// Error cases
// ---------------------------------------------------------------------------

describe("WizardEngine — errors", () => {
  it("throws when starting a wizard with no steps", () => {
    expect(() => new WizardEngine().start({ id: "empty", steps: [] })).toThrow();
  });

  it("throws when moveNext is called with no active wizard", () => {
    expect(() => new WizardEngine().moveNext()).toThrow();
  });

  it("throws when movePrevious is called with no active wizard", () => {
    expect(() => new WizardEngine().movePrevious()).toThrow();
  });

  it("throws when cancel is called with no active wizard", () => {
    expect(() => new WizardEngine().cancel()).toThrow();
  });
});
