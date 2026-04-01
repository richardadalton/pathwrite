import { describe, expect, it, vi } from "vitest";
import { Subject } from "rxjs";
import { PathData, PathDefinition, PathEngine } from "@daltonr/pathwrite-core";
import { PathFacade, syncFormGroup, FormGroupLike } from "../src/index";

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

  it("emits completed snapshot when the path completes", async () => {
    const facade = new PathFacade();
    await facade.start(twoStepPath());
    await facade.next();
    await facade.next(); // complete
    expect(latestState(facade)?.status).toBe("completed");
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
    expect(snap).toMatchObject({ pathId: "main", stepId: "step1", data: { owner: "test" } });
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

  it("setData() updates the value and is visible in the next snapshot", async () => {
    const facade = new PathFacade();
    await facade.start(twoStepPath(), { label: "old" });
    await facade.setData("label", "new");
    expect(facade.snapshot()?.data.label).toBe("new");
  });

  it("setData() update is reflected in state$", async () => {
    const facade = new PathFacade();
    let latest: unknown;
    facade.state$.subscribe((s) => { latest = s?.data.label; });

    await facade.start(twoStepPath(), { label: "old" });
    await facade.setData("label", "new");

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
// goToStepChecked
// ---------------------------------------------------------------------------

describe("PathFacade — goToStepChecked", () => {
  it("navigates forward to the target step when canMoveNext allows", async () => {
    const facade = new PathFacade();
    await facade.start({ id: "w", steps: [{ id: "a" }, { id: "b" }, { id: "c" }] });
    await facade.goToStepChecked("c");
    expect(facade.snapshot()?.stepId).toBe("c");
  });

  it("navigates backward to the target step when canMovePrevious allows", async () => {
    const facade = new PathFacade();
    await facade.start({ id: "w", steps: [{ id: "a" }, { id: "b" }, { id: "c" }] });
    await facade.goToStep("c");
    await facade.goToStepChecked("a");
    expect(facade.snapshot()?.stepId).toBe("a");
  });

  it("blocks forward navigation when canMoveNext returns false", async () => {
    const facade = new PathFacade();
    await facade.start({
      id: "w",
      steps: [{ id: "a", canMoveNext: () => ({ allowed: false }) }, { id: "b" }]
    });
    await facade.goToStepChecked("b");
    expect(facade.snapshot()?.stepId).toBe("a");
  });

  it("blocks backward navigation when canMovePrevious returns false", async () => {
    const facade = new PathFacade();
    await facade.start({
      id: "w",
      steps: [{ id: "a" }, { id: "b", canMovePrevious: () => ({ allowed: false }) }]
    });
    await facade.goToStep("b");
    await facade.goToStepChecked("a");
    expect(facade.snapshot()?.stepId).toBe("b");
  });

  it("is a no-op when already on the target step", async () => {
    const facade = new PathFacade();
    await facade.start({ id: "w", steps: [{ id: "a" }, { id: "b" }] });
    await facade.goToStepChecked("a");
    expect(facade.snapshot()?.stepId).toBe("a");
  });

  it("rejects for unknown step IDs", async () => {
    const facade = new PathFacade();
    await facade.start({ id: "w", steps: [{ id: "a" }] });
    await expect(facade.goToStepChecked("unknown")).rejects.toThrow();
  });

  it("throws when no path is active", () => {
    expect(() => new PathFacade().goToStepChecked("any")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Generic typing PathFacade<TData>
// ---------------------------------------------------------------------------

interface StepData extends PathData {
  name: string;
  count: number;
}

describe("PathFacade — generic typing <TData>", () => {
  it("snapshot() data is typed correctly when using PathFacade<TData>", async () => {
    const facade = new PathFacade<StepData>();
    await facade.start(twoStepPath(), { name: "Alice", count: 42 });
    const snap = facade.snapshot();
    expect(snap?.data.name).toBe("Alice");
    expect(snap?.data.count).toBe(42);
  });

  it("state$ emits snapshots with the typed data shape", async () => {
    const facade = new PathFacade<StepData>();
    let latest: StepData | undefined;
    facade.state$.subscribe((s) => { if (s) latest = s.data; });

    await facade.start(twoStepPath(), { name: "Bob", count: 7 });
    expect(latest?.name).toBe("Bob");
    expect(latest?.count).toBe(7);
  });

  it("stateSignal reflects the typed data shape", async () => {
    const facade = new PathFacade<StepData>();
    await facade.start(twoStepPath(), { name: "Carol", count: 3 });
    expect(facade.stateSignal()?.data.name).toBe("Carol");
    expect(facade.stateSignal()?.data.count).toBe(3);
  });

  it("setData accepts typed keys and updates state correctly", async () => {
    const facade = new PathFacade<StepData>();
    await facade.start(twoStepPath(), { name: "Dave", count: 0 });
    await facade.setData("count", 99);
    expect(facade.snapshot()?.data.count).toBe(99);
  });

  it("canMoveNext guard receives typed data via state$ snapshot", async () => {
    const facade = new PathFacade<StepData>();
    const path: PathDefinition = {
      id: "p",
      steps: [
        { id: "s1", canMoveNext: (ctx) => (ctx.data as StepData).count > 0 },
        { id: "s2" }
      ]
    };
    await facade.start(path, { name: "", count: 0 });
    expect(facade.snapshot()?.canMoveNext).toBe(false);

    await facade.setData("count", 1);
    expect(facade.snapshot()?.canMoveNext).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// fieldErrors
// ---------------------------------------------------------------------------

describe("PathFacade — fieldErrors", () => {
  it("is an empty object when the step has no fieldErrors hook", async () => {
    const facade = new PathFacade();
    await facade.start(twoStepPath());
    expect(facade.snapshot()?.fieldErrors).toEqual({});
  });

  it("returns messages from the hook", async () => {
    const facade = new PathFacade();
    await facade.start({
      id: "w",
      steps: [{ id: "step1", fieldErrors: () => ({ field: "Field is required" }) }]
    });
    expect(facade.snapshot()?.fieldErrors).toEqual({ field: "Field is required" });
  });

  it("strips undefined values", async () => {
    const facade = new PathFacade();
    await facade.start({
      id: "w",
      steps: [{ id: "step1", fieldErrors: () => ({ name: "Required", email: undefined }) }]
    });
    expect(facade.snapshot()?.fieldErrors).toEqual({ name: "Required" });
  });

  it("updates reactively when setData changes data", async () => {
    const facade = new PathFacade();
    await facade.start({
      id: "w",
      steps: [
        {
          id: "step1",
          fieldErrors: (ctx) => ({
            name: (ctx.data as PathData).name ? undefined : "Name is required"
          })
        }
      ]
    });
    expect(facade.snapshot()?.fieldErrors).toEqual({ name: "Name is required" });

    await facade.setData("name", "Alice");
    expect(facade.snapshot()?.fieldErrors).toEqual({});
  });

  it("is reflected in state$", async () => {
    const facade = new PathFacade();
    let latest: Record<string, string> | undefined;
    facade.state$.subscribe((s) => { if (s) latest = s.fieldErrors; });

    await facade.start({
      id: "w",
      steps: [{ id: "step1", fieldErrors: () => ({ field: "Required" }) }]
    });
    expect(latest).toEqual({ field: "Required" });
  });

  it("auto-derives canMoveNext from fieldErrors when canMoveNext is absent", async () => {
    const facade = new PathFacade();
    await facade.start({
      id: "w",
      steps: [{ id: "step1", fieldErrors: () => ({ name: "Required" }) }]
    });
    expect(facade.snapshot()?.canMoveNext).toBe(false);
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

// ---------------------------------------------------------------------------
// stateSignal
// ---------------------------------------------------------------------------

describe("PathFacade — stateSignal", () => {
  it("starts as null before any path is launched", () => {
    expect(new PathFacade().stateSignal()).toBeNull();
  });

  it("reflects the current snapshot after a path starts", async () => {
    const facade = new PathFacade();
    await facade.start(twoStepPath());
    expect(facade.stateSignal()).toMatchObject({ pathId: "main", stepId: "step1" });
  });

  it("updates in sync with state$ on each navigation", async () => {
    const facade = new PathFacade();
    await facade.start(twoStepPath());
    await facade.next();
    expect(facade.stateSignal()?.stepId).toBe("step2");
    expect(facade.stateSignal()).toBe(facade.snapshot());
  });

  it("returns completed snapshot after the path completes", async () => {
    const facade = new PathFacade();
    await facade.start(twoStepPath());
    await facade.next();
    await facade.next();
    expect(facade.stateSignal()?.status).toBe("completed");
  });

  it("returns null after the path is cancelled", async () => {
    const facade = new PathFacade();
    await facade.start(twoStepPath());
    await facade.cancel();
    expect(facade.stateSignal()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// syncFormGroup helpers
// ---------------------------------------------------------------------------

function createMockFormGroup(initialValues: Record<string, unknown>): FormGroupLike & {
  emit(values: Record<string, unknown>): void;
} {
  const subject = new Subject<unknown>();
  const current: Record<string, unknown> = { ...initialValues };
  return {
    getRawValue: () => ({ ...current }),
    valueChanges: subject.asObservable(),
    emit(values: Record<string, unknown>) {
      Object.assign(current, values);
      subject.next({ ...current });
    },
  };
}

// ---------------------------------------------------------------------------
// syncFormGroup
// ---------------------------------------------------------------------------

describe("syncFormGroup", () => {
  it("immediately syncs the current form values to facade data", async () => {
    const facade = new PathFacade();
    await facade.start(twoStepPath(), {});
    const form = createMockFormGroup({ name: "Alice", age: 30 });

    syncFormGroup(facade, form);

    expect(facade.snapshot()?.data).toMatchObject({ name: "Alice", age: 30 });
  });

  it("syncs form value changes to facade data", async () => {
    const facade = new PathFacade();
    await facade.start(twoStepPath(), {});
    const form = createMockFormGroup({ name: "" });
    syncFormGroup(facade, form);

    form.emit({ name: "Bob" });
    await Promise.resolve(); // let setData promises settle

    expect(facade.snapshot()?.data.name).toBe("Bob");
  });

  it("makes canMoveNext guards reactive to form changes", async () => {
    const facade = new PathFacade();
    const path: PathDefinition = {
      id: "p",
      steps: [
        { id: "s1", canMoveNext: (ctx) => typeof ctx.data.name === "string" && (ctx.data.name as string).length > 0 },
        { id: "s2" },
      ],
    };
    await facade.start(path, { name: "" });
    const form = createMockFormGroup({ name: "" });
    syncFormGroup(facade, form);

    expect(facade.snapshot()?.canMoveNext).toBe(false);

    form.emit({ name: "Alice" });
    await Promise.resolve();

    expect(facade.snapshot()?.canMoveNext).toBe(true);
  });

  it("does nothing when no path is active (no throw)", () => {
    const facade = new PathFacade();
    const form = createMockFormGroup({ name: "Alice" });
    expect(() => syncFormGroup(facade, form)).not.toThrow();
  });

  it("stops syncing after the returned cleanup function is called", async () => {
    const facade = new PathFacade();
    await facade.start(twoStepPath(), { name: "initial" });
    const form = createMockFormGroup({ name: "initial" });
    const cleanup = syncFormGroup(facade, form);

    cleanup();
    form.emit({ name: "should-not-sync" });
    await Promise.resolve();

    expect(facade.snapshot()?.data.name).toBe("initial");
  });

  it("calls destroyRef.onDestroy with the cleanup function if provided", () => {
    const facade = new PathFacade();
    const form = createMockFormGroup({});
    const destroyRef = { onDestroy: vi.fn() };

    syncFormGroup(facade, form, destroyRef as never);

    expect(destroyRef.onDestroy).toHaveBeenCalledWith(expect.any(Function));
  });

  it("does not sync after the path completes", async () => {
    const facade = new PathFacade();
    await facade.start(twoStepPath(), { name: "" });
    const form = createMockFormGroup({ name: "" });
    syncFormGroup(facade, form);

    await facade.next();
    await facade.next(); // complete path — facade.snapshot() is now in completed status

    form.emit({ name: "post-complete" });
    await Promise.resolve();

    expect(facade.snapshot()?.status).toBe("completed");
  });
});

// ---------------------------------------------------------------------------
// adoptEngine
// ---------------------------------------------------------------------------

describe("PathFacade — adoptEngine", () => {
  it("seeds state$ from a pre-started engine", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());

    const facade = new PathFacade();
    facade.adoptEngine(engine);

    expect(latestState(facade)).toMatchObject({ pathId: "main", stepId: "step1" });
  });

  it("follows navigation on the adopted engine", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());

    const facade = new PathFacade();
    facade.adoptEngine(engine);
    await engine.next();
    expect(latestState(facade)?.stepId).toBe("step2");
  });

  it("emits events$ from the adopted engine", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());

    const facade = new PathFacade();
    facade.adoptEngine(engine);

    const types: string[] = [];
    facade.events$.subscribe((e) => types.push(e.type));
    await engine.next();
    expect(types).toContain("stateChanged");
  });

  it("emits completed snapshot when the adopted engine completes", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());

    const facade = new PathFacade();
    facade.adoptEngine(engine);
    await engine.next();
    await engine.next(); // completes
    expect(latestState(facade)?.status).toBe("completed");
  });

  it("works with fromState-restored engines", async () => {
    const engine1 = new PathEngine();
    const pathDef = twoStepPath("test");
    await engine1.start(pathDef, { count: 5 });
    await engine1.next();
    const state = engine1.exportState()!;

    const engine2 = PathEngine.fromState(state, { test: pathDef });

    const facade = new PathFacade();
    facade.adoptEngine(engine2);
    expect(latestState(facade)?.stepId).toBe("step2");
    expect(latestState(facade)?.data.count).toBe(5);
  });

  it("disconnects from the previous engine when adopting a new one", async () => {
    const engine1 = new PathEngine();
    await engine1.start(twoStepPath("first"));

    const facade = new PathFacade();
    facade.adoptEngine(engine1);
    expect(latestState(facade)?.pathId).toBe("first");

    const engine2 = new PathEngine();
    await engine2.start(twoStepPath("second"));
    facade.adoptEngine(engine2);
    expect(latestState(facade)?.pathId).toBe("second");

    // Navigation on old engine should not affect facade
    await engine1.next();
    expect(latestState(facade)?.pathId).toBe("second");
    expect(latestState(facade)?.stepId).toBe("step1");
  });
});

// ---------------------------------------------------------------------------
// services
// ---------------------------------------------------------------------------

describe("PathFacade — services", () => {
  it("is null by default", () => {
    const facade = new PathFacade();
    expect(facade.services).toBeNull();
  });

  it("can be set and read back untyped", () => {
    const facade = new PathFacade();
    const svc = { api: { submit: () => {} } };
    facade.services = svc;
    expect(facade.services).toBe(svc);
  });

  it("is exposed via usePathContext — type assertion narrows the value", () => {
    // usePathContext() requires Angular DI (inject()), so we test the facade
    // property directly — the return mapping is a trivial `facade.services as TServices`.
    interface MyServices { label: string }
    const facade = new PathFacade();
    facade.services = { label: "hello" } as MyServices;
    expect((facade.services as MyServices).label).toBe("hello");
  });

  it("can be updated after initial set", () => {
    const facade = new PathFacade();
    facade.services = { version: 1 };
    expect((facade.services as { version: number }).version).toBe(1);
    facade.services = { version: 2 };
    expect((facade.services as { version: number }).version).toBe(2);
  });
});
