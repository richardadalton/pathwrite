// @vitest-environment jsdom
import { createElement } from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { PathDefinition, PathSnapshot, StepChoice } from "@daltonr/pathwrite-core";
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

  it("hides progress automatically for a single-step path", async () => {
    const singleStepPath: PathDefinition = { id: "single", steps: [{ id: "only" }] };
    const { container } = await act(async () =>
      render(createElement(PathShell, {
        path: singleStepPath,
        steps: { only: createElement("div", null, "Only step") }
      } as any))
    );
    expect(container.querySelector(".pw-shell__header")).toBeNull();
  });

  it("still shows progress for a multi-step path", async () => {
    const { container } = await act(async () => renderShell());
    expect(container.querySelector(".pw-shell__header")).toBeTruthy();
  });

  it("still shows progress for a single-step sub-path (nestingLevel > 0)", async () => {
    const { PathEngine } = await import("@daltonr/pathwrite-core");
    const subPath: PathDefinition = { id: "sub", steps: [{ id: "sub-only", title: "Sub Step" }] };
    const parentPath: PathDefinition = {
      id: "parent",
      steps: [{ id: "parent-step", title: "Parent Step" }]
    };
    const engine = new PathEngine();
    await engine.start(parentPath, {});
    await engine.startSubPath(subPath, {});

    const { container } = await act(async () =>
      render(createElement(PathShell, {
        engine,
        path: subPath,
        steps: { "sub-only": createElement("div", null, "Sub content") }
      } as any))
    );
    expect(container.querySelector(".pw-shell__header")).toBeTruthy();
  });

  it("renders root progress bar when a sub-path is active", async () => {
    const { PathEngine } = await import("@daltonr/pathwrite-core");
    const parentPath: PathDefinition = {
      id: "parent",
      steps: [{ id: "p1", title: "Parent 1" }, { id: "p2", title: "Parent 2" }]
    };
    const subPath: PathDefinition = {
      id: "sub",
      steps: [{ id: "s1", title: "Sub 1" }, { id: "s2", title: "Sub 2" }]
    };
    const engine = new PathEngine();
    await engine.start(parentPath, {});
    await engine.startSubPath(subPath, {});

    const { container } = await act(async () =>
      render(createElement(PathShell, {
        engine,
        path: subPath,
        steps: {
          s1: createElement("div", null, "Sub step 1"),
          s2: createElement("div", null, "Sub step 2")
        }
      } as any))
    );

    // Root progress bar should be present
    expect(container.querySelector(".pw-shell__root-progress")).toBeTruthy();
    // Sub-path header should also be present
    expect(container.querySelector(".pw-shell__header")).toBeTruthy();
  });

  it("does not render root progress bar at the top level", async () => {
    const { container } = await act(async () => renderShell());
    expect(container.querySelector(".pw-shell__root-progress")).toBeNull();
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
// fieldErrors
// ---------------------------------------------------------------------------

describe("PathShell — fieldErrors", () => {
  it("does not render messages before the user has attempted to proceed", async () => {
    const path: PathDefinition = {
      id: "p",
      steps: [
        { id: "step-a", title: "Step A", fieldErrors: () => ({ name: "Required", email: "Invalid email address" }) },
        { id: "step-b", title: "Step B" }
      ]
    };
    await act(async () =>
      render(createElement(PathShell, {
        path,
        steps: { "step-a": createElement("div", null, "A"), "step-b": createElement("div", null, "B") }
      }))
    );
    // Errors must be hidden on initial render — "punish late, reward early"
    expect(document.querySelector(".pw-shell__validation")).toBeNull();
  });

  it("renders labeled messages after clicking Next when navigation is blocked", async () => {
    const path: PathDefinition = {
      id: "p",
      steps: [
        { id: "step-a", title: "Step A", fieldErrors: () => ({ name: "Required", email: "Invalid email address" }) },
        { id: "step-b", title: "Step B" }
      ]
    };
    await act(async () =>
      render(createElement(PathShell, {
        path,
        validationDisplay: "summary",
        steps: { "step-a": createElement("div", null, "A"), "step-b": createElement("div", null, "B") }
      }))
    );
    // Next button is always enabled — clicking it sets hasAttemptedNext; navigation is blocked
    await act(async () => screen.getByText("Next").click());
    expect(screen.getByText("Name")).toBeTruthy();
    expect(screen.getByText("Required")).toBeTruthy();
    expect(screen.getByText("Email")).toBeTruthy();
    expect(screen.getByText("Invalid email address")).toBeTruthy();
  });

  it("clears messages in real-time as data becomes valid after an attempt", async () => {
    const path: PathDefinition = {
      id: "p",
      steps: [
        {
          id: "step-a",
          title: "Step A",
          fieldErrors: (ctx) => ({
            name: (ctx.data as { name: string }).name ? undefined : "Required"
          })
        }
      ]
    };
    let setDataFn: ((key: string, value: unknown) => void) | undefined;
    function StepA() {
      const ctx = usePathContext();
      setDataFn = ctx.setData as (key: string, value: unknown) => void;
      return createElement("div", null, "A");
    }
    await act(async () =>
      render(createElement(PathShell, { path, validationDisplay: "summary", steps: { "step-a": createElement(StepA) } }))
    );
    await act(async () => screen.getByText("Complete").click()); // trigger attempt (single-step uses "Complete")
    expect(screen.getByText("Required")).toBeTruthy();

    await act(async () => setDataFn!("name", "Alice")); // fix the field
    expect(document.querySelector(".pw-shell__validation")).toBeNull();
  });

  it("does not render the validation list when fieldErrors is empty", async () => {
    const path: PathDefinition = {
      id: "p",
      steps: [{ id: "step-a", title: "Step A", fieldErrors: () => ({}) }]
    };
    await act(async () =>
      render(createElement(PathShell, {
        path,
        steps: { "step-a": createElement("div", null, "A") }
      }))
    );
    await act(async () => screen.getByText("Complete").click()); // attempt with no messages (single-step uses "Complete")
    expect(document.querySelector(".pw-shell__validation")).toBeNull();
  });

  it("resets hasAttemptedNext when navigating to a new step", async () => {
    const path: PathDefinition = {
      id: "p",
      steps: [
        { id: "step-a", title: "Step A", fieldErrors: () => ({ field: "Fill this in" }), canMoveNext: () => true },
        { id: "step-b", title: "Step B", fieldErrors: () => ({ other: "Also required" }) }
      ]
    };
    await act(async () =>
      render(createElement(PathShell, {
        path,
        steps: { "step-a": createElement("div", null, "A"), "step-b": createElement("div", null, "B") }
      }))
    );
    // Navigate to step B (canMoveNext: () => true lets navigation succeed)
    await act(async () => screen.getByText("Next").click());
    expect(screen.getByText("B")).toBeTruthy(); // now on step B
    // step-b has fieldErrors but hasAttemptedNext is false — errors not shown yet
    expect(document.querySelector(".pw-shell__validation")).toBeNull();
  });

  it("does not render label span for the _ key", async () => {
    const path: PathDefinition = {
      id: "p",
      steps: [{ id: "step-a", title: "Step A", fieldErrors: () => ({ _: "Form-level error" }) }]
    };
    await act(async () =>
      render(createElement(PathShell, {
        path,
        validationDisplay: "summary",
        steps: { "step-a": createElement("div", null, "A") }
      }))
    );
    // Trigger hasAttemptedNext — navigation blocked (canMoveNext=false from fieldErrors)
    await act(async () => screen.getByText("Complete").click()); // single-step uses "Complete"
    expect(document.querySelector(".pw-shell__validation-label")).toBeNull();
    expect(screen.getByText("Form-level error")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// footerLayout
// ---------------------------------------------------------------------------

describe("PathShell — footerLayout", () => {
  it("auto mode uses wizard layout for multi-step paths", async () => {
    await act(async () => renderShell({ path: threeStepPath() }));
    // Next button on right, Back button hidden on first step
    const footer = document.querySelector(".pw-shell__footer")!;
    const leftButtons = footer.querySelector(".pw-shell__footer-left")!.querySelectorAll("button");
    const rightButtons = footer.querySelector(".pw-shell__footer-right")!.querySelectorAll("button");
    expect(leftButtons.length).toBe(0); // no back on first step
    expect(rightButtons.length).toBe(2); // Cancel + Next
  });

  it("auto mode uses form layout for single-step top-level paths", async () => {
    const singleStepPath: PathDefinition = {
      id: "form",
      steps: [{ id: "contact", title: "Contact Form" }]
    };
    await act(async () =>
      render(createElement(PathShell, {
        path: singleStepPath,
        steps: { contact: createElement("div", null, "Form Content") }
      }))
    );
    const footer = document.querySelector(".pw-shell__footer")!;
    const leftButtons = footer.querySelector(".pw-shell__footer-left")!.querySelectorAll("button");
    const rightButtons = footer.querySelector(".pw-shell__footer-right")!.querySelectorAll("button");
    expect(leftButtons.length).toBe(1); // Cancel on left in form mode
    expect(rightButtons.length).toBe(1); // Only Next on right
    expect(leftButtons[0].textContent).toBe("Cancel");
    expect(rightButtons[0].textContent).toBe("Complete");
  });

  it("explicit wizard mode overrides auto-detection", async () => {
    const singleStepPath: PathDefinition = {
      id: "form",
      steps: [{ id: "contact", title: "Contact Form" }]
    };
    await act(async () =>
      render(createElement(PathShell, {
        path: singleStepPath,
        steps: { contact: createElement("div", null, "Form Content") },
        footerLayout: "wizard"
      }))
    );
    const footer = document.querySelector(".pw-shell__footer")!;
    const leftButtons = footer.querySelector(".pw-shell__footer-left")!.querySelectorAll("button");
    const rightButtons = footer.querySelector(".pw-shell__footer-right")!.querySelectorAll("button");
    expect(leftButtons.length).toBe(0); // No back on first step in wizard mode
    expect(rightButtons.length).toBe(2); // Cancel + Next on right
  });

  it("renders inner step content when steps are keyed by inner step id (StepChoice)", async () => {
    const path: PathDefinition = {
      id: "test",
      steps: [
        {
          id: "type-choice",
          select: () => "type-b",
          steps: [{ id: "type-a" }, { id: "type-b" }],
        } satisfies StepChoice,
      ],
    };
    await act(async () =>
      render(createElement(PathShell, {
        path,
        steps: {
          "type-a": createElement("div", null, "Form A"),
          "type-b": createElement("div", null, "Form B"),
        }
      } as any))
    );
    expect(screen.getByText("Form B")).toBeTruthy();
    expect(screen.queryByText("Form A")).toBeNull();
  });

  it("explicit form mode overrides auto-detection", async () => {
    await act(async () => renderShell({ path: threeStepPath(), footerLayout: "form" }));
    const footer = document.querySelector(".pw-shell__footer")!;
    const leftButtons = footer.querySelector(".pw-shell__footer-left")!.querySelectorAll("button");
    const rightButtons = footer.querySelector(".pw-shell__footer-right")!.querySelectorAll("button");
    expect(leftButtons.length).toBe(1); // Cancel on left in form mode
    expect(rightButtons.length).toBe(1); // Only Next on right
    expect(leftButtons[0].textContent).toBe("Cancel");
  });
});

describe("PathShell — validateWhen", () => {
  it("does not show validation errors when validateWhen is false", async () => {
    const path: PathDefinition = {
      id: "p",
      steps: [
        { id: "step-a", title: "Step A", fieldErrors: () => ({ name: "Required" }) },
        { id: "step-b", title: "Step B" }
      ]
    };
    await act(async () =>
      render(createElement(PathShell, {
        path,
        validateWhen: false,
        validationDisplay: "summary",
        steps: { "step-a": createElement("div", null, "A"), "step-b": createElement("div", null, "B") }
      }))
    );
    expect(document.querySelector(".pw-shell__validation")).toBeNull();
  });

  it("shows validation errors on all steps when validateWhen becomes true", async () => {
    const path: PathDefinition = {
      id: "p",
      steps: [
        { id: "step-a", title: "Step A", fieldErrors: () => ({ name: "Required" }) },
        { id: "step-b", title: "Step B" }
      ]
    };
    const { rerender } = await act(async () =>
      render(createElement(PathShell, {
        path,
        validateWhen: false,
        validationDisplay: "summary",
        steps: { "step-a": createElement("div", null, "A"), "step-b": createElement("div", null, "B") }
      }))
    );
    expect(document.querySelector(".pw-shell__validation")).toBeNull();
    await act(async () =>
      rerender(createElement(PathShell, {
        path,
        validateWhen: true,
        validationDisplay: "summary",
        steps: { "step-a": createElement("div", null, "A"), "step-b": createElement("div", null, "B") }
      }))
    );
    expect(screen.getByText("Required")).toBeTruthy();
  });
});
