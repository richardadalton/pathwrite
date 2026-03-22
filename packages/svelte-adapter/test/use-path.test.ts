import { describe, expect, it, vi, beforeEach } from "vitest";
import { PathData, PathDefinition, PathEngine, PathEvent, PathSnapshot } from "@daltonr/pathwrite-core";

// ---------------------------------------------------------------------------
// Mock the .svelte component import — Vite cannot parse .svelte without the
// Svelte plugin, but we don't need the component for unit tests.
// ---------------------------------------------------------------------------

vi.mock("../src/PathShell.svelte", () => ({ default: {} }));

// ---------------------------------------------------------------------------
// Mock Svelte lifecycle — usePath() calls onDestroy() which requires
// a component context. We mock it to capture the cleanup callback.
// ---------------------------------------------------------------------------

let destroyCallbacks: Array<() => void> = [];
let contextStore = new Map<unknown, unknown>();

vi.mock("svelte", async () => {
  const actual = await vi.importActual<typeof import("svelte")>("svelte");
  return {
    ...actual,
    onDestroy: (fn: () => void) => { destroyCallbacks.push(fn); },
    getContext: (key: unknown) => contextStore.get(key),
    setContext: (key: unknown, value: unknown) => { contextStore.set(key, value); }
  };
});

// Import AFTER mocking so the mock is in place
import { usePath, getPathContext, setPathContext, bindData } from "../src/index.svelte";
import type { UsePathOptions, UsePathReturn, PathContext } from "../src/index.svelte";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function twoStepPath(id = "main"): PathDefinition {
  return { id, steps: [{ id: "step1" }, { id: "step2" }] };
}

function threeStepPath(id = "w"): PathDefinition {
  return { id, steps: [{ id: "a" }, { id: "b" }, { id: "c" }] };
}

function createPath(options?: UsePathOptions): UsePathReturn {
  return usePath(options);
}

/** Helper to read the reactive snapshot value */
function snap(path: UsePathReturn): PathSnapshot | null {
  return path.snapshot;
}

beforeEach(() => {
  destroyCallbacks = [];
  contextStore.clear();
});

// ---------------------------------------------------------------------------
// snapshot
// ---------------------------------------------------------------------------

describe("usePath — snapshot", () => {
  it("starts as null before any path is launched", () => {
    const path = createPath();
    expect(snap(path)).toBeNull();
  });

  it("returns the current step snapshot when a path starts", async () => {
    const path = createPath();
    await path.start(twoStepPath());
    expect(snap(path)).toMatchObject({ pathId: "main", stepId: "step1" });
  });

  it("updates as navigation progresses", async () => {
    const path = createPath();
    await path.start(twoStepPath());
    expect(snap(path)?.stepId).toBe("step1");
    await path.next();
    expect(snap(path)?.stepId).toBe("step2");
  });

  it("returns null when the path completes", async () => {
    const path = createPath();
    await path.start(twoStepPath());
    await path.next();
    await path.next();
    expect(snap(path)).toBeNull();
  });

  it("returns null when the path is cancelled", async () => {
    const path = createPath();
    await path.start(twoStepPath());
    await path.cancel();
    expect(snap(path)).toBeNull();
  });

  it("reflects the parent path snapshot after a sub-path completes", async () => {
    const path = createPath();
    await path.start(twoStepPath("parent"));
    await path.next();
    await path.startSubPath(twoStepPath("sub"));
    expect(snap(path)?.pathId).toBe("sub");

    await path.next();
    await path.next(); // complete sub → resume parent

    expect(snap(path)).toMatchObject({ pathId: "parent", stepId: "step2" });
  });

  it("reflects the parent path snapshot after a sub-path is cancelled", async () => {
    const path = createPath();
    await path.start(twoStepPath("parent"));
    await path.next();
    await path.startSubPath(twoStepPath("sub"));
    await path.cancel();
    expect(snap(path)).toMatchObject({ pathId: "parent", stepId: "step2" });
  });

  it("includes initial data passed to start", async () => {
    const path = createPath();
    await path.start(twoStepPath(), { owner: "test", value: 42 });
    expect(snap(path)?.data).toMatchObject({ owner: "test", value: 42 });
  });

  it("exposes progress as a number between 0 and 1", async () => {
    const path = createPath();
    await path.start(twoStepPath());
    expect(snap(path)?.progress).toBeGreaterThanOrEqual(0);
    expect(snap(path)?.progress).toBeLessThanOrEqual(1);
  });

  it("exposes isFirstStep and isLastStep flags", async () => {
    const path = createPath();
    await path.start(twoStepPath());
    expect(snap(path)?.isFirstStep).toBe(true);
    expect(snap(path)?.isLastStep).toBe(false);
    await path.next();
    expect(snap(path)?.isFirstStep).toBe(false);
    expect(snap(path)?.isLastStep).toBe(true);
  });

  it("exposes the steps array with status", async () => {
    const path = createPath();
    await path.start(twoStepPath());
    const steps = snap(path)?.steps;
    expect(steps).toHaveLength(2);
    expect(steps?.[0]).toMatchObject({ id: "step1", status: "current" });
    expect(steps?.[1]).toMatchObject({ id: "step2", status: "upcoming" });
  });

  it("marks completed steps in the steps array", async () => {
    const path = createPath();
    await path.start(twoStepPath());
    await path.next();
    const steps = snap(path)?.steps;
    expect(steps?.[0]).toMatchObject({ id: "step1", status: "completed" });
    expect(steps?.[1]).toMatchObject({ id: "step2", status: "current" });
  });
});

// ---------------------------------------------------------------------------
// events (onEvent callback)
// ---------------------------------------------------------------------------

describe("usePath — events", () => {
  it("calls onEvent for stateChanged on start and navigation", async () => {
    const onEvent = vi.fn();
    const path = createPath({ onEvent });

    await path.start(twoStepPath());
    await path.next();

    const stateChangedCount = onEvent.mock.calls.filter(
      (args) => (args[0] as PathEvent).type === "stateChanged"
    ).length;
    expect(stateChangedCount).toBeGreaterThanOrEqual(2);
  });

  it("calls onEvent with completed when the path finishes", async () => {
    const onEvent = vi.fn();
    const path = createPath({ onEvent });

    await path.start(twoStepPath());
    await path.next();
    await path.next();

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "completed", pathId: "main" })
    );
  });

  it("calls onEvent with cancelled when cancel is called", async () => {
    const onEvent = vi.fn();
    const path = createPath({ onEvent });

    await path.start(twoStepPath());
    await path.cancel();

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "cancelled", pathId: "main" })
    );
  });

  it("calls onEvent with resumed when a sub-path completes", async () => {
    const onEvent = vi.fn();
    const path = createPath({ onEvent });

    await path.start(twoStepPath("parent"));
    await path.startSubPath(twoStepPath("sub"));
    await path.next();
    await path.next();

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "resumed",
        resumedPathId: "parent",
        fromSubPathId: "sub"
      })
    );
  });
});

// ---------------------------------------------------------------------------
// navigation methods
// ---------------------------------------------------------------------------

describe("usePath — navigation", () => {
  it("next() advances the step", async () => {
    const path = createPath();
    await path.start(twoStepPath());
    await path.next();
    expect(snap(path)?.stepId).toBe("step2");
  });

  it("previous() goes back a step", async () => {
    const path = createPath();
    await path.start(twoStepPath());
    await path.next();
    await path.previous();
    expect(snap(path)?.stepId).toBe("step1");
  });

  it("cancel() clears the active path", async () => {
    const path = createPath();
    await path.start(twoStepPath());
    await path.cancel();
    expect(snap(path)).toBeNull();
  });

  it("setData() updates the value and is visible in the snapshot", async () => {
    const path = createPath();
    await path.start(twoStepPath(), { label: "old" });
    await path.setData("label", "new");
    expect(snap(path)?.data.label).toBe("new");
  });

  it("setData() is type-safe when TData generic is provided", async () => {
    interface StepData extends PathData { label: string; count: number; }
    const path = usePath<StepData>();
    await path.start(twoStepPath(), { label: "old", count: 0 });
    await path.setData("label", "new");
    await path.setData("count", 99);
    expect(snap(path as unknown as UsePathReturn)?.data.label).toBe("new");
    expect(snap(path as unknown as UsePathReturn)?.data.count).toBe(99);
  });
});

// ---------------------------------------------------------------------------
// sub-path
// ---------------------------------------------------------------------------

describe("usePath — sub-path", () => {
  it("throws when startSubPath is called without an active path", () => {
    const path = createPath();
    expect(() => path.startSubPath(twoStepPath())).toThrow();
  });

  it("sets the sub-path as the active snapshot", async () => {
    const path = createPath();
    await path.start(twoStepPath("parent"));
    await path.startSubPath(twoStepPath("sub"));
    expect(snap(path)?.pathId).toBe("sub");
  });
});

// ---------------------------------------------------------------------------
// goToStep
// ---------------------------------------------------------------------------

describe("usePath — goToStep", () => {
  it("jumps to the target step by ID", async () => {
    const path = createPath();
    await path.start(threeStepPath());
    await path.goToStep("c");
    expect(snap(path)?.stepId).toBe("c");
  });
});

// ---------------------------------------------------------------------------
// goToStepChecked
// ---------------------------------------------------------------------------

describe("usePath — goToStepChecked", () => {
  it("navigates to the target step when the guard allows", async () => {
    const path = createPath();
    await path.start(threeStepPath());
    await path.goToStepChecked("c");
    expect(snap(path)?.stepId).toBe("c");
  });

  it("blocks navigation when canMoveNext returns false", async () => {
    const path = createPath();
    await path.start({
      id: "w",
      steps: [{ id: "a", canMoveNext: () => false }, { id: "b" }]
    });
    await path.goToStepChecked("b");
    expect(snap(path)?.stepId).toBe("a");
  });
});

// ---------------------------------------------------------------------------
// onDestroy cleanup
// ---------------------------------------------------------------------------

describe("usePath — cleanup", () => {
  it("registers a cleanup callback via onDestroy", () => {
    createPath();
    expect(destroyCallbacks.length).toBeGreaterThan(0);
  });

  it("does not throw when the destroy callback is invoked while a path is active", async () => {
    const path = createPath();
    await path.start(twoStepPath());
    expect(snap(path)?.stepId).toBe("step1");
    expect(() => {
      destroyCallbacks.forEach((cb) => cb());
    }).not.toThrow();
  });

  it("snapshot is a readonly getter (not directly settable)", () => {
    const path = createPath();
    // snapshot should be accessible as a getter
    expect(path.snapshot).toBeNull();
    // Attempting to set should be silently ignored or throw in strict mode
    const descriptor = Object.getOwnPropertyDescriptor(path, "snapshot");
    expect(descriptor?.get).toBeDefined();
    expect(descriptor?.set).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// restart
// ---------------------------------------------------------------------------

describe("usePath — restart()", () => {
  it("starts from step 1 when no path has been started", async () => {
    const path = createPath();
    await path.restart(twoStepPath());
    expect(snap(path)?.stepId).toBe("step1");
  });

  it("resets to step 1 from mid-flow", async () => {
    const path = createPath();
    await path.start(twoStepPath());
    await path.next();
    expect(snap(path)?.stepId).toBe("step2");

    await path.restart(twoStepPath());
    expect(snap(path)?.stepId).toBe("step1");
  });

  it("restarts after completion (snapshot was null)", async () => {
    const path = createPath();
    await path.start(twoStepPath());
    await path.next();
    await path.next();
    expect(snap(path)).toBeNull();

    await path.restart(twoStepPath());
    expect(snap(path)?.stepId).toBe("step1");
  });

  it("seeds fresh initialData on restart", async () => {
    const path = createPath();
    await path.start(twoStepPath());
    await path.setData("name" as never, "Alice");

    await path.restart(twoStepPath(), { name: "Bob" });
    expect(snap(path)?.data.name).toBe("Bob");
  });
});

// ---------------------------------------------------------------------------
// External engine option
// ---------------------------------------------------------------------------

describe("usePath — external engine", () => {
  it("seeds snapshot from a pre-started engine", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath(), { owner: "ext" });
    await engine.next(); // step2

    const path = createPath({ engine });
    expect(snap(path)?.stepId).toBe("step2");
    expect(snap(path)?.data.owner).toBe("ext");
  });

  it("tracks state changes made through the external engine", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());

    const path = createPath({ engine });
    expect(snap(path)?.stepId).toBe("step1");

    await engine.next();
    expect(snap(path)?.stepId).toBe("step2");
  });

  it("tracks state changes made through usePath helpers", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());

    const path = createPath({ engine });
    await path.next();
    expect(snap(path)?.stepId).toBe("step2");
    expect(engine.snapshot()?.stepId).toBe("step2");
  });

  it("fires onEvent for external engine events", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());

    const events: PathEvent[] = [];
    createPath({ engine, onEvent: (e) => events.push(e) });

    await engine.next();
    expect(events.some((e) => e.type === "stateChanged")).toBe(true);
  });

  it("sets snapshot to null when the external engine completes", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());

    const path = createPath({ engine });
    await engine.next();
    await engine.next(); // completes
    expect(snap(path)).toBeNull();
  });

  it("works with fromState-restored engines", async () => {
    const engine1 = new PathEngine();
    const pathDef = twoStepPath("test");
    await engine1.start(pathDef, { count: 5 });
    await engine1.next();
    const state = engine1.exportState()!;

    const engine2 = PathEngine.fromState(state, { test: pathDef });

    const path = createPath({ engine: engine2 });
    expect(snap(path)?.stepId).toBe("step2");
    expect(snap(path)?.data.count).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Context API — getPathContext / setPathContext
// ---------------------------------------------------------------------------

describe("getPathContext / setPathContext", () => {
  it("throws when called outside a PathShell (no context set)", () => {
    expect(() => getPathContext()).toThrow(
      /getPathContext\(\) must be called from a component inside a <PathShell>/
    );
  });

  it("returns the context set by setPathContext", async () => {
    const path = createPath();
    await path.start(twoStepPath());

    const ctx: PathContext = {
      get snapshot() { return path.snapshot; },
      next: path.next,
      previous: path.previous,
      cancel: path.cancel,
      goToStep: path.goToStep,
      goToStepChecked: path.goToStepChecked,
      setData: path.setData,
      restart: async () => {}
    };

    setPathContext(ctx);
    const retrieved = getPathContext();
    expect(retrieved).toBe(ctx);
  });

  it("provides a working snapshot through context", async () => {
    const path = createPath();
    await path.start(twoStepPath());

    setPathContext({
      get snapshot() { return path.snapshot; },
      next: path.next,
      previous: path.previous,
      cancel: path.cancel,
      goToStep: path.goToStep,
      goToStepChecked: path.goToStepChecked,
      setData: path.setData,
      restart: async () => {}
    });

    const ctx = getPathContext();
    expect(ctx.snapshot?.stepId).toBe("step1");

    await ctx.next();
    expect(ctx.snapshot?.stepId).toBe("step2");
  });
});

// ---------------------------------------------------------------------------
// bindData helper
// ---------------------------------------------------------------------------

describe("bindData", () => {
  it("reads the initial value from the snapshot", async () => {
    const path = usePath<{ name: string }>();
    await path.start(twoStepPath(), { name: "Alice" });

    const name = bindData(() => path.snapshot, path.setData, "name");
    expect(name.value).toBe("Alice");
  });

  it("updates when the snapshot data changes", async () => {
    const path = usePath<{ name: string }>();
    await path.start(twoStepPath(), { name: "Alice" });

    const name = bindData(() => path.snapshot, path.setData, "name");
    expect(name.value).toBe("Alice");

    await path.setData("name", "Bob");
    expect(name.value).toBe("Bob");
  });

  it("calls setData when set() is invoked", async () => {
    const path = usePath<{ name: string }>();
    await path.start(twoStepPath(), { name: "Alice" });

    const name = bindData(() => path.snapshot, path.setData, "name");
    name.set("Charlie");

    // Wait for async setData to complete
    await new Promise((r) => setTimeout(r, 10));
    expect(name.value).toBe("Charlie");
  });

  it("returns undefined when snapshot is null", () => {
    const path = usePath<{ name: string }>();
    const name = bindData(() => path.snapshot, path.setData, "name");
    expect(name.value).toBeUndefined();
  });

  it("has value getter and set method on the returned object", async () => {
    const path = usePath<{ name: string }>();
    await path.start(twoStepPath(), { name: "Alice" });

    const name = bindData(() => path.snapshot, path.setData, "name");
    const descriptor = Object.getOwnPropertyDescriptor(name, "value");
    expect(descriptor?.get).toBeDefined();
    expect(typeof name.set).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// Guards and validation
// ---------------------------------------------------------------------------

describe("usePath — guards and validation", () => {
  it("canMoveNext reflects guard result in snapshot", async () => {
    const path = createPath();
    await path.start({
      id: "w",
      steps: [
        { id: "s1", canMoveNext: ({ data }) => !!data.name },
        { id: "s2" }
      ]
    }, { name: "" });

    expect(snap(path)?.canMoveNext).toBe(false);

    await path.setData("name", "Alice");
    expect(snap(path)?.canMoveNext).toBe(true);
  });

  it("fieldMessages appear in snapshot", async () => {
    const path = createPath();
    await path.start({
      id: "w",
      steps: [
        {
          id: "s1",
          fieldMessages: ({ data }) => ({
            name: data.name ? undefined : "Name is required"
          })
        },
        { id: "s2" }
      ]
    }, { name: "" });

    expect(snap(path)?.fieldMessages).toMatchObject({ name: "Name is required" });

    await path.setData("name", "Alice");
    expect(snap(path)?.fieldMessages).toEqual({});
  });

  it("fieldMessages auto-derives canMoveNext", async () => {
    const path = createPath();
    await path.start({
      id: "w",
      steps: [
        {
          id: "s1",
          fieldMessages: ({ data }) => ({
            name: data.name ? undefined : "Required"
          })
        },
        { id: "s2" }
      ]
    }, { name: "" });

    expect(snap(path)?.canMoveNext).toBe(false);
    await path.setData("name", "Alice");
    expect(snap(path)?.canMoveNext).toBe(true);
  });

  it("next() is blocked when canMoveNext returns false", async () => {
    const path = createPath();
    await path.start({
      id: "w",
      steps: [
        { id: "s1", canMoveNext: () => false },
        { id: "s2" }
      ]
    });

    await path.next();
    expect(snap(path)?.stepId).toBe("s1"); // didn't move
  });

  it("shouldSkip causes a step to be skipped during next()", async () => {
    const path = createPath();
    await path.start({
      id: "w",
      steps: [
        { id: "s1" },
        { id: "s2", shouldSkip: () => true },
        { id: "s3" }
      ]
    });

    await path.next();
    expect(snap(path)?.stepId).toBe("s3"); // s2 was skipped
  });
});

