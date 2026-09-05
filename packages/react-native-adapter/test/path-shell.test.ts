// @vitest-environment jsdom
//
// PathShell (React Native) rendered through the react-native stub in
// __mocks__/react-native.ts: primitives become plain DOM elements, so these
// tests assert on the same behaviour the web shells are tested for.

import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

// ---------------------------------------------------------------------------
// validateWhen already true at mount (review finding A3)
// ---------------------------------------------------------------------------

describe("PathShell (React Native) — validateWhen true at mount", () => {
  it("shows the validation summary straight after mounting", async () => {
    const path: PathDefinition = {
      id: "p",
      steps: [
        { id: "step-a", title: "Step A", fieldErrors: () => ({ name: "Required" }) },
        { id: "step-b", title: "Step B" }
      ]
    };
    await renderShell(path, { validateWhen: true, validationDisplay: "summary" });
    expect(screen.getByText("Required")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Custom header visibility (review finding A7 — same drift as Solid)
// ---------------------------------------------------------------------------

describe("PathShell (React Native) — custom header visibility", () => {
  const renderHeader = (s: { stepIndex: number }) => createElement("span", { "data-testid": "custom-header" }, `Step ${s.stepIndex + 1}`);

  it("renders a custom header for a single-step path", async () => {
    await renderShell({ id: "s", steps: [{ id: "only" }] }, { renderHeader });
    expect(screen.queryByTestId("custom-header")).not.toBeNull();
  });

  it("hides a custom header when hideProgress is set", async () => {
    await renderShell({ id: "m", steps: [{ id: "a" }, { id: "b" }] }, { renderHeader, hideProgress: true });
    expect(screen.queryByTestId("custom-header")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// restoreKey — remount restores without re-running hooks or losing state
// ---------------------------------------------------------------------------

describe("PathShell (React Native) — restoreKey remount fidelity", () => {
  it("a remounted inner shell resumes where it was: no hooks re-fire, attempted state survives", async () => {
    const leaveA = vi.fn();
    const enterA = vi.fn();
    const enterB = vi.fn();
    const inner: PathDefinition = {
      id: "inner",
      steps: [
        { id: "inner-a", onLeave: leaveA, onEnter: enterA },
        { id: "inner-b", onEnter: enterB, fieldErrors: ({ data }) => (data.city ? {} : { city: "City required" }) },
      ]
    };
    const outer: PathDefinition = { id: "outer", steps: [{ id: "host" }, { id: "after" }] };
    function Host() {
      return createElement(PathShell, {
        path: inner, restoreKey: "inner", validationDisplay: "summary",
        steps: { "inner-a": createElement("span", null, "Inner Content A"), "inner-b": createElement("span", null, "Inner Content B") }
      } as any);
    }
    await act(async () => render(createElement(PathShell, {
      path: outer, nextLabel: "OuterNext", backLabel: "OuterBack",
      steps: { host: createElement(Host), after: createElement("span", null, "After") }
    } as any)));
    expect(enterA).toHaveBeenCalledTimes(1);

    const press = (re: RegExp) => act(async () => { (screen.getByText(re).closest("button") as HTMLButtonElement).click(); });
    await press(/^Next →$/);
    expect(screen.getByText("Inner Content B")).not.toBeNull();
    await press(/^Complete$/);
    expect(screen.getByText("City required")).not.toBeNull();

    await press(/OuterNext/);
    expect(screen.getByText("After")).not.toBeNull();
    await press(/OuterBack/);

    expect(screen.getByText("Inner Content B")).not.toBeNull();
    expect(screen.getByText("City required")).not.toBeNull();
    expect(enterA).toHaveBeenCalledTimes(1);
    expect(leaveA).toHaveBeenCalledTimes(1);
    expect(enterB).toHaveBeenCalledTimes(1);
  });
});
