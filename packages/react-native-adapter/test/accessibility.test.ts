// @vitest-environment jsdom
//
// Accessibility of the React Native shell, asserted through the react-native
// stub in __mocks__/react-native.ts, which maps the accessibility props to
// their nearest ARIA equivalents.
//
// The shell shipped with none of these. `Pressable` has no implicit role, so
// VoiceOver and TalkBack announced every control as static text, never said a
// button was disabled (that was conveyed by opacity alone), and read the
// progress dots as a row of loose numbers. The busy state replaced the label
// with a spinner, leaving the button with nothing to announce at all.
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import type { PathDefinition } from "@daltonr/pathwrite-core";
import { PathShell } from "../src/index";

afterEach(() => cleanup());

const path: PathDefinition = {
  id: "p",
  steps: [
    { id: "details", title: "Details" },
    { id: "review", title: "Review" },
  ],
};

function renderShell(def: PathDefinition = path, props: Record<string, unknown> = {}) {
  const steps = Object.fromEntries(
    def.steps.map((s) => [s.id, createElement("span", null, `Content ${s.id}`)])
  );
  return act(async () => render(createElement(PathShell, { path: def, steps, ...props } as any)));
}

const byText = (re: RegExp) => screen.getByText(re).closest("button") as HTMLButtonElement;

describe("PathShell (RN) — every control is announced as a button", () => {
  it("Next and Cancel carry a button role", async () => {
    await renderShell();
    expect(byText(/Next →/).getAttribute("role")).toBe("button");
    expect(byText(/Cancel/).getAttribute("role")).toBe("button");
  });

  it("Previous carries a button role once it appears", async () => {
    await renderShell();
    await act(async () => byText(/Next →/).click());
    expect(byText(/Previous/).getAttribute("role")).toBe("button");
  });

  it("the start button on an unstarted shell carries a button role", async () => {
    await renderShell(path, { autoStart: false });
    expect(byText(/Start/).getAttribute("role")).toBe("button");
  });
});

describe("PathShell (RN) — disabled and busy are announced, not just styled", () => {
  const slow: PathDefinition = {
    id: "p",
    steps: [
      { id: "a", title: "A", onLeave: () => new Promise<void>((r) => setTimeout(r, 50)) },
      { id: "b", title: "B" },
    ],
  };

  it("a disabled control reports aria-disabled, not only reduced opacity", async () => {
    await renderShell(slow);
    const next = byText(/Next →/);
    // Kick off the slow leave without awaiting it: the shell is now busy.
    next.click();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    const cancel = screen.getByText(/Cancel/).closest("button") as HTMLButtonElement;
    expect(cancel.getAttribute("aria-disabled")).toBe("true");
  });

  it("the busy Next button keeps a label and reports aria-busy", async () => {
    await renderShell(slow);
    const next = byText(/Next →/);
    next.click();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    // The spinner replaces the visible text, so the button must carry its own
    // label or a screen reader has nothing at all to announce.
    const busy = screen.getByRole("button", { name: /working|loading|please wait/i });
    expect(busy.getAttribute("aria-busy")).toBe("true");
  });
});

describe("PathShell (RN) — progress is described, not drawn only", () => {
  it("the progress header exposes a progressbar with its position", async () => {
    await renderShell();
    const bar = screen.getByRole("progressbar");
    expect(bar.hasAttribute("aria-valuenow")).toBe(true);
    expect(bar.hasAttribute("aria-valuetext")).toBe(true);
  });

  it("each step dot is labelled with its number and state", async () => {
    await renderShell();
    expect(screen.getByLabelText(/step 1 of 2.*current/i)).toBeTruthy();
    expect(screen.getByLabelText(/step 2 of 2.*upcoming/i)).toBeTruthy();
  });
});

describe("PathShell (RN) — messages reach the screen reader when they appear", () => {
  const invalid: PathDefinition = {
    id: "p",
    steps: [
      {
        id: "details",
        title: "Details",
        fieldErrors: ({ data }) => (data.name ? {} : { name: "Required" }),
      },
      { id: "done", title: "Done" },
    ],
  };

  it("the validation summary is a live region", async () => {
    await renderShell(invalid);
    await act(async () => byText(/Next →/).click());
    const summary = screen.getByTestId("pw-validation");
    expect(summary.hasAttribute("aria-live")).toBe(true);
  });
});
