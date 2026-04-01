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
