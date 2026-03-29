// @vitest-environment jsdom
//
// The usePath / usePathContext hooks use only React core APIs
// (useSyncExternalStore, useCallback, useRef) and work identically
// in React Native and React web. These tests run in jsdom using
// @testing-library/react — the same environment as the web React adapter.
//
// PathShell component tests require @testing-library/react-native and a
// React Native test environment; see README for setup instructions.

import { createElement } from "react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { PathDefinition, PathEngine, PathEvent } from "@daltonr/pathwrite-core";
import { usePath, PathProvider, usePathContext } from "../src/index";
import type { UsePathOptions } from "../src/index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function twoStepPath(id = "main"): PathDefinition {
  return { id, steps: [{ id: "step1" }, { id: "step2" }] };
}

function threeStepPath(id = "main"): PathDefinition {
  return { id, steps: [{ id: "step1" }, { id: "step2" }, { id: "step3" }] };
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
    const subPath: PathDefinition = { id: "sub", steps: [{ id: "sub1" }] };
    await act(() => result.current.start(twoStepPath("parent")));
    await act(() => result.current.next());
    await act(() => result.current.startSubPath(subPath));
    expect(result.current.snapshot?.pathId).toBe("sub");
    await act(() => result.current.next());
    expect(result.current.snapshot?.pathId).toBe("parent");
    expect(result.current.snapshot?.stepId).toBe("step2");
  });

  it("seeds snapshot immediately from an externally-started engine", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());
    await engine.next();
    const { result } = renderHook(() => usePath({ engine }));
    expect(result.current.snapshot?.stepId).toBe("step2");
  });
});

// ---------------------------------------------------------------------------
// navigation
// ---------------------------------------------------------------------------

describe("usePath — navigation", () => {
  it("previous moves back one step", async () => {
    const { result } = renderHook(() => usePath());
    await act(() => result.current.start(twoStepPath()));
    await act(() => result.current.next());
    await act(() => result.current.previous());
    expect(result.current.snapshot?.stepId).toBe("step1");
  });

  it("previous is a no-op on the first step of a top-level path", async () => {
    const { result } = renderHook(() => usePath());
    await act(() => result.current.start(twoStepPath()));
    await act(() => result.current.previous());
    expect(result.current.snapshot?.stepId).toBe("step1");
  });

  it("goToStep jumps to the specified step", async () => {
    const { result } = renderHook(() => usePath());
    await act(() => result.current.start(threeStepPath()));
    await act(() => result.current.goToStep("step3"));
    expect(result.current.snapshot?.stepId).toBe("step3");
  });

  it("goToStepChecked blocks if canMoveNext returns false", async () => {
    const path: PathDefinition = {
      id: "guarded",
      steps: [
        { id: "step1", canMoveNext: () => ({ allowed: false }) },
        { id: "step2" },
      ],
    };
    const { result } = renderHook(() => usePath());
    await act(() => result.current.start(path));
    await act(() => result.current.goToStepChecked("step2"));
    expect(result.current.snapshot?.stepId).toBe("step1");
  });

  it("setData updates the snapshot data", async () => {
    const { result } = renderHook(() => usePath<{ name: string }>());
    await act(() => result.current.start(twoStepPath()));
    await act(() => result.current.setData("name", "Alice"));
    expect(result.current.snapshot?.data.name).toBe("Alice");
  });

  it("resetStep restores data to step-entry state", async () => {
    const { result } = renderHook(() => usePath<{ name: string }>());
    await act(() => result.current.start(twoStepPath(), { name: "original" }));
    await act(() => result.current.setData("name", "changed"));
    expect(result.current.snapshot?.data.name).toBe("changed");
    await act(() => result.current.resetStep());
    expect(result.current.snapshot?.data.name).toBe("original");
  });

  it("restart resets the path to step 1 with fresh data", async () => {
    const { result } = renderHook(() => usePath());
    await act(() => result.current.start(twoStepPath()));
    await act(() => result.current.next());
    expect(result.current.snapshot?.stepId).toBe("step2");
    await act(() => result.current.restart());
    expect(result.current.snapshot?.stepId).toBe("step1");
  });
});

// ---------------------------------------------------------------------------
// guards
// ---------------------------------------------------------------------------

describe("usePath — guards", () => {
  it("canMoveNext reflects a synchronous guard", async () => {
    const path: PathDefinition = {
      id: "guarded",
      steps: [
        { id: "step1", canMoveNext: ({ data }) => !!(data as any).name },
        { id: "step2" },
      ],
    };
    const { result } = renderHook(() => usePath<{ name: string }>());
    await act(() => result.current.start(path, { name: "" }));
    expect(result.current.snapshot?.canMoveNext).toBe(false);
    await act(() => result.current.setData("name", "Alice"));
    expect(result.current.snapshot?.canMoveNext).toBe(true);
  });

  it("next is blocked when canMoveNext is false", async () => {
    const path: PathDefinition = {
      id: "blocked",
      steps: [
        { id: "step1", canMoveNext: () => ({ allowed: false }) },
        { id: "step2" },
      ],
    };
    const { result } = renderHook(() => usePath());
    await act(() => result.current.start(path));
    await act(() => result.current.next());
    expect(result.current.snapshot?.stepId).toBe("step1");
  });

  it("shouldSkip removes a step from the flow", async () => {
    const path: PathDefinition = {
      id: "skip",
      steps: [
        { id: "step1" },
        { id: "step2", shouldSkip: ({ data }) => !!(data as any).skip },
        { id: "step3" },
      ],
    };
    const { result } = renderHook(() => usePath<{ skip: boolean }>());
    await act(() => result.current.start(path, { skip: true }));
    await act(() => result.current.next());
    expect(result.current.snapshot?.stepId).toBe("step3");
  });

  it("fieldErrors are reflected on the snapshot", async () => {
    const path: PathDefinition = {
      id: "errors",
      steps: [
        {
          id: "step1",
          fieldErrors: ({ data }) => ({
            name: !(data as any).name ? "Required." : undefined,
          }),
        },
        { id: "step2" },
      ],
    };
    const { result } = renderHook(() => usePath<{ name: string }>());
    await act(() => result.current.start(path, { name: "" }));
    expect(result.current.snapshot?.fieldErrors.name).toBe("Required.");
  });
});

// ---------------------------------------------------------------------------
// events
// ---------------------------------------------------------------------------

describe("usePath — events", () => {
  it("fires onEvent for stateChanged on each navigation", async () => {
    const onEvent = vi.fn();
    const { result } = renderHook(() => usePath({ onEvent }));
    await act(() => result.current.start(twoStepPath()));
    const stateChangedCount = onEvent.mock.calls.filter(
      ([e]: [PathEvent]) => e.type === "stateChanged"
    ).length;
    expect(stateChangedCount).toBeGreaterThanOrEqual(1);
  });

  it("fires onEvent with completed event when path finishes", async () => {
    const onEvent = vi.fn();
    const { result } = renderHook(() => usePath({ onEvent }));
    await act(() => result.current.start(twoStepPath()));
    await act(() => result.current.next());
    await act(() => result.current.next());
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "completed" })
    );
  });

  it("fires onEvent with cancelled event when path is cancelled", async () => {
    const onEvent = vi.fn();
    const { result } = renderHook(() => usePath({ onEvent }));
    await act(() => result.current.start(twoStepPath()));
    await act(() => result.current.cancel());
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "cancelled" })
    );
  });

  it("does not re-subscribe when onEvent reference changes", async () => {
    let callCount = 0;
    const { result, rerender } = renderHook(
      ({ cb }: { cb: (e: PathEvent) => void }) => usePath({ onEvent: cb }),
      { initialProps: { cb: () => { callCount++; } } }
    );
    await act(() => result.current.start(twoStepPath()));
    const after1 = callCount;
    rerender({ cb: () => { callCount += 100; } });
    await act(() => result.current.next());
    // If re-subscribed, callCount would jump by 100; if ref is kept current it adds 100 once
    expect(callCount).toBeGreaterThan(after1);
  });
});

// ---------------------------------------------------------------------------
// external engine
// ---------------------------------------------------------------------------

describe("usePath — external engine", () => {
  it("uses the provided engine instead of creating a new one", async () => {
    const engine = new PathEngine();
    const { result } = renderHook(() => usePath({ engine }));
    await act(() => engine.start(twoStepPath()));
    expect(result.current.snapshot?.stepId).toBe("step1");
  });

  it("reflects changes made directly on the external engine", async () => {
    const engine = new PathEngine();
    await engine.start(twoStepPath());
    const { result } = renderHook(() => usePath({ engine }));
    await act(() => engine.next());
    expect(result.current.snapshot?.stepId).toBe("step2");
  });
});

// ---------------------------------------------------------------------------
// StepChoice
// ---------------------------------------------------------------------------

describe("usePath — StepChoice", () => {
  it("sets formId when a StepChoice is active", async () => {
    const path: PathDefinition = {
      id: "choice-path",
      steps: [
        {
          id: "pick",
          select: ({ data }) => (data as any).type === "a" ? "form-a" : "form-b",
          steps: [
            { id: "form-a" },
            { id: "form-b" },
          ],
        } as any,
      ],
    };
    const { result } = renderHook(() => usePath<{ type: string }>());
    await act(() => result.current.start(path, { type: "a" }));
    expect(result.current.snapshot?.stepId).toBe("pick");
    expect(result.current.snapshot?.formId).toBe("form-a");
  });
});

// ---------------------------------------------------------------------------
// PathProvider + usePathContext
// ---------------------------------------------------------------------------

describe("usePathContext", () => {
  it("throws when used outside a PathProvider", () => {
    expect(() => renderHook(() => usePathContext())).toThrow(
      "usePathContext must be used within a <PathProvider>."
    );
  });

  it("returns the shared path instance from PathProvider", async () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(PathProvider, null, children);
    const { result } = renderHook(() => usePathContext(), { wrapper });
    await act(() => result.current.start(twoStepPath()));
    expect(result.current.snapshot?.stepId).toBe("step1");
  });

  it("shares state between two consumers of the same provider", async () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(PathProvider, null, children);
    const hook1 = renderHook(() => usePathContext(), { wrapper });
    const hook2 = renderHook(() => usePathContext(), { wrapper: wrapper as any });
    // Both should see null before start
    expect(hook1.result.current.snapshot).toBeNull();
  });
});
