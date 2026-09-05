// @vitest-environment jsdom
//
// PathShell (React Native) rendered through the react-native stub in
// __mocks__/react-native.ts: primitives become plain DOM elements, so these
// tests assert on the same behaviour the web shells are tested for.

import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import type { PathDefinition } from "@daltonr/pathwrite-core";
import { PathShell } from "../src/index";

afterEach(() => cleanup());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderShell(path: PathDefinition, props: Record<string, unknown> = {}) {
  const steps = Object.fromEntries(path.steps.map((s) => [s.id, createElement("span", null, `Content ${s.id}`)]));
  return act(async () => render(createElement(PathShell, { path, steps, ...props } as any)));
}

function nextButton(): HTMLButtonElement {
  const label = screen.getByText(/Next →|Complete/);
  return label.closest("button") as HTMLButtonElement;
}

// ---------------------------------------------------------------------------
// Next stays pressable when the guard would block (review finding A2)
// ---------------------------------------------------------------------------

describe("PathShell (React Native) — Next is pressable when the step is invalid", () => {
  const fieldErrorsPath: PathDefinition = {
    id: "p",
    steps: [
      { id: "details", title: "Details", fieldErrors: ({ data }) => (data.name ? {} : { name: "Required" }) },
      { id: "done", title: "Done" }
    ]
  };

  it("does not disable Next because canMoveNext is false", async () => {
    await renderShell(fieldErrorsPath);
    const btn = nextButton();
    expect(btn).not.toBeNull();
    expect(btn.disabled).toBe(false);
  });

  it("pressing Next on an invalid step reveals the validation summary", async () => {
    await renderShell(fieldErrorsPath, { validationDisplay: "summary" });
    expect(screen.queryByText("Required")).toBeNull(); // punished late: nothing until an attempt

    await act(async () => { nextButton().click(); });

    expect(screen.getByText("Required")).not.toBeNull();
    expect(screen.getByText("Content details")).not.toBeNull(); // still on the step
  });

  it("pressing Next on a step blocked by canMoveNext shows the blocking reason", async () => {
    const guarded: PathDefinition = {
      id: "g",
      steps: [
        { id: "terms", title: "Terms", canMoveNext: ({ data }) => (data.accepted ? true : { allowed: false, reason: "Accept the terms first" }) },
        { id: "done", title: "Done" }
      ]
    };
    await renderShell(guarded);
    expect(screen.queryByText("Accept the terms first")).toBeNull();
    expect(nextButton().disabled).toBe(false);

    await act(async () => { nextButton().click(); });

    expect(screen.getByText("Accept the terms first")).not.toBeNull();
    expect(screen.getByText("Content terms")).not.toBeNull();
  });

  it("still disables Next while a navigation is in flight", async () => {
    let release!: () => void;
    const slow: PathDefinition = {
      id: "s",
      steps: [
        { id: "a", title: "A", onLeave: () => new Promise<void>((r) => { release = r; }) },
        { id: "b", title: "B" }
      ]
    };
    await renderShell(slow);
    expect(nextButton().disabled).toBe(false);

    await act(async () => { nextButton().click(); });
    // The "Next →" label is replaced by the spinner while busy; find the button by its footer position.
    const busy = document.querySelector("button[disabled]") as HTMLButtonElement | null;
    expect(busy).not.toBeNull();

    await act(async () => { release(); });
    expect(nextButton().disabled).toBe(false);
    expect(screen.getByText("Content b")).not.toBeNull();
  });
});
