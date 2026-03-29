// @vitest-environment jsdom
import { createElement } from "react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderHook, render, act } from "@testing-library/react";
import { PathData, PathDefinition, PathEngine, PathEvent } from "@daltonr/pathwrite-core";
import { usePath, PathProvider, PathShell, usePathContext } from "../src/index";
import type { UsePathOptions } from "../src/index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function twoStepPath(id = "main"): PathDefinition {
  return { id, steps: [{ id: "step1" }, { id: "step2" }] };
}

// ---------------------------------------------------------------------------
// snapshot
// ---------------------------------------------------------------------------

describe("usePath — snapshot", () => {
  it("starts as null before any path is launched", () => {
    const { result } = renderHook(() => usePath());
    expect(result.current.snapshot).toBeNull();
  });

  it("returns the current step snapshot when a path starts", async () => {
    const { result } = renderHook(() => usePath());
    await act(() => result.current.start(twoStepPath()));
    expect(result.current.snapshot).toMatchObject({ pathId: "main", stepId: "step1" });
  });

  it("updates as navigation progresses", async () => {
    const { result } = renderHook(() => usePath());
    await act(() => result.current.start(twoStepPath()));
    expect(result.current.snapshot?.stepId).toBe("step1");
    await act(() => result.current.next());
    expect(result.current.snapshot?.stepId).toBe("step2");
  });

  it("returns null when the path completes", async () => {
    const { result } = renderHook(() => usePath());
    await act(() => result.current.start(twoStepPath()));
    await act(() => result.current.next());
    await act(() => result.current.next());
    expect(result.current.snapshot).toBeNull();
  });

  it("returns null when the path is cancelled", async () => {
    const { result } = renderHook(() => usePath());
    await act(() => result.current.start(twoStepPath()));
    await act(() => result.current.cancel());
    expect(result.current.snapshot).toBeNull();
  });

  it("reflects the parent path snapshot after a sub-path completes", async () => {
    const { result } = renderHook(() => usePath());
    await act(() => result.current.start(twoStepPath("parent")));
    await act(() => result.current.next());
    await act(() => result.current.startSubPath(twoStepPath("sub")));
    expect(result.current.snapshot?.pathId).toBe("sub");

    await act(() => result.current.next());
    await act(() => result.current.next()); // complete sub → resume parent

    expect(result.current.snapshot).toMatchObject({ pathId: "parent", stepId: "step2" });
  });

  it("reflects the parent path snapshot after a sub-path is cancelled", async () => {
    const { result } = renderHook(() => usePath());
    await act(() => result.current.start(twoStepPath("parent")));
    await act(() => result.current.next());
    await act(() => result.current.startSubPath(twoStepPath("sub")));
    await act(() => result.current.cancel());
    expect(result.current.snapshot).toMatchObject({ pathId: "parent", stepId: "step2" });
  });

  it("includes initial data passed to start", async () => {
    const { result } = renderHook(() => usePath());
    await act(() => result.current.start(twoStepPath(), { owner: "test", value: 42 }));
    expect(result.current.snapshot?.data).toMatchObject({ owner: "test", value: 42 });
  });
});

// ---------------------------------------------------------------------------
// events (onEvent callback)
// ---------------------------------------------------------------------------

describe("usePath — events", () => {
  it("calls onEvent for stateChanged on start and navigation", async () => {
    const onEvent = vi.fn();
    const { result } = renderHook(() => usePath({ onEvent }));

    await act(() => result.current.start(twoStepPath()));
    await act(() => result.current.next());

    const stateChangedCount = onEvent.mock.calls.filter(
      (args) => (args[0] as PathEvent).type === "stateChanged"
    ).length;
    expect(stateChangedCount).toBeGreaterThanOrEqual(2);
  });

  it("calls onEvent with completed when the path finishes", async () => {
    const onEvent = vi.fn();
    const { result } = renderHook(() => usePath({ onEvent }));

    await act(() => result.current.start(twoStepPath()));
    await act(() => result.current.next());
    await act(() => result.current.next());

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "completed", pathId: "main" })
    );
  });

  it("calls onEvent with cancelled when cancel is called", async () => {
    const onEvent = vi.fn();
    const { result } = renderHook(() => usePath({ onEvent }));

    await act(() => result.current.start(twoStepPath()));
    await act(() => result.current.cancel());

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "cancelled", pathId: "main" })
    );
  });

  it("calls onEvent with resumed when a sub-path completes", async () => {
    const onEvent = vi.fn();
    const { result } = renderHook(() => usePath({ onEvent }));

    await act(() => result.current.start(twoStepPath("parent")));
    await act(() => result.current.startSubPath(twoStepPath("sub")));
    await act(() => result.current.next());
    await act(() => result.current.next());

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "resumed",
        resumedPathId: "parent",
        fromSubPathId: "sub"
      })
    );
  });

  it("uses the latest onEvent callback without re-subscribing", async () => {
    const firstCallback = vi.fn();
    const secondCallback = vi.fn();
    const { result, rerender } = renderHook(
      (props: UsePathOptions) => usePath(props),
      { initialProps: { onEvent: firstCallback } }
    );

    await act(() => result.current.start(twoStepPath()));
    expect(firstCallback).toHaveBeenCalled();
    expect(secondCallback).not.toHaveBeenCalled();

    firstCallback.mockClear();
    rerender({ onEvent: secondCallback });

    await act(() => result.current.next());
    expect(secondCallback).toHaveBeenCalled();
    expect(firstCallback).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// navigation methods
// ---------------------------------------------------------------------------

describe("usePath — navigation", () => {
  it("next() advances the step", async () => {
    const { result } = renderHook(() => usePath());
    await act(() => result.current.start(twoStepPath()));
    await act(() => result.current.next());
    expect(result.current.snapshot?.stepId).toBe("step2");
  });

  it("previous() goes back a step", async () => {
    const { result } = renderHook(() => usePath());
    await act(() => result.current.start(twoStepPath()));
    await act(() => result.current.next());
    await act(() => result.current.previous());
    expect(result.current.snapshot?.stepId).toBe("step1");
  });

  it("cancel() clears the active path", async () => {
    const { result } = renderHook(() => usePath());
    await act(() => result.current.start(twoStepPath()));
    await act(() => result.current.cancel());
    expect(result.current.snapshot).toBeNull();
  });

  it("setData() updates the value and is visible in the snapshot", async () => {
    const { result } = renderHook(() => usePath());
    await act(() => result.current.start(twoStepPath(), { label: "old" }));
    await act(() => result.current.setData("label", "new"));
    expect(result.current.snapshot?.data.label).toBe("new");
  });

  it("setData() is type-safe when TData generic is provided", async () => {
    interface StepData extends PathData { label: string; count: number; }
    const { result } = renderHook(() => usePath<StepData>());
    await act(() => result.current.start(twoStepPath(), { label: "old", count: 0 }));
    await act(() => result.current.setData("label", "new"));
    await act(() => result.current.setData("count", 99));
    expect(result.current.snapshot?.data.label).toBe("new");
    expect(result.current.snapshot?.data.count).toBe(99);
  });

  it("action callbacks are referentially stable across re-renders", async () => {
    const { result, rerender } = renderHook(() => usePath());
    const first = result.current;
    rerender();
    const second = result.current;

    expect(second.start).toBe(first.start);
    expect(second.startSubPath).toBe(first.startSubPath);
    expect(second.next).toBe(first.next);
    expect(second.previous).toBe(first.previous);
    expect(second.cancel).toBe(first.cancel);
    expect(second.setData).toBe(first.setData);
  });
});

// ---------------------------------------------------------------------------
// sub-path
// ---------------------------------------------------------------------------

describe("usePath — sub-path", () => {
  it("throws when startSubPath is called without an active path", () => {
    const { result } = renderHook(() => usePath());
    expect(() => result.current.startSubPath(twoStepPath())).toThrow();
  });

  it("sets the sub-path as the active snapshot", async () => {
    const { result } = renderHook(() => usePath());
    await act(() => result.current.start(twoStepPath("parent")));
    await act(() => result.current.startSubPath(twoStepPath("sub")));
    expect(result.current.snapshot?.pathId).toBe("sub");
  });
});

// ---------------------------------------------------------------------------
// goToStep
// ---------------------------------------------------------------------------

describe("usePath — goToStep", () => {
  it("jumps to the target step by ID", async () => {
    const { result } = renderHook(() => usePath());
    await act(() => result.current.start({ id: "w", steps: [{ id: "a" }, { id: "b" }, { id: "c" }] }));
    await act(() => result.current.goToStep("c"));
    expect(result.current.snapshot?.stepId).toBe("c");
  });

  it("goToStep callback is referentially stable across re-renders", () => {
    const { result, rerender } = renderHook(() => usePath());
    const first = result.current.goToStep;
    rerender();
    expect(result.current.goToStep).toBe(first);
  });
});

// ---------------------------------------------------------------------------
// goToStepChecked
// ---------------------------------------------------------------------------

describe("usePath — goToStepChecked", () => {
  it("navigates to the target step when the guard allows", async () => {
    const { result } = renderHook(() => usePath());
    await act(() => result.current.start({ id: "w", steps: [{ id: "a" }, { id: "b" }, { id: "c" }] }));
    await act(() => result.current.goToStepChecked("c"));
    expect(result.current.snapshot?.stepId).toBe("c");
  });

  it("blocks navigation when canMoveNext returns false", async () => {
    const { result } = renderHook(() => usePath());
    await act(() => result.current.start({
      id: "w",
      steps: [{ id: "a", canMoveNext: () => ({ allowed: false }) }, { id: "b" }]
    }));
    await act(() => result.current.goToStepChecked("b"));
    expect(result.current.snapshot?.stepId).toBe("a");
  });

  it("goToStepChecked callback is referentially stable across re-renders", () => {
    const { result, rerender } = renderHook(() => usePath());
    const first = result.current.goToStepChecked;
    rerender();
    expect(result.current.goToStepChecked).toBe(first);
  });
});

// ---------------------------------------------------------------------------
// PathProvider + usePathContext
// ---------------------------------------------------------------------------

describe("PathProvider + usePathContext", () => {
  it("provides path state to child hooks", () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(PathProvider, null, children);
    const { result } = renderHook(() => usePathContext(), { wrapper });
    expect(result.current.snapshot).toBeNull();
  });

  it("allows navigation through the provided context", async () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(PathProvider, null, children);
    const { result } = renderHook(() => usePathContext(), { wrapper });

    await act(() => result.current.start(twoStepPath()));
    expect(result.current.snapshot?.stepId).toBe("step1");

    await act(() => result.current.next());
    expect(result.current.snapshot?.stepId).toBe("step2");
  });

  it("throws when usePathContext is used outside a PathProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => usePathContext())).toThrow(
      "usePathContext must be used within a <PathProvider>."
    );
    spy.mockRestore();
  });

  it("forwards onEvent from PathProvider props", async () => {
    const onEvent = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(PathProvider, { onEvent }, children);
    const { result } = renderHook(() => usePathContext(), { wrapper });

    await act(() => result.current.start(twoStepPath()));
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "stateChanged" })
    );
  });

  it("exposes services passed to PathProvider via usePathContext", () => {
    const services = { greet: () => "hello" };
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(PathProvider, { services }, children);
    const { result } = renderHook(
      () => usePathContext<PathData, typeof services>(),
      { wrapper }
    );
    expect(result.current.services).toBe(services);
    expect(result.current.services.greet()).toBe("hello");
  });

  it("exposes services passed to PathShell via usePathContext inside a step", async () => {
    const services = { getValue: () => 42 };
    let capturedServices: typeof services | null = null;

    function StepComponent() {
      const ctx = usePathContext<PathData, typeof services>();
      capturedServices = ctx.services;
      return null;
    }

    const { unmount } = render(
      createElement(PathShell, {
        path: twoStepPath(),
        services,
        steps: { step1: createElement(StepComponent) }
      } as any)
    );

    await act(() => Promise.resolve());
    expect(capturedServices).toBe(services);
    expect(capturedServices!.getValue()).toBe(42);
    unmount();
  });

  it("same services object reaches both guards and step components", async () => {
    const services = { check: vi.fn(() => true) };
    let servicesInGuard: typeof services | null = null;
    let servicesInStep: typeof services | null = null;

    function StepComponent() {
      const ctx = usePathContext<PathData, typeof services>();
      servicesInStep = ctx.services;
      return null;
    }

    const path: PathDefinition<PathData> = {
      id: "test",
      steps: [
        {
          id: "step1",
          canMoveNext: (ctx) => {
            // Guards close over services via the factory pattern — verify same reference
            servicesInGuard = services;
            return services.check() ? true : { allowed: false };
          }
        },
        { id: "step2" }
      ]
    };

    const { unmount } = render(
      createElement(PathShell, {
        path,
        services,
        steps: { step1: createElement(StepComponent), step2: createElement(StepComponent) }
      } as any)
    );

    await act(() => Promise.resolve());
    expect(servicesInStep).toBe(services);

    await act(() => {
      const shell = document.querySelector(".pw-shell__btn--next") as HTMLButtonElement;
      shell?.click();
    });

    expect(servicesInGuard).toBe(services);
    expect(servicesInGuard).toBe(servicesInStep);
    unmount();
  });
});

// ---------------------------------------------------------------------------
// cleanup on unmount
// ---------------------------------------------------------------------------

describe("usePath — cleanup", () => {
  it("does not throw when the component unmounts while a path is active", async () => {
    const { result, unmount } = renderHook(() => usePath());
    await act(() => result.current.start(twoStepPath()));
    expect(result.current.snapshot?.stepId).toBe("step1");
    expect(() => unmount()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// restart
// ---------------------------------------------------------------------------

describe("usePath — restart()", () => {
  it("resets to step 1 from mid-flow", async () => {
    const { result } = renderHook(() => usePath());
    await act(() => result.current.start(twoStepPath()));
    await act(() => result.current.next());
    expect(result.current.snapshot?.stepId).toBe("step2");

    await act(() => result.current.restart());
    expect(result.current.snapshot?.stepId).toBe("step1");
  });

  it("restarts after completion (snapshot was null)", async () => {
    const { result } = renderHook(() => usePath());
    await act(() => result.current.start(twoStepPath()));
    await act(() => result.current.next());
    await act(() => result.current.next());
    expect(result.current.snapshot).toBeNull();

    await act(() => result.current.restart());
    expect(result.current.snapshot?.stepId).toBe("step1");
  });

  it("returns to original initialData passed to start()", async () => {
    const { result } = renderHook(() => usePath());
    await act(() => result.current.start(twoStepPath(), { name: "Bob" }));
    await act(() => result.current.setData("name" as never, "Alice"));
    expect(result.current.snapshot?.data.name).toBe("Alice");

    await act(() => result.current.restart());
    expect(result.current.snapshot?.data.name).toBe("Bob");
  });
});

// ---------------------------------------------------------------------------
// external engine
// ---------------------------------------------------------------------------

describe("usePath — external engine", () => {
  it("seeds snapshot from a pre-started engine", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());

    const { result } = renderHook(() => usePath({ engine }));
    expect(result.current.snapshot).toMatchObject({ pathId: "main", stepId: "step1" });
  });

  it("follows navigation on the external engine", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());

    const { result } = renderHook(() => usePath({ engine }));
    await act(() => engine.next());
    expect(result.current.snapshot?.stepId).toBe("step2");
  });

  it("receives events from the external engine", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());

    const events: PathEvent[] = [];
    const { result } = renderHook(() => usePath({ engine, onEvent: (e) => events.push(e) }));
    await act(() => engine.next());
    expect(events.some((e) => e.type === "stateChanged")).toBe(true);
  });

  it("sets snapshot to null when the external engine completes", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());

    const { result } = renderHook(() => usePath({ engine }));
    await act(() => engine.next());
    await act(() => engine.next()); // completes
    expect(result.current.snapshot).toBeNull();
  });

  it("works with fromState-restored engines", async () => {
    const engine1 = new PathEngine();
    const pathDef = twoStepPath("test");
    await engine1.start(pathDef, { count: 5 });
    await engine1.next();
    const state = engine1.exportState()!;

    const engine2 = PathEngine.fromState(state, { test: pathDef });

    const { result } = renderHook(() => usePath({ engine: engine2 }));
    expect(result.current.snapshot?.stepId).toBe("step2");
    expect(result.current.snapshot?.data.count).toBe(5);
  });
});
