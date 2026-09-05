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
