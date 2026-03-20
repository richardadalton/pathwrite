import { describe, expect, it } from "vitest";
import { PathDefinition } from "@pathwrite/core";
import { PathFacade } from "../src/index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function twoStepPath(id = "main"): PathDefinition {
  return { id, steps: [{ id: "step1" }, { id: "step2" }] };
}

function latestState(facade: PathFacade) {
  return facade.snapshot();
}

// ---------------------------------------------------------------------------
// state$
// ---------------------------------------------------------------------------

describe("PathFacade — state$", () => {
  it("starts as null before any path is launched", () => {
    const facade = new PathFacade();
    let initial: unknown = "not-set";
    facade.state$.subscribe((s) => (initial = s)).unsubscribe();
    expect(initial).toBeNull();
  });

  it("emits the current step snapshot when a path starts", async () => {
    const facade = new PathFacade();
    await facade.start(twoStepPath());
    expect(latestState(facade)).toMatchObject({ pathId: "main", stepId: "step1" });
  });

  it("emits updated snapshots as navigation progresses", async () => {
    const facade = new PathFacade();
    const steps: string[] = [];
    facade.state$.subscribe((s) => { if (s) steps.push(s.stepId); });

    await facade.start(twoStepPath());
    await facade.next();

    expect(steps).toContain("step1");
    expect(steps).toContain("step2");
  });

  it("emits null when the path completes", async () => {
    const facade = new PathFacade();
    await facade.start(twoStepPath());
    await facade.next();
    await facade.next(); // complete
    expect(latestState(facade)).toBeNull();
  });

  it("emits null when the path is cancelled", async () => {
    const facade = new PathFacade();
    await facade.start(twoStepPath());
    await facade.cancel();
    expect(latestState(facade)).toBeNull();
  });

  it("reflects the parent path snapshot after a sub-path resumes", async () => {
    const facade = new PathFacade();
    await facade.start(twoStepPath("parent"));
    await facade.next();
    await facade.startSubPath(twoStepPath("sub"));
    expect(latestState(facade)?.pathId).toBe("sub");

    await facade.next();
    await facade.next(); // complete sub → resume parent

    expect(latestState(facade)).toMatchObject({ pathId: "parent", stepId: "step2" });
  });

  it("reflects the parent path snapshot after a sub-path is cancelled", async () => {
    const facade = new PathFacade();
    await facade.start(twoStepPath("parent"));
    await facade.next();
    await facade.startSubPath(twoStepPath("sub"));
    await facade.cancel();
    expect(latestState(facade)).toMatchObject({ pathId: "parent", stepId: "step2" });
  });

  it("late subscribers immediately receive the current state via BehaviorSubject replay", async () => {
    const facade = new PathFacade();
    await facade.start(twoStepPath());
    await facade.next();

    let received: string | null = null;
    facade.state$.subscribe((s) => { received = s?.stepId ?? null; });
    expect(received).toBe("step2");
  });
});

// ---------------------------------------------------------------------------
// snapshot()
// ---------------------------------------------------------------------------

describe("PathFacade — snapshot()", () => {
  it("returns null when no path is active", () => {
    expect(new PathFacade().snapshot()).toBeNull();
  });

  it("returns the current snapshot synchronously", async () => {
    const facade = new PathFacade();
    await facade.start(twoStepPath(), { owner: "test" });
    const snap = facade.snapshot();
    expect(snap).toMatchObject({ pathId: "main", stepId: "step1", args: { owner: "test" } });
  });

  it("is consistent with state$ after navigation", async () => {
    const facade = new PathFacade();
    await facade.start(twoStepPath());
    await facade.next();
    let stateValue: string | undefined;
    facade.state$.subscribe((s) => { stateValue = s?.stepId; }).unsubscribe();
    expect(facade.snapshot()?.stepId).toBe(stateValue);
  });
});

// ---------------------------------------------------------------------------
// events$
// ---------------------------------------------------------------------------

describe("PathFacade — events$", () => {
  it("emits stateChanged on start and navigation", async () => {
    const facade = new PathFacade();
    const types: string[] = [];
    facade.events$.subscribe((e) => types.push(e.type));

    await facade.start(twoStepPath());
    await facade.next();

    expect(types.filter((t) => t === "stateChanged").length).toBeGreaterThanOrEqual(2);
  });

  it("emits completed when the path finishes", async () => {
    const facade = new PathFacade();
    const events: string[] = [];
    facade.events$.subscribe((e) => events.push(e.type));

    await facade.start(twoStepPath());
    await facade.next();
    await facade.next();

    expect(events).toContain("completed");
  });

  it("emits cancelled when cancel is called on a top-level path", async () => {
    const facade = new PathFacade();
    const events: string[] = [];
    facade.events$.subscribe((e) => events.push(e.type));

    await facade.start(twoStepPath());
    await facade.cancel();

    expect(events).toContain("cancelled");
  });

  it("emits resumed when a sub-path completes", async () => {
    const facade = new PathFacade();
    const events: string[] = [];
    facade.events$.subscribe((e) => events.push(e.type));

    await facade.start(twoStepPath("parent"));
    await facade.startSubPath(twoStepPath("sub"));
    await facade.next();
    await facade.next(); // complete sub

    expect(events).toContain("resumed");
  });

  it("does not emit to subscribers after the observable completes via ngOnDestroy", async () => {
    const facade = new PathFacade();
    const received: string[] = [];
    facade.events$.subscribe((e) => received.push(e.type));

    await facade.start(twoStepPath());
    facade.ngOnDestroy();

    const countBefore = received.length;
    let completed = false;
    facade.events$.subscribe({ complete: () => (completed = true) });
    expect(completed).toBe(true);
    expect(received.length).toBe(countBefore);
  });
});

// ---------------------------------------------------------------------------
// Navigation methods
// ---------------------------------------------------------------------------

describe("PathFacade — navigation methods", () => {
  it("next() advances the step", async () => {
    const facade = new PathFacade();
    await facade.start(twoStepPath());
    await facade.next();
    expect(facade.snapshot()?.stepId).toBe("step2");
  });

  it("previous() goes back a step", async () => {
    const facade = new PathFacade();
    await facade.start(twoStepPath());
    await facade.next();
    await facade.previous();
    expect(facade.snapshot()?.stepId).toBe("step1");
  });

  it("cancel() clears the active path", async () => {
    const facade = new PathFacade();
    await facade.start(twoStepPath());
    await facade.cancel();
    expect(facade.snapshot()).toBeNull();
  });

  it("setArg() updates the arg and is visible in the next snapshot", async () => {
    const facade = new PathFacade();
    await facade.start(twoStepPath(), { label: "old" });
    await facade.setArg("label", "new");
    expect(facade.snapshot()?.args.label).toBe("new");
  });

  it("setArg() update is reflected in state$", async () => {
    const facade = new PathFacade();
    let latest: unknown;
    facade.state$.subscribe((s) => { latest = s?.args.label; });

    await facade.start(twoStepPath(), { label: "old" });
    await facade.setArg("label", "new");

    expect(latest).toBe("new");
  });
});

// ---------------------------------------------------------------------------
// Sub-path
// ---------------------------------------------------------------------------

describe("PathFacade — sub-path", () => {
  it("startSubPath() throws when no path is active", () => {
    expect(() => new PathFacade().startSubPath(twoStepPath())).toThrow();
  });

  it("startSubPath() sets the sub-path as the active snapshot", async () => {
    const facade = new PathFacade();
    await facade.start(twoStepPath("parent"));
    await facade.startSubPath(twoStepPath("sub"));
    expect(facade.snapshot()?.pathId).toBe("sub");
  });
});

// ---------------------------------------------------------------------------
// goToStep
// ---------------------------------------------------------------------------

describe("PathFacade — goToStep", () => {
  it("jumps to the target step by ID", async () => {
    const facade = new PathFacade();
    await facade.start({ id: "w", steps: [{ id: "a" }, { id: "b" }, { id: "c" }] });
    await facade.goToStep("c");
    expect(facade.snapshot()?.stepId).toBe("c");
  });

  it("throws when no path is active", () => {
    expect(() => new PathFacade().goToStep("any")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

describe("PathFacade — ngOnDestroy", () => {
  it("completes state$ on destroy", () => {
    const facade = new PathFacade();
    let stateCompleted = false;
    facade.state$.subscribe({ complete: () => (stateCompleted = true) });
    facade.ngOnDestroy();
    expect(stateCompleted).toBe(true);
  });

  it("completes events$ on destroy", () => {
    const facade = new PathFacade();
    let eventsCompleted = false;
    facade.events$.subscribe({ complete: () => (eventsCompleted = true) });
    facade.ngOnDestroy();
    expect(eventsCompleted).toBe(true);
  });
});
