// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mount, unmount, flushSync } from "svelte";
import type { PathDefinition } from "@daltonr/pathwrite-core";
import PathShell from "../src/PathShell.svelte";
import StepA from "./fixtures/StepA.svelte";
import StepB from "./fixtures/StepB.svelte";

// Mounted with Svelte's own mount() rather than @testing-library/svelte: that
// library's props helper is itself a .svelte.js module under node_modules,
// which the Svelte plugin does not compile in this setup.
let container: HTMLDivElement;
let instance: Record<string, unknown> | undefined;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  if (instance) unmount(instance);
  instance = undefined;
  container.remove();
});

function render(props: Record<string, unknown>) {
  instance = mount(PathShell, { target: container, props: props as any });
  flushSync();
  return { container };
}

const tick = async () => {
  await new Promise((r) => setTimeout(r, 0));
  flushSync();
};

// ---------------------------------------------------------------------------
// validateWhen already true at mount (review finding A3)
// ---------------------------------------------------------------------------

describe("PathShell (Svelte) — validateWhen true at mount", () => {
  it("shows the validation summary straight after mounting", async () => {
    const path: PathDefinition = {
      id: "p",
      steps: [
        { id: "step-a", title: "Step A", fieldErrors: () => ({ name: "Required" }) },
        { id: "step-b", title: "Step B" }
      ]
    };
    render({ path, validateWhen: true, validationDisplay: "summary", stepA: StepA, stepB: StepB });
    await tick();
    await tick();
    expect(container.querySelector(".step-a")).not.toBeNull();
    expect(container.querySelector(".pw-shell__validation")).not.toBeNull();
    expect(container.textContent).toContain("Required");
  });
});

// ---------------------------------------------------------------------------
// restart() from the completion panel (review finding A8 — the shell called
// restart(path, initialData) against a zero-argument signature)
// ---------------------------------------------------------------------------

describe("PathShell (Svelte) — restart from the completion panel", () => {
  it("Start over restarts from step 1 with the original initial data", async () => {
    const path: PathDefinition = { id: "p", steps: [{ id: "step-a" }, { id: "step-b" }] };
    render({ path, initialData: { name: "Ada" }, stepA: StepA, stepB: StepB });
    await tick();
    (container.querySelector(".pw-shell__btn--next") as HTMLButtonElement).click();
    await tick();
    (container.querySelector(".pw-shell__btn--next") as HTMLButtonElement).click();
    await tick();
    expect(container.querySelector(".pw-shell__completion")).not.toBeNull();

    (container.querySelector(".pw-shell__completion-restart") as HTMLButtonElement).click();
    await tick();
    expect(container.querySelector(".pw-shell__completion")).toBeNull();
    expect(container.querySelector(".step-a")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// restoreKey — remount restores without re-running hooks or losing state
// ---------------------------------------------------------------------------

import InnerHost from "./fixtures/InnerHost.svelte";
import AfterStep from "./fixtures/AfterStep.svelte";
import { calls, resetCalls } from "./fixtures/nested-fixture";

describe("PathShell (Svelte) — restoreKey remount fidelity", () => {
  const click = async (label: string) => {
    const btn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.trim() === label);
    expect(btn, `button "${label}"`).toBeDefined();
    (btn as HTMLButtonElement).click();
    await tick();
  };

  it("a remounted inner shell resumes where it was: no hooks re-fire, attempted state survives", async () => {
    resetCalls();
    const outer: PathDefinition = { id: "outer", steps: [{ id: "host" }, { id: "after" }] };
    render({ path: outer, nextLabel: "OuterNext", backLabel: "OuterBack", host: InnerHost, after: AfterStep });
    await tick();
    expect(calls.enterA).toBe(1);

    await click("InnerNext");
    expect(container.querySelector(".step-b")).not.toBeNull();
    await click("InnerComplete");
    expect(container.textContent).toContain("City required");
    expect(calls.leaveA).toBe(1);
    expect(calls.enterB).toBe(1);

    await click("OuterNext");
    expect(container.querySelector(".after")).not.toBeNull();
    expect(container.querySelector(".step-b")).toBeNull();
    await click("OuterBack");

    expect(container.querySelector(".step-b")).not.toBeNull();
    expect(container.textContent).toContain("City required");
    expect(calls).toEqual({ enterA: 1, leaveA: 1, enterB: 1 });
  });
});
