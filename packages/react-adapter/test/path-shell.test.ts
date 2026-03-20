// @vitest-environment jsdom
import { createElement } from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { PathDefinition, PathSnapshot } from "@pathwrite/core";
import { PathShell, PathStep, PathShellActions } from "../src/index";

afterEach(() => cleanup());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function threeStepPath(id = "test"): PathDefinition {
  return {
    id,
    steps: [
      { id: "step-a", title: "Step A" },
      { id: "step-b", title: "Step B" },
      { id: "step-c", title: "Step C" }
    ]
  };
}

function renderShell(props: Partial<Parameters<typeof PathShell>[0]> = {}) {
  const defaults = {
    path: threeStepPath(),
    children: [
      createElement(PathStep, { id: "step-a", key: "a" }, createElement("div", null, "Content A")),
      createElement(PathStep, { id: "step-b", key: "b" }, createElement("div", null, "Content B")),
      createElement(PathStep, { id: "step-c", key: "c" }, createElement("div", null, "Content C"))
    ]
  };
  return render(createElement(PathShell, { ...defaults, ...props } as any));
}

// ---------------------------------------------------------------------------
// Auto-start + step content
// ---------------------------------------------------------------------------

describe("PathShell — rendering", () => {
  it("auto-starts and renders the first step content", async () => {
    await act(async () => renderShell());
    expect(screen.getByText("Content A")).toBeTruthy();
  });

  it("shows step labels in the progress header", async () => {
    await act(async () => renderShell());
    expect(screen.getByText("Step A")).toBeTruthy();
    expect(screen.getByText("Step B")).toBeTruthy();
    expect(screen.getByText("Step C")).toBeTruthy();
  });

  it("shows Next button on first step", async () => {
    await act(async () => renderShell());
    expect(screen.getByText("Next")).toBeTruthy();
  });

  it("does not show Back button on first step", async () => {
    await act(async () => renderShell());
    expect(screen.queryByText("Back")).toBeNull();
  });

  it("shows Cancel button by default", async () => {
    await act(async () => renderShell());
    expect(screen.getByText("Cancel")).toBeTruthy();
  });

  it("hides Cancel button when hideCancel is true", async () => {
    await act(async () => renderShell({ hideCancel: true }));
    expect(screen.queryByText("Cancel")).toBeNull();
  });

  it("hides progress when hideProgress is true", async () => {
    const { container } = await act(async () => renderShell({ hideProgress: true }));
    expect(container.querySelector(".pw-shell__header")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

describe("PathShell — navigation", () => {
  it("advances to the next step when Next is clicked", async () => {
    await act(async () => renderShell());
    await act(async () => screen.getByText("Next").click());
    expect(screen.getByText("Content B")).toBeTruthy();
    expect(screen.queryByText("Content A")).toBeNull();
  });

  it("shows Back button on the second step", async () => {
    await act(async () => renderShell());
    await act(async () => screen.getByText("Next").click());
    expect(screen.getByText("Back")).toBeTruthy();
  });

  it("goes back when Back is clicked", async () => {
    await act(async () => renderShell());
    await act(async () => screen.getByText("Next").click());
    await act(async () => screen.getByText("Back").click());
    expect(screen.getByText("Content A")).toBeTruthy();
  });

  it("shows Finish on the last step", async () => {
    await act(async () => renderShell());
    await act(async () => screen.getByText("Next").click());
    await act(async () => screen.getByText("Next").click());
    expect(screen.getByText("Finish")).toBeTruthy();
    expect(screen.queryByText("Next")).toBeNull();
  });

  it("calls onComplete when Finish is clicked", async () => {
    const onComplete = vi.fn();
    await act(async () => renderShell({ onComplete }));
    await act(async () => screen.getByText("Next").click());
    await act(async () => screen.getByText("Next").click());
    await act(async () => screen.getByText("Finish").click());
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when Cancel is clicked", async () => {
    const onCancel = vi.fn();
    await act(async () => renderShell({ onCancel }));
    await act(async () => screen.getByText("Cancel").click());
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Custom labels
// ---------------------------------------------------------------------------

describe("PathShell — custom labels", () => {
  it("uses custom button labels", async () => {
    await act(async () =>
      renderShell({
        backLabel: "Prev",
        nextLabel: "Forward",
        cancelLabel: "Abort"
      })
    );
    expect(screen.getByText("Forward")).toBeTruthy();
    expect(screen.getByText("Abort")).toBeTruthy();
  });

  it("uses custom finish label on last step", async () => {
    await act(async () => renderShell({ finishLabel: "Complete" }));
    await act(async () => screen.getByText("Next").click());
    await act(async () => screen.getByText("Next").click());
    expect(screen.getByText("Complete")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Progress indicator
// ---------------------------------------------------------------------------

describe("PathShell — progress", () => {
  it("marks the first step as current and others as upcoming", async () => {
    const { container } = await act(async () => renderShell());
    const steps = container.querySelectorAll(".pw-shell__step");
    expect(steps.length).toBe(3);
    expect(steps[0].classList.contains("pw-shell__step--current")).toBe(true);
    expect(steps[1].classList.contains("pw-shell__step--upcoming")).toBe(true);
    expect(steps[2].classList.contains("pw-shell__step--upcoming")).toBe(true);
  });

  it("marks completed steps after navigation", async () => {
    const { container } = await act(async () => renderShell());
    await act(async () => screen.getByText("Next").click());
    const steps = container.querySelectorAll(".pw-shell__step");
    expect(steps[0].classList.contains("pw-shell__step--completed")).toBe(true);
    expect(steps[1].classList.contains("pw-shell__step--current")).toBe(true);
  });

  it("shows a checkmark on completed steps", async () => {
    const { container } = await act(async () => renderShell());
    await act(async () => screen.getByText("Next").click());
    const dots = container.querySelectorAll(".pw-shell__step-dot");
    expect(dots[0].textContent).toBe("✓");
    expect(dots[1].textContent).toBe("2");
  });
});

// ---------------------------------------------------------------------------
// Render props (custom header/footer)
// ---------------------------------------------------------------------------

describe("PathShell — render props", () => {
  it("uses renderHeader to replace the default header", async () => {
    const renderHeader = (snap: PathSnapshot) =>
      createElement("div", { "data-testid": "custom-header" }, `Step ${snap.stepIndex + 1}`);
    const { container } = await act(async () => renderShell({ renderHeader }));
    expect(screen.getByTestId("custom-header")).toBeTruthy();
    expect(screen.getByTestId("custom-header").textContent).toBe("Step 1");
    expect(container.querySelector(".pw-shell__steps")).toBeNull();
  });

  it("uses renderFooter to replace the default footer", async () => {
    const renderFooter = (_snap: PathSnapshot, actions: PathShellActions) =>
      createElement("div", { "data-testid": "custom-footer" },
        createElement("button", { onClick: actions.next }, "Go!")
      );
    await act(async () => renderShell({ renderFooter }));
    expect(screen.getByTestId("custom-footer")).toBeTruthy();
    await act(async () => screen.getByText("Go!").click());
    expect(screen.getByText("Content B")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// autoStart = false
// ---------------------------------------------------------------------------

describe("PathShell — autoStart false", () => {
  it("shows empty state with Start button when autoStart is false", async () => {
    await act(async () => renderShell({ autoStart: false }));
    expect(screen.getByText("No active path.")).toBeTruthy();
    expect(screen.getByText("Start")).toBeTruthy();
  });

  it("starts the path when Start button is clicked", async () => {
    await act(async () => renderShell({ autoStart: false }));
    await act(async () => screen.getByText("Start").click());
    expect(screen.getByText("Content A")).toBeTruthy();
  });
});

