// @vitest-environment jsdom
import { createElement } from "react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { WizardDefinition, WizardEngineEvent } from "@pathwrite/core";
import { useWizard, WizardProvider, useWizardContext } from "../src/index";
import type { UseWizardOptions } from "../src/index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function twoStepWizard(id = "main"): WizardDefinition {
  return { id, steps: [{ id: "step1" }, { id: "step2" }] };
}

// ---------------------------------------------------------------------------
// snapshot
// ---------------------------------------------------------------------------

describe("useWizard — snapshot", () => {
  it("starts as null before any wizard is launched", () => {
    const { result } = renderHook(() => useWizard());
    expect(result.current.snapshot).toBeNull();
  });

  it("returns the current step snapshot when a wizard starts", () => {
    const { result } = renderHook(() => useWizard());
    act(() => result.current.start(twoStepWizard()));
    expect(result.current.snapshot).toMatchObject({ wizardId: "main", stepId: "step1" });
  });

  it("updates as navigation progresses", () => {
    const { result } = renderHook(() => useWizard());
    act(() => result.current.start(twoStepWizard()));
    expect(result.current.snapshot?.stepId).toBe("step1");
    act(() => result.current.next());
    expect(result.current.snapshot?.stepId).toBe("step2");
  });

  it("returns null when the wizard completes", () => {
    const { result } = renderHook(() => useWizard());
    act(() => result.current.start(twoStepWizard()));
    act(() => result.current.next());
    act(() => result.current.next());
    expect(result.current.snapshot).toBeNull();
  });

  it("returns null when the wizard is cancelled", () => {
    const { result } = renderHook(() => useWizard());
    act(() => result.current.start(twoStepWizard()));
    act(() => result.current.cancel());
    expect(result.current.snapshot).toBeNull();
  });

  it("reflects the parent wizard snapshot after a sub-wizard completes", () => {
    const { result } = renderHook(() => useWizard());
    act(() => result.current.start(twoStepWizard("parent")));
    act(() => result.current.next());
    act(() => result.current.startSubWizard(twoStepWizard("sub")));
    expect(result.current.snapshot?.wizardId).toBe("sub");

    act(() => result.current.next());
    act(() => result.current.next()); // complete sub → resume parent

    expect(result.current.snapshot).toMatchObject({ wizardId: "parent", stepId: "step2" });
  });

  it("reflects the parent wizard snapshot after a sub-wizard is cancelled", () => {
    const { result } = renderHook(() => useWizard());
    act(() => result.current.start(twoStepWizard("parent")));
    act(() => result.current.next());
    act(() => result.current.startSubWizard(twoStepWizard("sub")));
    act(() => result.current.cancel());
    expect(result.current.snapshot).toMatchObject({ wizardId: "parent", stepId: "step2" });
  });

  it("includes initial args passed to start", () => {
    const { result } = renderHook(() => useWizard());
    act(() => result.current.start(twoStepWizard(), { owner: "test", value: 42 }));
    expect(result.current.snapshot?.args).toMatchObject({ owner: "test", value: 42 });
  });
});

// ---------------------------------------------------------------------------
// events (onEvent callback)
// ---------------------------------------------------------------------------

describe("useWizard — events", () => {
  it("calls onEvent for stateChanged on start and navigation", () => {
    const onEvent = vi.fn();
    const { result } = renderHook(() => useWizard({ onEvent }));

    act(() => result.current.start(twoStepWizard()));
    act(() => result.current.next());

    const stateChangedCount = onEvent.mock.calls.filter(
      (args) => (args[0] as WizardEngineEvent).type === "stateChanged"
    ).length;
    expect(stateChangedCount).toBeGreaterThanOrEqual(2);
  });

  it("calls onEvent with completed when the wizard finishes", () => {
    const onEvent = vi.fn();
    const { result } = renderHook(() => useWizard({ onEvent }));

    act(() => result.current.start(twoStepWizard()));
    act(() => result.current.next());
    act(() => result.current.next());

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "completed", wizardId: "main" })
    );
  });

  it("calls onEvent with cancelled when cancel is called", () => {
    const onEvent = vi.fn();
    const { result } = renderHook(() => useWizard({ onEvent }));

    act(() => result.current.start(twoStepWizard()));
    act(() => result.current.cancel());

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "cancelled", wizardId: "main" })
    );
  });

  it("calls onEvent with resumed when a sub-wizard completes", () => {
    const onEvent = vi.fn();
    const { result } = renderHook(() => useWizard({ onEvent }));

    act(() => result.current.start(twoStepWizard("parent")));
    act(() => result.current.startSubWizard(twoStepWizard("sub")));
    act(() => result.current.next());
    act(() => result.current.next());

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "resumed",
        resumedWizardId: "parent",
        fromSubWizardId: "sub"
      })
    );
  });

  it("uses the latest onEvent callback without re-subscribing", () => {
    const firstCallback = vi.fn();
    const secondCallback = vi.fn();
    const { result, rerender } = renderHook(
      (props: UseWizardOptions) => useWizard(props),
      { initialProps: { onEvent: firstCallback } }
    );

    act(() => result.current.start(twoStepWizard()));
    expect(firstCallback).toHaveBeenCalled();
    expect(secondCallback).not.toHaveBeenCalled();

    firstCallback.mockClear();
    rerender({ onEvent: secondCallback });

    act(() => result.current.next());
    expect(secondCallback).toHaveBeenCalled();
    expect(firstCallback).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// navigation methods
// ---------------------------------------------------------------------------

describe("useWizard — navigation", () => {
  it("next() advances the step", () => {
    const { result } = renderHook(() => useWizard());
    act(() => result.current.start(twoStepWizard()));
    act(() => result.current.next());
    expect(result.current.snapshot?.stepId).toBe("step2");
  });

  it("previous() goes back a step", () => {
    const { result } = renderHook(() => useWizard());
    act(() => result.current.start(twoStepWizard()));
    act(() => result.current.next());
    act(() => result.current.previous());
    expect(result.current.snapshot?.stepId).toBe("step1");
  });

  it("cancel() clears the active wizard", () => {
    const { result } = renderHook(() => useWizard());
    act(() => result.current.start(twoStepWizard()));
    act(() => result.current.cancel());
    expect(result.current.snapshot).toBeNull();
  });

  it("setArg() updates the arg and is visible in the snapshot", () => {
    const { result } = renderHook(() => useWizard());
    act(() => result.current.start(twoStepWizard(), { label: "old" }));
    act(() => result.current.setArg("label", "new"));
    expect(result.current.snapshot?.args.label).toBe("new");
  });

  it("action callbacks are referentially stable across re-renders", () => {
    const { result, rerender } = renderHook(() => useWizard());
    const first = result.current;
    rerender();
    const second = result.current;

    expect(second.start).toBe(first.start);
    expect(second.startSubWizard).toBe(first.startSubWizard);
    expect(second.next).toBe(first.next);
    expect(second.previous).toBe(first.previous);
    expect(second.cancel).toBe(first.cancel);
    expect(second.setArg).toBe(first.setArg);
  });
});

// ---------------------------------------------------------------------------
// sub-wizard
// ---------------------------------------------------------------------------

describe("useWizard — sub-wizard", () => {
  it("throws when startSubWizard is called without an active wizard", () => {
    const { result } = renderHook(() => useWizard());
    expect(() => result.current.startSubWizard(twoStepWizard())).toThrow();
  });

  it("sets the sub-wizard as the active snapshot", () => {
    const { result } = renderHook(() => useWizard());
    act(() => result.current.start(twoStepWizard("parent")));
    act(() => result.current.startSubWizard(twoStepWizard("sub")));
    expect(result.current.snapshot?.wizardId).toBe("sub");
  });
});

// ---------------------------------------------------------------------------
// goToStep
// ---------------------------------------------------------------------------

describe("useWizard — goToStep", () => {
  it("jumps to the target step by ID", () => {
    const { result } = renderHook(() => useWizard());
    act(() => result.current.start({ id: "w", steps: [{ id: "a" }, { id: "b" }, { id: "c" }] }));
    act(() => result.current.goToStep("c"));
    expect(result.current.snapshot?.stepId).toBe("c");
  });

  it("goToStep callback is referentially stable across re-renders", () => {
    const { result, rerender } = renderHook(() => useWizard());
    const first = result.current.goToStep;
    rerender();
    expect(result.current.goToStep).toBe(first);
  });
});

// ---------------------------------------------------------------------------
// WizardProvider + useWizardContext
// ---------------------------------------------------------------------------

describe("WizardProvider + useWizardContext", () => {
  it("provides wizard state to child hooks", () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(WizardProvider, null, children);
    const { result } = renderHook(() => useWizardContext(), { wrapper });
    expect(result.current.snapshot).toBeNull();
  });

  it("allows navigation through the provided context", () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(WizardProvider, null, children);
    const { result } = renderHook(() => useWizardContext(), { wrapper });

    act(() => result.current.start(twoStepWizard()));
    expect(result.current.snapshot?.stepId).toBe("step1");

    act(() => result.current.next());
    expect(result.current.snapshot?.stepId).toBe("step2");
  });

  it("throws when useWizardContext is used outside a WizardProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useWizardContext())).toThrow(
      "useWizardContext must be used within a <WizardProvider>."
    );
    spy.mockRestore();
  });

  it("forwards onEvent from WizardProvider props", () => {
    const onEvent = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(WizardProvider, { onEvent }, children);
    const { result } = renderHook(() => useWizardContext(), { wrapper });

    act(() => result.current.start(twoStepWizard()));
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "stateChanged" })
    );
  });
});

// ---------------------------------------------------------------------------
// cleanup on unmount
// ---------------------------------------------------------------------------

describe("useWizard — cleanup", () => {
  it("does not throw when the component unmounts while a wizard is active", () => {
    const { result, unmount } = renderHook(() => useWizard());
    act(() => result.current.start(twoStepWizard()));
    expect(result.current.snapshot?.stepId).toBe("step1");
    expect(() => unmount()).not.toThrow();
  });
});

