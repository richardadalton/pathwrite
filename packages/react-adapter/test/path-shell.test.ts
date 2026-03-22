// @vitest-environment jsdom
import { createElement } from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { PathDefinition, PathSnapshot } from "@daltonr/pathwrite-core";
import { PathShell, PathShellActions, usePathContext } from "../src/index";

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

const defaultSteps = {
  "step-a": createElement("div", null, "Content A"),
  "step-b": createElement("div", null, "Content B"),
  "step-c": createElement("div", null, "Content C")
};

function renderShell(props: Partial<Parameters<typeof PathShell>[0]> = {}) {
  const defaults = {
    path: threeStepPath(),
    steps: defaultSteps
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

  it("does not show Previous button on first step", async () => {
    await act(async () => renderShell());
    expect(screen.queryByText("Previous")).toBeNull();
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

  it("shows Previous button on the second step", async () => {
    await act(async () => renderShell());
    await act(async () => screen.getByText("Next").click());
    expect(screen.getByText("Previous")).toBeTruthy();
  });

  it("goes back when Previous is clicked", async () => {
    await act(async () => renderShell());
    await act(async () => screen.getByText("Next").click());
    await act(async () => screen.getByText("Previous").click());
    expect(screen.getByText("Content A")).toBeTruthy();
  });

  it("shows Complete on the last step", async () => {
    await act(async () => renderShell());
    await act(async () => screen.getByText("Next").click());
    await act(async () => screen.getByText("Next").click());
    expect(screen.getByText("Complete")).toBeTruthy();
  });

  it("calls onComplete when Complete is clicked", async () => {
    const onComplete = vi.fn();
    await act(async () => renderShell({ onComplete }));
    await act(async () => screen.getByText("Next").click());
    await act(async () => screen.getByText("Next").click());
    await act(async () => screen.getByText("Complete").click());
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when Cancel is clicked", async () => {
    const onCancel = vi.fn();
    await act(async () => renderShell({ onCancel }));
    await act(async () => screen.getByText("Cancel").click());
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("applies pw-shell__btn--back class to the Previous button", async () => {
    const { container } = await act(async () => renderShell());
    await act(async () => screen.getByText("Next").click());
    const backBtn = container.querySelector(".pw-shell__btn--back");
    expect(backBtn).toBeTruthy();
    expect(backBtn?.textContent).toBe("Previous");
  });
});

// ---------------------------------------------------------------------------
// restart via renderFooter actions
// ---------------------------------------------------------------------------

describe("PathShell — restart via actions", () => {
  it("actions.restart() resets to step 1 from mid-flow", async () => {
    await act(async () =>
      renderShell({
        renderFooter: (_snap, actions) =>
          createElement("div", null,
            createElement("button", { onClick: actions.next }, "Next"),
            createElement("button", { onClick: actions.restart }, "Restart")
          )
      })
    );
    // Advance to step 2
    await act(async () => screen.getByText("Next").click());
    expect(screen.getByText("Content B")).toBeTruthy();

    // Restart via actions
    await act(async () => screen.getByText("Restart").click());
    expect(screen.getByText("Content A")).toBeTruthy();
  });

  it("actions.restart() from the last step returns to step 1 without completing", async () => {
    await act(async () =>
      renderShell({
        renderFooter: (_snap, actions) =>
          createElement("div", null,
            createElement("button", { onClick: actions.next }, "Next"),
            createElement("button", { onClick: actions.restart }, "Restart")
          )
      })
    );
    // Advance to last step
    await act(async () => screen.getByText("Next").click());
    await act(async () => screen.getByText("Next").click());
    expect(screen.getByText("Content C")).toBeTruthy();

    // Restart before finishing
    await act(async () => screen.getByText("Restart").click());
    expect(screen.getByText("Content A")).toBeTruthy();
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

  it("uses custom complete label on last step", async () => {
    await act(async () => renderShell({ completeLabel: "Done" }));
    await act(async () => screen.getByText("Next").click());
    await act(async () => screen.getByText("Next").click());
    expect(screen.getByText("Done")).toBeTruthy();
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

// ---------------------------------------------------------------------------
// Context sharing — usePathContext inside PathShell
// ---------------------------------------------------------------------------

describe("PathShell — context sharing", () => {
  it("usePathContext returns snapshot inside a PathShell step component", async () => {
    function StepChild() {
      const { snapshot } = usePathContext();
      return createElement("span", { "data-testid": "ctx-step" }, snapshot?.stepId ?? "none");
    }

    await act(async () =>
      render(
        createElement(PathShell, {
          path: threeStepPath(),
          steps: {
            "step-a": createElement(StepChild),
            "step-b": createElement("div", null, "B"),
            "step-c": createElement("div", null, "C")
          }
        })
      )
    );
    expect(screen.getByTestId("ctx-step").textContent).toBe("step-a");
  });

  it("usePathContext actions drive navigation from inside a step component", async () => {
    function StepChild() {
      const { next } = usePathContext();
      return createElement("button", { "data-testid": "inner-next", onClick: next }, "Inner Next");
    }

    await act(async () =>
      render(
        createElement(PathShell, {
          path: threeStepPath(),
          steps: {
            "step-a": createElement(StepChild),
            "step-b": createElement("div", null, "Content B"),
            "step-c": createElement("div", null, "C")
          }
        })
      )
    );
    await act(async () => screen.getByTestId("inner-next").click());
    expect(screen.getByText("Content B")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// fieldMessages
// ---------------------------------------------------------------------------

describe("PathShell — fieldMessages", () => {
  it("renders labeled messages when the current step has fieldMessages", async () => {
    const path: PathDefinition = {
      id: "p",
      steps: [
        { id: "step-a", title: "Step A", fieldMessages: () => ({ name: "Required", email: "Invalid email address" }) },
        { id: "step-b", title: "Step B" }
      ]
    };
    await act(async () =>
      render(createElement(PathShell, {
        path,
        steps: { "step-a": createElement("div", null, "A"), "step-b": createElement("div", null, "B") }
      }))
    );
    expect(screen.getByText("Name")).toBeTruthy();
    expect(screen.getByText("Required")).toBeTruthy();
    expect(screen.getByText("Email")).toBeTruthy();
    expect(screen.getByText("Invalid email address")).toBeTruthy();
  });

  it("does not render the validation list when fieldMessages is empty", async () => {
    const path: PathDefinition = {
      id: "p",
      steps: [{ id: "step-a", title: "Step A", fieldMessages: () => ({}) }]
    };
    await act(async () =>
      render(createElement(PathShell, {
        path,
        steps: { "step-a": createElement("div", null, "A") }
      }))
    );
    expect(document.querySelector(".pw-shell__validation")).toBeNull();
  });

  it("clears messages when navigating to a step with no fieldMessages hook", async () => {
    const path: PathDefinition = {
      id: "p",
      steps: [
        { id: "step-a", title: "Step A", fieldMessages: () => ({ field: "Fill this in" }), canMoveNext: () => true },
        { id: "step-b", title: "Step B" }
      ]
    };
    await act(async () =>
      render(createElement(PathShell, {
        path,
        steps: { "step-a": createElement("div", null, "A"), "step-b": createElement("div", null, "B") }
      }))
    );
    expect(screen.getByText("Fill this in")).toBeTruthy();

    await act(async () => screen.getByText("Next").click());
    expect(document.querySelector(".pw-shell__validation")).toBeNull();
  });

  it("does not render label span for the _ key", async () => {
    const path: PathDefinition = {
      id: "p",
      steps: [{ id: "step-a", title: "Step A", fieldMessages: () => ({ _: "Form-level error" }) }]
    };
    await act(async () =>
      render(createElement(PathShell, {
        path,
        steps: { "step-a": createElement("div", null, "A") }
      }))
    );
    expect(document.querySelector(".pw-shell__validation-label")).toBeNull();
    expect(screen.getByText("Form-level error")).toBeTruthy();
  });
});

