// @vitest-environment jsdom
import { createElement } from "react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { PathDefinition, PathEvent } from "@pathwrite/core";
import { usePath, PathProvider, usePathContext } from "../src/index";
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
    expect(result.current.snapshot?.args).toMatchObject({ owner: "test", value: 42 });
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

  it("setArg() updates the arg and is visible in the snapshot", async () => {
    const { result } = renderHook(() => usePath());
    await act(() => result.current.start(twoStepPath(), { label: "old" }));
    await act(() => result.current.setArg("label", "new"));
    expect(result.current.snapshot?.args.label).toBe("new");
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
    expect(second.setArg).toBe(first.setArg);
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

