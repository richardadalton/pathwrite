// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";
import { PathShell, usePath, usePathContext } from "../src/index.js";
import { createRoot } from "solid-js";
import type { PathDefinition, PathSnapshot } from "@daltonr/pathwrite-core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function threeStepPath(id = "test"): PathDefinition {
  return {
    id,
    steps: [
      { id: "step-a", title: "Step A" },
      { id: "step-b", title: "Step B" },
      { id: "step-c", title: "Step C" },
    ],
  };
}

const singleStepPath: PathDefinition = {
  id: "single",
  steps: [{ id: "only" }],
};

let container: HTMLDivElement;
let dispose: (() => void) | undefined;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  dispose?.();
  dispose = undefined;
  container.remove();
});

/** Flush onMount and any pending async work. */
async function tick() {
  await new Promise<void>(resolve => setTimeout(resolve, 0));
}

function mountShell(props: Record<string, unknown> = {}) {
  dispose = render(
    () => (
      <PathShell
        path={threeStepPath()}
        steps={{
          "step-a": () => <div>Content A</div>,
          "step-b": () => <div>Content B</div>,
          "step-c": () => <div>Content C</div>,
        }}
        {...(props as any)}
      />
    ),
    container
  );
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe("PathShell (Solid) — rendering", () => {
  it("auto-starts and renders the first step content", async () => {
    mountShell();
    await tick();
    expect(container.textContent).toContain("Content A");
  });

  it("shows step labels in the progress header", async () => {
    mountShell();
    await tick();
    expect(container.textContent).toContain("Step A");
    expect(container.textContent).toContain("Step B");
    expect(container.textContent).toContain("Step C");
  });

  it("shows Next button on first step", async () => {
    mountShell();
    await tick();
    expect(container.querySelector(".pw-shell__btn--next")?.textContent).toBe("Next");
  });

  it("does not show Back button on first step", async () => {
    mountShell();
    await tick();
    expect(container.querySelector(".pw-shell__btn--back")).toBeNull();
  });

  it("shows Cancel button by default", async () => {
    mountShell();
    await tick();
    expect(container.querySelector(".pw-shell__btn--cancel")).not.toBeNull();
  });

  it("hides Cancel button when hideCancel is true", async () => {
    mountShell({ hideCancel: true });
    await tick();
    expect(container.querySelector(".pw-shell__btn--cancel")).toBeNull();
  });

  it("hides progress when hideProgress is true", async () => {
    mountShell({ hideProgress: true });
    await tick();
    expect(container.querySelector(".pw-shell__header")).toBeNull();
  });

  it("hides progress automatically for a single-step path", async () => {
    dispose = render(
      () => (
        <PathShell
          path={singleStepPath}
          steps={{ only: () => <div>Only step</div> }}
        />
      ),
      container
    );
    await tick();
    expect(container.querySelector(".pw-shell__header")).toBeNull();
  });

  it("shows progress for a multi-step path", async () => {
    mountShell();
    await tick();
    expect(container.querySelector(".pw-shell__header")).not.toBeNull();
  });

  it("renders empty state before start when autoStart is false", async () => {
    mountShell({ autoStart: false });
    await tick();
    expect(container.querySelector(".pw-shell__empty")).not.toBeNull();
  });

  it("shows Complete label on the last step", async () => {
    dispose = render(
      () => (
        <PathShell
          path={singleStepPath}
          steps={{ only: () => <div>Only step</div> }}
        />
      ),
      container
    );
    await tick();
    expect(container.querySelector(".pw-shell__btn--next")?.textContent).toBe("Complete");
  });

  it("applies custom nextLabel", async () => {
    mountShell({ nextLabel: "Continue" });
    await tick();
    expect(container.querySelector(".pw-shell__btn--next")?.textContent).toBe("Continue");
  });

  it("hides footer when hideFooter is true", async () => {
    mountShell({ hideFooter: true });
    await tick();
    expect(container.querySelector(".pw-shell__footer")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

describe("PathShell (Solid) — navigation", () => {
  it("advances to the next step on Next click", async () => {
    mountShell();
    await tick();
    expect(container.textContent).toContain("Content A");
    (container.querySelector(".pw-shell__btn--next") as HTMLButtonElement).click();
    await tick();
    expect(container.textContent).toContain("Content B");
  });

  it("goes back on Back click", async () => {
    mountShell();
    await tick();
    (container.querySelector(".pw-shell__btn--next") as HTMLButtonElement).click();
    await tick();
    expect(container.textContent).toContain("Content B");
    (container.querySelector(".pw-shell__btn--back") as HTMLButtonElement).click();
    await tick();
    expect(container.textContent).toContain("Content A");
  });

  it("shows Back button on second step", async () => {
    mountShell();
    await tick();
    (container.querySelector(".pw-shell__btn--next") as HTMLButtonElement).click();
    await tick();
    expect(container.querySelector(".pw-shell__btn--back")).not.toBeNull();
  });

  it("clears the shell on Cancel click", async () => {
    mountShell();
    await tick();
    (container.querySelector(".pw-shell__btn--cancel") as HTMLButtonElement).click();
    await tick();
    expect(container.querySelector(".pw-shell__empty")).not.toBeNull();
  });

  it("calls onComplete when path completes", async () => {
    const onComplete = vi.fn();
    dispose = render(
      () => (
        <PathShell
          path={singleStepPath}
          steps={{ only: () => <div>Only step</div> }}
          onComplete={onComplete}
        />
      ),
      container
    );
    await tick();
    (container.querySelector(".pw-shell__btn--next") as HTMLButtonElement).click();
    await tick();
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("calls onCancel when path is cancelled", async () => {
    const onCancel = vi.fn();
    mountShell({ onCancel });
    await tick();
    (container.querySelector(".pw-shell__btn--cancel") as HTMLButtonElement).click();
    await tick();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Validation display
// ---------------------------------------------------------------------------

describe("PathShell (Solid) — validation", () => {
  const guardedPath: PathDefinition = {
    id: "guarded",
    steps: [
      {
        id: "form",
        title: "Form",
        fieldErrors: ({ data }) =>
          data.name ? {} : { name: "Name is required." },
      },
      { id: "review", title: "Review" },
    ],
  };

  it("does not show validation summary before Next is clicked", async () => {
    dispose = render(
      () => (
        <PathShell
          path={guardedPath}
          steps={{ form: () => <div />, review: () => <div /> }}
        />
      ),
      container
    );
    await tick();
    expect(container.querySelector(".pw-shell__validation")).toBeNull();
  });

  it("shows validation summary after Next is clicked on an invalid step", async () => {
    dispose = render(
      () => (
        <PathShell
          path={guardedPath}
          initialData={{ name: "" }}
          steps={{ form: () => <div />, review: () => <div /> }}
        />
      ),
      container
    );
    await tick();
    (container.querySelector(".pw-shell__btn--next") as HTMLButtonElement).click();
    await tick();
    expect(container.querySelector(".pw-shell__validation")).not.toBeNull();
    expect(container.textContent).toContain("Name is required.");
  });

  it("suppresses summary when validationDisplay is inline", async () => {
    dispose = render(
      () => (
        <PathShell
          path={guardedPath}
          initialData={{ name: "" }}
          validationDisplay="inline"
          steps={{ form: () => <div />, review: () => <div /> }}
        />
      ),
      container
    );
    await tick();
    (container.querySelector(".pw-shell__btn--next") as HTMLButtonElement).click();
    await tick();
    expect(container.querySelector(".pw-shell__validation")).toBeNull();
  });

  it("shows validation summary when validateWhen becomes true", async () => {
    let setValidate!: (v: boolean) => void;
    const [validateWhen, setValidateWhenInner] = (() => {
      let v = false;
      const listeners: Array<() => void> = [];
      const get = () => v;
      const set = (next: boolean) => {
        v = next;
        listeners.forEach(l => l());
      };
      return [get, set] as const;
    })();

    // Use a reactive signal for validateWhen
    const { createSignal } = await import("solid-js");
    const [vw, setVw] = createSignal(false);

    dispose = render(
      () => (
        <PathShell
          path={guardedPath}
          initialData={{ name: "" }}
          validateWhen={vw()}
          steps={{ form: () => <div />, review: () => <div /> }}
        />
      ),
      container
    );
    await tick();
    expect(container.querySelector(".pw-shell__validation")).toBeNull();
    setVw(true);
    await tick();
    expect(container.querySelector(".pw-shell__validation")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Footer layout
// ---------------------------------------------------------------------------

describe("PathShell (Solid) — footer layout", () => {
  it("uses form layout for single-step path (Cancel left, no Back)", async () => {
    dispose = render(
      () => (
        <PathShell
          path={singleStepPath}
          steps={{ only: () => <div /> }}
        />
      ),
      container
    );
    await tick();
    const footer = container.querySelector(".pw-shell__footer")!;
    expect(footer.querySelector(".pw-shell__footer-left .pw-shell__btn--cancel")).not.toBeNull();
    expect(footer.querySelector(".pw-shell__btn--back")).toBeNull();
  });

  it("uses wizard layout for multi-step path (Cancel right)", async () => {
    mountShell();
    await tick();
    const footer = container.querySelector(".pw-shell__footer")!;
    expect(footer.querySelector(".pw-shell__footer-right .pw-shell__btn--cancel")).not.toBeNull();
  });

  it("explicit layout=wizard overrides auto", async () => {
    dispose = render(
      () => (
        <PathShell
          path={singleStepPath}
          layout="wizard"
          steps={{ only: () => <div /> }}
        />
      ),
      container
    );
    await tick();
    const footer = container.querySelector(".pw-shell__footer")!;
    expect(footer.querySelector(".pw-shell__footer-right .pw-shell__btn--cancel")).not.toBeNull();
  });

  it("layout=tabs hides both the progress header and footer", async () => {
    mountShell({ layout: "tabs" });
    await tick();
    expect(container.querySelector(".pw-shell__header")).toBeNull();
    expect(container.querySelector(".pw-shell__footer")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// usePathContext
// ---------------------------------------------------------------------------

describe("PathShell (Solid) — usePathContext", () => {
  it("provides snapshot to step components via context", async () => {
    let capturedStepId: string | undefined;

    function StepA() {
      const { snapshot } = usePathContext();
      capturedStepId = snapshot()?.stepId;
      return <div>Step A content</div>;
    }

    dispose = render(
      () => (
        <PathShell
          path={threeStepPath()}
          steps={{ "step-a": () => <StepA />, "step-b": () => <div />, "step-c": () => <div /> }}
        />
      ),
      container
    );
    await tick();
    expect(capturedStepId).toBe("step-a");
  });

  it("throws when usePathContext is called outside PathShell", () => {
    expect(() => {
      createRoot(() => usePathContext());
    }).toThrow("usePathContext must be used within a PathShell");
  });
});

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

describe("PathShell (Solid) — events", () => {
  it("calls onEvent for every engine event", async () => {
    const onEvent = vi.fn();
    mountShell({ onEvent });
    await tick();
    expect(onEvent).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Step component identity across engine events (review finding A1)
// ---------------------------------------------------------------------------

describe("PathShell (Solid) — step component identity across engine events", () => {
  function typeInto(input: HTMLInputElement, value: string) {
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  /** A step wired the way the Solid demos wire inputs: value from the
   *  context snapshot, onInput → setData. */
  function makeNameStep(onMount: () => void) {
    return function NameStep() {
      onMount();
      const ctx = usePathContext();
      return (
        <input
          id="name"
          type="text"
          value={(ctx.snapshot()?.data.name as string) ?? ""}
          onInput={(e) => ctx.setData("name", e.currentTarget.value)}
        />
      );
    };
  }

  const namePath: PathDefinition = {
    id: "name",
    steps: [{ id: "name" }, { id: "done" }],
  };

  it("keeps the same input element (and its focus) while the user types", async () => {
    const mounted = vi.fn();
    const NameStep = makeNameStep(mounted);

    dispose = render(
      () => <PathShell path={namePath} steps={{ name: () => <NameStep />, done: () => <div /> }} />,
      container
    );
    await tick();

    const input = container.querySelector("input#name") as HTMLInputElement;
    expect(input).not.toBeNull();
    // start() emits an "entering" and then an "idle" snapshot — one mount, not two.
    expect(mounted).toHaveBeenCalledTimes(1);
    const mountsAfterStart = mounted.mock.calls.length;

    input.focus();
    expect(document.activeElement).toBe(input);

    typeInto(input, "A");
    await tick();
    typeInto(container.querySelector("input#name") as HTMLInputElement, "Al");
    await tick();
    typeInto(container.querySelector("input#name") as HTMLInputElement, "Ali");
    await tick();

    // The data flowed through the engine...
    expect((container.querySelector("input#name") as HTMLInputElement).value).toBe("Ali");
    // ...without the step being torn down and re-created on each keystroke.
    expect(container.querySelector("input#name")).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(mounted.mock.calls.length - mountsAfterStart).toBe(0);
  });

  it("does not remount the step for engine events that leave the step unchanged", async () => {
    const mounted = vi.fn();
    const NameStep = makeNameStep(mounted);
    let ctx!: ReturnType<typeof usePathContext>;

    function Probe() {
      ctx = usePathContext();
      return null;
    }

    dispose = render(
      () => (
        <PathShell
          path={namePath}
          steps={{ name: () => <><Probe /><NameStep /></>, done: () => <div /> }}
        />
      ),
      container
    );
    await tick();
    const input = container.querySelector("input#name");
    const mountsAfterStart = mounted.mock.calls.length;

    // Events that do not change the current step: setData, validate, resetStep.
    await ctx.setData("name", "x");
    await tick();
    ctx.validate();
    await tick();
    await ctx.resetStep();
    await tick();

    expect(mounted.mock.calls.length - mountsAfterStart).toBe(0);
    expect(container.querySelector("input#name")).toBe(input);
  });

  it("does mount a new component when the step actually changes", async () => {
    const mounted = vi.fn();
    const NameStep = makeNameStep(mounted);
    const doneMounted = vi.fn();

    dispose = render(
      () => (
        <PathShell
          path={namePath}
          steps={{
            name: () => <NameStep />,
            done: () => { doneMounted(); return <div>Done</div>; },
          }}
        />
      ),
      container
    );
    await tick();
    const mountsAfterStart = mounted.mock.calls.length;
    (container.querySelector(".pw-shell__btn--next") as HTMLButtonElement).click();
    await tick();

    expect(container.textContent).toContain("Done");
    // The old step must not be re-created for the "validating" / "leaving"
    // events on the way out, and the new step is created exactly once.
    expect(mounted.mock.calls.length - mountsAfterStart).toBe(0);
    expect(doneMounted).toHaveBeenCalledTimes(1);
  });
});

describe("PathShell (Solid) — the snapshot passed to a step render function is live", () => {
  it("a step that keeps the snapshot prop sees new data without being re-created", async () => {
    const mounted = vi.fn();
    let ctx!: ReturnType<typeof usePathContext>;

    function PlanStep(props: { snapshot: PathSnapshot }) {
      mounted();
      ctx = usePathContext();
      const plan = () => (props.snapshot.data.plan as string) ?? "none";
      const errors = () => Object.keys(props.snapshot.fieldErrors).length;
      return <p id="plan">{plan()} / {errors()} / {String(props.snapshot.hasAttemptedNext)}</p>;
    }

    dispose = render(
      () => (
        <PathShell
          path={{ id: "sub", steps: [{ id: "plan", fieldErrors: ({ data }) => (data.plan ? {} : { plan: "pick one" }) }, { id: "pay" }] }}
          steps={{ plan: (snap) => <PlanStep snapshot={snap} />, pay: () => <div /> }}
        />
      ),
      container
    );
    await tick();
    const p = container.querySelector("p#plan")!;
    expect(p.textContent).toBe("none / 1 / false");

    (container.querySelector(".pw-shell__btn--next") as HTMLButtonElement).click();
    await tick();
    expect(p.textContent).toBe("none / 1 / true");

    await ctx.setData("plan", "pro");
    await tick();
    expect(container.querySelector("p#plan")).toBe(p);
    expect(p.textContent).toBe("pro / 0 / true");
    expect(mounted).toHaveBeenCalledTimes(1);
  });

  it("a sub-path step with the same id as the parent's step is a different component", async () => {
    const parentMounted = vi.fn();
    const subMounted = vi.fn();
    let ctx!: ReturnType<typeof usePathContext>;

    function Details() {
      ctx = usePathContext();
      if (ctx.snapshot()?.nestingLevel === 0) parentMounted(); else subMounted();
      return <div>details@{ctx.snapshot()?.pathId}</div>;
    }

    dispose = render(
      () => (
        <PathShell
          path={{ id: "parent", steps: [{ id: "details" }, { id: "end" }] }}
          steps={{ details: () => <Details />, end: () => <div /> }}
        />
      ),
      container
    );
    await tick();
    expect(parentMounted).toHaveBeenCalledTimes(1);

    await ctx.startSubPath({ id: "child", steps: [{ id: "details" }] });
    await tick();
    expect(container.textContent).toContain("details@child");
    expect(subMounted).toHaveBeenCalledTimes(1);

    await ctx.next(); // completes the sub-path, resumes the parent
    await tick();
    expect(container.textContent).toContain("details@parent");
    expect(parentMounted).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// validateWhen already true at mount (review finding A3)
// ---------------------------------------------------------------------------

describe("PathShell (Solid) — validateWhen true at mount", () => {
  it("shows the validation summary straight after mounting", async () => {
    const path: PathDefinition = {
      id: "p",
      steps: [
        { id: "step-a", title: "Step A", fieldErrors: () => ({ name: "Required" }) },
        { id: "step-b", title: "Step B" },
      ],
    };
    dispose = render(
      () => (
        <PathShell
          path={path}
          validateWhen={true}
          validationDisplay="summary"
          steps={{ "step-a": () => <div>A</div>, "step-b": () => <div>B</div> }}
        />
      ),
      container
    );
    await tick();
    expect(container.querySelector(".pw-shell__validation")).not.toBeNull();
    expect(container.textContent).toContain("Required");
  });
});

// ---------------------------------------------------------------------------
// StepChoice content lookup — formId then stepId (review finding A5)
// ---------------------------------------------------------------------------

describe("PathShell (Solid) — StepChoice content lookup", () => {
  const choicePath: PathDefinition = {
    id: "choice",
    steps: [
      {
        id: "type",
        select: () => "type-b",
        steps: [{ id: "type-a" }, { id: "type-b" }],
      },
      { id: "done" },
    ],
  };

  it("falls back to the choice id when nothing is registered under the inner step id", async () => {
    dispose = render(
      () => <PathShell path={choicePath} steps={{ type: () => <div class="by-choice">Choice content</div>, done: () => <div /> }} />,
      container
    );
    await tick();
    expect(container.querySelector(".by-choice")).not.toBeNull();
  });

  it("prefers the inner step id when both are registered", async () => {
    dispose = render(
      () => (
        <PathShell
          path={choicePath}
          steps={{
            type: () => <div class="by-choice">Choice content</div>,
            "type-b": () => <div class="by-inner">Inner B</div>,
            done: () => <div />,
          }}
        />
      ),
      container
    );
    await tick();
    expect(container.querySelector(".by-inner")).not.toBeNull();
    expect(container.querySelector(".by-choice")).toBeNull();
  });
});
