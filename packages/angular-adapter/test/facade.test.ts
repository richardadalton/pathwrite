import { describe, expect, it } from "vitest";
import { WizardDefinition } from "@pathwrite/core";
import { WizardFacade } from "../src/index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function twoStepWizard(id = "main"): WizardDefinition {
  return { id, steps: [{ id: "step1" }, { id: "step2" }] };
}

function latestState(facade: WizardFacade) {
  return facade.snapshot();
}

// ---------------------------------------------------------------------------
// state$
// ---------------------------------------------------------------------------

describe("WizardFacade — state$", () => {
  it("starts as null before any wizard is launched", () => {
    const facade = new WizardFacade();
    let initial: unknown = "not-set";
    facade.state$.subscribe((s) => (initial = s)).unsubscribe();
    expect(initial).toBeNull();
  });

  it("emits the current step snapshot when a wizard starts", () => {
    const facade = new WizardFacade();
    facade.start(twoStepWizard());
    expect(latestState(facade)).toMatchObject({ wizardId: "main", stepId: "step1" });
  });

  it("emits updated snapshots as navigation progresses", () => {
    const facade = new WizardFacade();
    const steps: string[] = [];
    facade.state$.subscribe((s) => { if (s) steps.push(s.stepId); });

    facade.start(twoStepWizard());
    facade.next();

    expect(steps).toContain("step1");
    expect(steps).toContain("step2");
  });

  it("emits null when the wizard completes", () => {
    const facade = new WizardFacade();
    facade.start(twoStepWizard());
    facade.next();
    facade.next(); // complete
    expect(latestState(facade)).toBeNull();
  });

  it("emits null when the wizard is cancelled", () => {
    const facade = new WizardFacade();
    facade.start(twoStepWizard());
    facade.cancel();
    expect(latestState(facade)).toBeNull();
  });

  it("reflects the parent wizard snapshot after a sub-wizard resumes", () => {
    const facade = new WizardFacade();
    facade.start(twoStepWizard("parent"));
    facade.next();
    facade.startSubWizard(twoStepWizard("sub"));
    expect(latestState(facade)?.wizardId).toBe("sub");

    facade.next();
    facade.next(); // complete sub → resume parent

    expect(latestState(facade)).toMatchObject({ wizardId: "parent", stepId: "step2" });
  });

  it("reflects the parent wizard snapshot after a sub-wizard is cancelled", () => {
    const facade = new WizardFacade();
    facade.start(twoStepWizard("parent"));
    facade.next();
    facade.startSubWizard(twoStepWizard("sub"));
    facade.cancel();
    expect(latestState(facade)).toMatchObject({ wizardId: "parent", stepId: "step2" });
  });

  it("late subscribers immediately receive the current state via BehaviorSubject replay", () => {
    const facade = new WizardFacade();
    facade.start(twoStepWizard());
    facade.next();

    let received: string | null = null;
    facade.state$.subscribe((s) => { received = s?.stepId ?? null; });
    expect(received).toBe("step2");
  });
});

// ---------------------------------------------------------------------------
// snapshot()
// ---------------------------------------------------------------------------

describe("WizardFacade — snapshot()", () => {
  it("returns null when no wizard is active", () => {
    expect(new WizardFacade().snapshot()).toBeNull();
  });

  it("returns the current snapshot synchronously", () => {
    const facade = new WizardFacade();
    facade.start(twoStepWizard(), { owner: "test" });
    const snap = facade.snapshot();
    expect(snap).toMatchObject({ wizardId: "main", stepId: "step1", args: { owner: "test" } });
  });

  it("is consistent with state$ after navigation", () => {
    const facade = new WizardFacade();
    facade.start(twoStepWizard());
    facade.next();
    let stateValue: string | undefined;
    facade.state$.subscribe((s) => { stateValue = s?.stepId; }).unsubscribe();
    expect(facade.snapshot()?.stepId).toBe(stateValue);
  });
});

// ---------------------------------------------------------------------------
// events$
// ---------------------------------------------------------------------------

describe("WizardFacade — events$", () => {
  it("emits stateChanged on start and navigation", () => {
    const facade = new WizardFacade();
    const types: string[] = [];
    facade.events$.subscribe((e) => types.push(e.type));

    facade.start(twoStepWizard());
    facade.next();

    expect(types.filter((t) => t === "stateChanged").length).toBeGreaterThanOrEqual(2);
  });

  it("emits completed when the wizard finishes", () => {
    const facade = new WizardFacade();
    const events: string[] = [];
    facade.events$.subscribe((e) => events.push(e.type));

    facade.start(twoStepWizard());
    facade.next();
    facade.next();

    expect(events).toContain("completed");
  });

  it("emits cancelled when cancel is called on a top-level wizard", () => {
    const facade = new WizardFacade();
    const events: string[] = [];
    facade.events$.subscribe((e) => events.push(e.type));

    facade.start(twoStepWizard());
    facade.cancel();

    expect(events).toContain("cancelled");
  });

  it("emits resumed when a sub-wizard completes", () => {
    const facade = new WizardFacade();
    const events: string[] = [];
    facade.events$.subscribe((e) => events.push(e.type));

    facade.start(twoStepWizard("parent"));
    facade.startSubWizard(twoStepWizard("sub"));
    facade.next();
    facade.next(); // complete sub

    expect(events).toContain("resumed");
  });

  it("does not emit to subscribers after the observable completes via ngOnDestroy", () => {
    const facade = new WizardFacade();
    const received: string[] = [];
    facade.events$.subscribe((e) => received.push(e.type));

    facade.start(twoStepWizard());
    facade.ngOnDestroy();

    // Engine events fired after destroy should not reach the observable
    const countBefore = received.length;
    // (We cannot call facade methods safely after destroy, but the subscription
    // should be completed and no further emissions expected)
    let completed = false;
    facade.events$.subscribe({ complete: () => (completed = true) });
    expect(completed).toBe(true);
    expect(received.length).toBe(countBefore);
  });
});

// ---------------------------------------------------------------------------
// Navigation methods
// ---------------------------------------------------------------------------

describe("WizardFacade — navigation methods", () => {
  it("next() advances the step", () => {
    const facade = new WizardFacade();
    facade.start(twoStepWizard());
    facade.next();
    expect(facade.snapshot()?.stepId).toBe("step2");
  });

  it("previous() goes back a step", () => {
    const facade = new WizardFacade();
    facade.start(twoStepWizard());
    facade.next();
    facade.previous();
    expect(facade.snapshot()?.stepId).toBe("step1");
  });

  it("cancel() clears the active wizard", () => {
    const facade = new WizardFacade();
    facade.start(twoStepWizard());
    facade.cancel();
    expect(facade.snapshot()).toBeNull();
  });

  it("setArg() updates the arg and is visible in the next snapshot", () => {
    const facade = new WizardFacade();
    facade.start(twoStepWizard(), { label: "old" });
    facade.setArg("label", "new");
    expect(facade.snapshot()?.args.label).toBe("new");
  });

  it("setArg() update is reflected in state$", () => {
    const facade = new WizardFacade();
    let latest: unknown;
    facade.state$.subscribe((s) => { latest = s?.args.label; });

    facade.start(twoStepWizard(), { label: "old" });
    facade.setArg("label", "new");

    expect(latest).toBe("new");
  });
});

// ---------------------------------------------------------------------------
// Sub-wizard
// ---------------------------------------------------------------------------

describe("WizardFacade — sub-wizard", () => {
  it("startSubWizard() throws when no wizard is active", () => {
    expect(() => new WizardFacade().startSubWizard(twoStepWizard())).toThrow();
  });

  it("startSubWizard() sets the sub-wizard as the active snapshot", () => {
    const facade = new WizardFacade();
    facade.start(twoStepWizard("parent"));
    facade.startSubWizard(twoStepWizard("sub"));
    expect(facade.snapshot()?.wizardId).toBe("sub");
  });
});

// ---------------------------------------------------------------------------
// goToStep
// ---------------------------------------------------------------------------

describe("WizardFacade — goToStep", () => {
  it("jumps to the target step by ID", () => {
    const facade = new WizardFacade();
    facade.start({ id: "w", steps: [{ id: "a" }, { id: "b" }, { id: "c" }] });
    facade.goToStep("c");
    expect(facade.snapshot()?.stepId).toBe("c");
  });

  it("throws when no wizard is active", () => {
    expect(() => new WizardFacade().goToStep("any")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

describe("WizardFacade — ngOnDestroy", () => {
  it("completes state$ on destroy", () => {
    const facade = new WizardFacade();
    let stateCompleted = false;
    facade.state$.subscribe({ complete: () => (stateCompleted = true) });
    facade.ngOnDestroy();
    expect(stateCompleted).toBe(true);
  });

  it("completes events$ on destroy", () => {
    const facade = new WizardFacade();
    let eventsCompleted = false;
    facade.events$.subscribe({ complete: () => (eventsCompleted = true) });
    facade.ngOnDestroy();
    expect(eventsCompleted).toBe(true);
  });
});
