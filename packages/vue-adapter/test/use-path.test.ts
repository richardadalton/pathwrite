import { describe, expect, it, vi } from "vitest";
import { effectScope } from "vue";
import { PathData, PathDefinition, PathEvent } from "@daltonr/pathwrite-core";
import { usePath } from "../src/index";
import type { UsePathOptions } from "../src/index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function twoStepPath(id = "main"): PathDefinition {
  return { id, steps: [{ id: "step1" }, { id: "step2" }] };
}

/** Runs usePath inside a Vue effect scope so onScopeDispose works. */
function createPath(options?: UsePathOptions) {
  const scope = effectScope();
  const path = scope.run(() => usePath(options))!;
  return { path, scope };
}

// ---------------------------------------------------------------------------
// snapshot
// ---------------------------------------------------------------------------

describe("usePath — snapshot", () => {
  it("starts as null before any path is launched", () => {
    const { path } = createPath();
    expect(path.snapshot.value).toBeNull();
  });

  it("returns the current step snapshot when a path starts", async () => {
    const { path } = createPath();
    await path.start(twoStepPath());
    expect(path.snapshot.value).toMatchObject({ pathId: "main", stepId: "step1" });
  });

  it("updates as navigation progresses", async () => {
    const { path } = createPath();
    await path.start(twoStepPath());
    expect(path.snapshot.value?.stepId).toBe("step1");
    await path.next();
    expect(path.snapshot.value?.stepId).toBe("step2");
  });

  it("returns null when the path completes", async () => {
    const { path } = createPath();
    await path.start(twoStepPath());
    await path.next();
    await path.next();
    expect(path.snapshot.value).toBeNull();
  });

  it("returns null when the path is cancelled", async () => {
    const { path } = createPath();
    await path.start(twoStepPath());
    await path.cancel();
    expect(path.snapshot.value).toBeNull();
  });

  it("reflects the parent path snapshot after a sub-path completes", async () => {
    const { path } = createPath();
    await path.start(twoStepPath("parent"));
    await path.next();
    await path.startSubPath(twoStepPath("sub"));
    expect(path.snapshot.value?.pathId).toBe("sub");

    await path.next();
    await path.next(); // complete sub → resume parent

    expect(path.snapshot.value).toMatchObject({ pathId: "parent", stepId: "step2" });
  });

  it("reflects the parent path snapshot after a sub-path is cancelled", async () => {
    const { path } = createPath();
    await path.start(twoStepPath("parent"));
    await path.next();
    await path.startSubPath(twoStepPath("sub"));
    await path.cancel();
    expect(path.snapshot.value).toMatchObject({ pathId: "parent", stepId: "step2" });
  });

  it("includes initial data passed to start", async () => {
    const { path } = createPath();
    await path.start(twoStepPath(), { owner: "test", value: 42 });
    expect(path.snapshot.value?.data).toMatchObject({ owner: "test", value: 42 });
  });
});

// ---------------------------------------------------------------------------
// events (onEvent callback)
// ---------------------------------------------------------------------------

describe("usePath — events", () => {
  it("calls onEvent for stateChanged on start and navigation", async () => {
    const onEvent = vi.fn();
    const { path } = createPath({ onEvent });

    await path.start(twoStepPath());
    await path.next();

    const stateChangedCount = onEvent.mock.calls.filter(
      (args) => (args[0] as PathEvent).type === "stateChanged"
    ).length;
    expect(stateChangedCount).toBeGreaterThanOrEqual(2);
  });

  it("calls onEvent with completed when the path finishes", async () => {
    const onEvent = vi.fn();
    const { path } = createPath({ onEvent });

    await path.start(twoStepPath());
    await path.next();
    await path.next();

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "completed", pathId: "main" })
    );
  });

  it("calls onEvent with cancelled when cancel is called", async () => {
    const onEvent = vi.fn();
    const { path } = createPath({ onEvent });

    await path.start(twoStepPath());
    await path.cancel();

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "cancelled", pathId: "main" })
    );
  });

  it("calls onEvent with resumed when a sub-path completes", async () => {
    const onEvent = vi.fn();
    const { path } = createPath({ onEvent });

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
    const { path } = createPath();
    await path.start(twoStepPath());
    await path.next();
    expect(path.snapshot.value?.stepId).toBe("step2");
  });

  it("previous() goes back a step", async () => {
    const { path } = createPath();
    await path.start(twoStepPath());
    await path.next();
    await path.previous();
    expect(path.snapshot.value?.stepId).toBe("step1");
  });

  it("cancel() clears the active path", async () => {
    const { path } = createPath();
    await path.start(twoStepPath());
    await path.cancel();
    expect(path.snapshot.value).toBeNull();
  });

  it("setData() updates the value and is visible in the snapshot", async () => {
    const { path } = createPath();
    await path.start(twoStepPath(), { label: "old" });
    await path.setData("label", "new");
    expect(path.snapshot.value?.data.label).toBe("new");
  });

  it("setData() is type-safe when TData generic is provided", async () => {
    interface StepData extends PathData { label: string; count: number; }
    const scope = effectScope();
    let path!: ReturnType<typeof usePath<StepData>>;
    scope.run(() => { path = usePath<StepData>(); });
    await path.start(twoStepPath(), { label: "old", count: 0 });
    await path.setData("label", "new");
    await path.setData("count", 99);
    expect(path.snapshot.value?.data.label).toBe("new");
    expect(path.snapshot.value?.data.count).toBe(99);
    scope.stop();
  });
});

// ---------------------------------------------------------------------------
// sub-path
// ---------------------------------------------------------------------------

describe("usePath — sub-path", () => {
  it("throws when startSubPath is called without an active path", () => {
    const { path } = createPath();
    expect(() => path.startSubPath(twoStepPath())).toThrow();
  });

  it("sets the sub-path as the active snapshot", async () => {
    const { path } = createPath();
    await path.start(twoStepPath("parent"));
    await path.startSubPath(twoStepPath("sub"));
    expect(path.snapshot.value?.pathId).toBe("sub");
  });
});

// ---------------------------------------------------------------------------
// goToStep
// ---------------------------------------------------------------------------

describe("usePath — goToStep", () => {
  it("jumps to the target step by ID", async () => {
    const { path } = createPath();
    await path.start({ id: "w", steps: [{ id: "a" }, { id: "b" }, { id: "c" }] });
    await path.goToStep("c");
    expect(path.snapshot.value?.stepId).toBe("c");
  });
});

// ---------------------------------------------------------------------------
// goToStepChecked
// ---------------------------------------------------------------------------

describe("usePath — goToStepChecked", () => {
  it("navigates to the target step when the guard allows", async () => {
    const { path } = createPath();
    await path.start({ id: "w", steps: [{ id: "a" }, { id: "b" }, { id: "c" }] });
    await path.goToStepChecked("c");
    expect(path.snapshot.value?.stepId).toBe("c");
  });

  it("blocks navigation when canMoveNext returns false", async () => {
    const { path } = createPath();
    await path.start({
      id: "w",
      steps: [{ id: "a", canMoveNext: () => false }, { id: "b" }]
    });
    await path.goToStepChecked("b");
    expect(path.snapshot.value?.stepId).toBe("a");
  });
});

// ---------------------------------------------------------------------------
// scope disposal
// ---------------------------------------------------------------------------

describe("usePath — scope disposal", () => {
  it("does not throw when the scope is disposed while a path is active", async () => {
    const { path, scope } = createPath();
    await path.start(twoStepPath());
    expect(path.snapshot.value?.stepId).toBe("step1");
    expect(() => scope.stop()).not.toThrow();
  });

  it("snapshot is readonly", async () => {
    const { path } = createPath();
    await path.start(twoStepPath());
    // TypeScript prevents assignment, but at runtime the ref is wrapped with readonly()
    expect(path.snapshot.value?.pathId).toBe("main");
  });
});

