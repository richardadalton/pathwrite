// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { mount, flushPromises, VueWrapper } from "@vue/test-utils";
import { PathDefinition, PathSnapshot } from "@daltonr/pathwrite-core";
import { PathShell, PathShellActions, usePathContext, usePath } from "../src/index";

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

function mountShell(props: Record<string, unknown> = {}) {
  const TestHost = defineComponent({
    setup() {
      return () =>
        h(
          PathShell,
          { path: threeStepPath(), ...props },
          {
            "step-a": () => h("div", "Content A"),
            "step-b": () => h("div", "Content B"),
            "step-c": () => h("div", "Content C")
          }
        );
    }
  });
  return mount(TestHost, { attachTo: document.body });
}

async function settled(wrapper?: VueWrapper) {
  await flushPromises();
  await nextTick();
  await flushPromises();
  await nextTick();
}

// ---------------------------------------------------------------------------
// Auto-start + rendering
// ---------------------------------------------------------------------------

describe("PathShell (Vue) — rendering", () => {
  it("auto-starts and renders the first step content", async () => {
    const wrapper = mountShell();
    await settled();
    expect(wrapper.text()).toContain("Content A");
    wrapper.unmount();
  });

  it("shows step labels in the progress header", async () => {
    const wrapper = mountShell();
    await settled();
    expect(wrapper.text()).toContain("Step A");
    expect(wrapper.text()).toContain("Step B");
    expect(wrapper.text()).toContain("Step C");
    wrapper.unmount();
  });

  it("shows Next button on first step", async () => {
    const wrapper = mountShell();
    await settled();
    expect(wrapper.find(".pw-shell__btn--next").text()).toBe("Next");
    wrapper.unmount();
  });

  it("does not show Back button on first step", async () => {
    const wrapper = mountShell();
    await settled();
    expect(wrapper.find(".pw-shell__btn--back").exists()).toBe(false);
    wrapper.unmount();
  });

  it("shows Cancel button by default", async () => {
    const wrapper = mountShell();
    await settled();
    expect(wrapper.find(".pw-shell__btn--cancel").exists()).toBe(true);
    wrapper.unmount();
  });

  it("hides Cancel button when hideCancel is true", async () => {
    const wrapper = mountShell({ hideCancel: true });
    await settled();
    expect(wrapper.find(".pw-shell__btn--cancel").exists()).toBe(false);
    wrapper.unmount();
  });

  it("hides progress when hideProgress is true", async () => {
    const wrapper = mountShell({ hideProgress: true });
    await settled();
    expect(wrapper.find(".pw-shell__header").exists()).toBe(false);
    wrapper.unmount();
  });

  it("hides progress automatically for a single-step path", async () => {
    const singleStepPath: PathDefinition = { id: "single", steps: [{ id: "only" }] };
    const TestHost = defineComponent({
      setup() {
        return () => h(PathShell, { path: singleStepPath }, { only: () => h("div", "Only step") });
      }
    });
    const wrapper = mount(TestHost, { attachTo: document.body });
    await settled();
    expect(wrapper.find(".pw-shell__header").exists()).toBe(false);
    wrapper.unmount();
  });

  it("still shows progress for a multi-step path", async () => {
    const wrapper = mountShell();
    await settled();
    expect(wrapper.find(".pw-shell__header").exists()).toBe(true);
    wrapper.unmount();
  });

  it("still shows progress for a single-step sub-path (nestingLevel > 0)", async () => {
    const { PathEngine } = await import("@daltonr/pathwrite-core");
    const subPath: PathDefinition = { id: "sub", steps: [{ id: "sub-only", title: "Sub Step" }] };
    const parentPath: PathDefinition = { id: "parent", steps: [{ id: "parent-step" }] };
    const engine = new PathEngine();
    await engine.start(parentPath, {});
    await engine.startSubPath(subPath, {});

    const TestHost = defineComponent({
      setup() {
        return () =>
          h(PathShell, { path: subPath, engine }, { "sub-only": () => h("div", "Sub content") });
      }
    });
    const wrapper = mount(TestHost, { attachTo: document.body });
    await settled();
    expect(wrapper.find(".pw-shell__header").exists()).toBe(true);
    wrapper.unmount();
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

    const TestHost = defineComponent({
      setup() {
        return () => h(PathShell, { path: subPath, engine }, {
          s1: () => h("div", "Sub step 1"),
          s2: () => h("div", "Sub step 2")
        });
      }
    });
    const wrapper = mount(TestHost, { attachTo: document.body });
    await settled();
    expect(wrapper.find(".pw-shell__root-progress").exists()).toBe(true);
    expect(wrapper.find(".pw-shell__header").exists()).toBe(true);
    wrapper.unmount();
  });

  it("does not render root progress bar at the top level", async () => {
    const wrapper = mountShell();
    await settled();
    expect(wrapper.find(".pw-shell__root-progress").exists()).toBe(false);
    wrapper.unmount();
  });
});

// ---------------------------------------------------------------------------
// restart() via component ref (expose)
// ---------------------------------------------------------------------------

describe("PathShell (Vue) — restart via component ref", () => {
  it("exposes restart() on the component instance", async () => {
    const wrapper = mount(PathShell, {
      attachTo: document.body,
      props: { path: threeStepPath() },
      slots: {
        "step-a": () => h("div", "Content A"),
        "step-b": () => h("div", "Content B"),
        "step-c": () => h("div", "Content C"),
      }
    });
    await settled();
    expect(typeof (wrapper.vm as any).restart).toBe("function");
    wrapper.unmount();
  });

  it("restarts the path from step 1 when restart() is called via the component ref", async () => {
    const wrapper = mount(PathShell, {
      attachTo: document.body,
      props: { path: threeStepPath() },
      slots: {
        "step-a": () => h("div", "Content A"),
        "step-b": () => h("div", "Content B"),
        "step-c": () => h("div", "Content C"),
      }
    });
    await settled();

    // Navigate to step B
    await wrapper.find(".pw-shell__btn--next").trigger("click");
    await settled();
    expect(wrapper.text()).toContain("Content B");

    // Restart via the component ref (simulating what shellRef.value.restart() does)
    await (wrapper.vm as any).restart();
    await settled();

    // Should be back at step A
    expect(wrapper.text()).toContain("Content A");
    expect(wrapper.text()).not.toContain("Content B");
    wrapper.unmount();
  });
});

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

describe("PathShell (Vue) — navigation", () => {
  it("advances to the next step when Next is clicked", async () => {
    const wrapper = mountShell();
    await settled();
    await wrapper.find(".pw-shell__btn--next").trigger("click");
    await settled();
    expect(wrapper.text()).toContain("Content B");
    expect(wrapper.text()).not.toContain("Content A");
    wrapper.unmount();
  });

  it("shows Previous button on the second step", async () => {
    const wrapper = mountShell();
    await settled();
    await wrapper.find(".pw-shell__btn--next").trigger("click");
    await settled();
    expect(wrapper.find(".pw-shell__btn--back").exists()).toBe(true);
    wrapper.unmount();
  });

  it("goes back when Previous is clicked", async () => {
    const wrapper = mountShell();
    await settled();
    await wrapper.find(".pw-shell__btn--next").trigger("click");
    await settled();
    await wrapper.find(".pw-shell__btn--back").trigger("click");
    await settled();
    expect(wrapper.text()).toContain("Content A");
    wrapper.unmount();
  });

  it("shows Complete on the last step", async () => {
    const wrapper = mountShell();
    await settled();
    await wrapper.find(".pw-shell__btn--next").trigger("click");
    await settled();
    await wrapper.find(".pw-shell__btn--next").trigger("click");
    await settled();
    expect(wrapper.find(".pw-shell__btn--next").text()).toBe("Complete");
    wrapper.unmount();
  });

  it("emits complete when Complete is clicked", async () => {
    const onComplete = vi.fn();
    const wrapper = mountShell({ onComplete });
    await settled();
    await wrapper.find(".pw-shell__btn--next").trigger("click");
    await settled();
    await wrapper.find(".pw-shell__btn--next").trigger("click");
    await settled();
    await wrapper.find(".pw-shell__btn--next").trigger("click");
    await settled();
    // Check the PathShell emitted 'complete'
    const shell = wrapper.findComponent(PathShell);
    expect(shell.emitted("complete")).toBeTruthy();
    wrapper.unmount();
  });

  it("emits cancel when Cancel is clicked", async () => {
    const wrapper = mountShell();
    await settled();
    await wrapper.find(".pw-shell__btn--cancel").trigger("click");
    await settled();
    const shell = wrapper.findComponent(PathShell);
    expect(shell.emitted("cancel")).toBeTruthy();
    wrapper.unmount();
  });
});

// ---------------------------------------------------------------------------
// restart via #footer slot actions
// ---------------------------------------------------------------------------

describe("PathShell (Vue) — restart via actions", () => {
  it("actions.restart() resets to step 1 from mid-flow via #footer slot", async () => {
    const TestHost = defineComponent({
      setup() {
        return () =>
          h(
            PathShell,
            { path: threeStepPath() },
            {
              "step-a": () => h("div", { "data-testid": "content-a" }, "Content A"),
              "step-b": () => h("div", { "data-testid": "content-b" }, "Content B"),
              "step-c": () => h("div", "Content C"),
              footer: ({ actions }: { snapshot: PathSnapshot; actions: PathShellActions }) =>
                h("div", [
                  h("button", { "data-testid": "footer-next", onClick: actions.next }, "Next"),
                  h("button", { "data-testid": "footer-restart", onClick: actions.restart }, "Restart")
                ])
            }
          );
      }
    });
    const wrapper = mount(TestHost, { attachTo: document.body });
    await settled();
    expect(wrapper.find("[data-testid='content-a']").exists()).toBe(true);

    await wrapper.find("[data-testid='footer-next']").trigger("click");
    await settled();
    expect(wrapper.find("[data-testid='content-b']").exists()).toBe(true);

    await wrapper.find("[data-testid='footer-restart']").trigger("click");
    await settled();
    expect(wrapper.find("[data-testid='content-a']").exists()).toBe(true);
    wrapper.unmount();
  });

  it("actions.restart() from the last step returns to step 1 without completing", async () => {
    const TestHost = defineComponent({
      setup() {
        return () =>
          h(
            PathShell,
            { path: threeStepPath() },
            {
              "step-a": () => h("div", { "data-testid": "content-a" }, "Content A"),
              "step-b": () => h("div", "Content B"),
              "step-c": () => h("div", { "data-testid": "content-c" }, "Content C"),
              footer: ({ actions }: { snapshot: PathSnapshot; actions: PathShellActions }) =>
                h("div", [
                  h("button", { "data-testid": "footer-next", onClick: actions.next }, "Next"),
                  h("button", { "data-testid": "footer-restart", onClick: actions.restart }, "Restart")
                ])
            }
          );
      }
    });
    const wrapper = mount(TestHost, { attachTo: document.body });
    await settled();

    // Advance to last step
    await wrapper.find("[data-testid='footer-next']").trigger("click");
    await settled();
    await wrapper.find("[data-testid='footer-next']").trigger("click");
    await settled();
    expect(wrapper.find("[data-testid='content-c']").exists()).toBe(true);

    // Restart before finishing
    await wrapper.find("[data-testid='footer-restart']").trigger("click");
    await settled();
    expect(wrapper.find("[data-testid='content-a']").exists()).toBe(true);
    wrapper.unmount();
  });
});

// ---------------------------------------------------------------------------
// Custom labels
// ---------------------------------------------------------------------------

describe("PathShell (Vue) — custom labels", () => {
  it("uses custom button labels", async () => {
    const wrapper = mountShell({
      backLabel: "Prev",
      nextLabel: "Forward",
      cancelLabel: "Abort"
    });
    await settled();
    expect(wrapper.find(".pw-shell__btn--next").text()).toBe("Forward");
    expect(wrapper.find(".pw-shell__btn--cancel").text()).toBe("Abort");
    wrapper.unmount();
  });

  it("uses custom complete label on last step", async () => {
    const wrapper = mountShell({ completeLabel: "Done" });
    await settled();
    await wrapper.find(".pw-shell__btn--next").trigger("click");
    await settled();
    await wrapper.find(".pw-shell__btn--next").trigger("click");
    await settled();
    expect(wrapper.find(".pw-shell__btn--next").text()).toBe("Done");
    wrapper.unmount();
  });
});

// ---------------------------------------------------------------------------
// Progress indicator
// ---------------------------------------------------------------------------

describe("PathShell (Vue) — progress", () => {
  it("marks the first step as current and others as upcoming", async () => {
    const wrapper = mountShell();
    await settled();
    const steps = wrapper.findAll(".pw-shell__step");
    expect(steps.length).toBe(3);
    expect(steps[0].classes()).toContain("pw-shell__step--current");
    expect(steps[1].classes()).toContain("pw-shell__step--upcoming");
    expect(steps[2].classes()).toContain("pw-shell__step--upcoming");
    wrapper.unmount();
  });

  it("marks completed steps after navigation", async () => {
    const wrapper = mountShell();
    await settled();
    await wrapper.find(".pw-shell__btn--next").trigger("click");
    await settled();
    const steps = wrapper.findAll(".pw-shell__step");
    expect(steps[0].classes()).toContain("pw-shell__step--completed");
    expect(steps[1].classes()).toContain("pw-shell__step--current");
    wrapper.unmount();
  });

  it("shows a checkmark on completed steps", async () => {
    const wrapper = mountShell();
    await settled();
    await wrapper.find(".pw-shell__btn--next").trigger("click");
    await settled();
    const dots = wrapper.findAll(".pw-shell__step-dot");
    expect(dots[0].text()).toBe("✓");
    expect(dots[1].text()).toBe("2");
    wrapper.unmount();
  });
});

// ---------------------------------------------------------------------------
// autoStart = false
// ---------------------------------------------------------------------------

describe("PathShell (Vue) — autoStart false", () => {
  it("shows empty state with Start button when autoStart is false", async () => {
    const wrapper = mountShell({ autoStart: false });
    await settled();
    expect(wrapper.text()).toContain("No active path.");
    expect(wrapper.find(".pw-shell__start-btn").exists()).toBe(true);
    wrapper.unmount();
  });

  it("starts the path when Start button is clicked", async () => {
    const wrapper = mountShell({ autoStart: false });
    await settled();
    await wrapper.find(".pw-shell__start-btn").trigger("click");
    await settled();
    expect(wrapper.text()).toContain("Content A");
    wrapper.unmount();
  });
});

// ---------------------------------------------------------------------------
// Context sharing — usePathContext inside PathShell
// ---------------------------------------------------------------------------

describe("PathShell (Vue) — context sharing", () => {
  it("usePathContext returns snapshot inside a PathShell named slot", async () => {
    const StepChild = defineComponent({
      setup() {
        const { snapshot } = usePathContext();
        return () => h("span", { "data-testid": "ctx-step" }, snapshot.value?.stepId ?? "none");
      }
    });

    const TestHost = defineComponent({
      setup() {
        return () =>
          h(
            PathShell,
            { path: threeStepPath() },
            {
              "step-a": () => h(StepChild),
              "step-b": () => h("div", "B"),
              "step-c": () => h("div", "C")
            }
          );
      }
    });

    const wrapper = mount(TestHost, { attachTo: document.body });
    await settled();
    expect(wrapper.find("[data-testid='ctx-step']").text()).toBe("step-a");
    wrapper.unmount();
  });

  it("usePathContext actions drive navigation from inside a named slot", async () => {
    const StepChild = defineComponent({
      setup() {
        const { next } = usePathContext();
        return () => h("button", { "data-testid": "inner-next", onClick: next }, "Inner Next");
      }
    });

    const TestHost = defineComponent({
      setup() {
        return () =>
          h(
            PathShell,
            { path: threeStepPath() },
            {
              "step-a": () => h(StepChild),
              "step-b": () => h("div", "Content B"),
              "step-c": () => h("div", "C")
            }
          );
      }
    });

    const wrapper = mount(TestHost, { attachTo: document.body });
    await settled();
    await wrapper.find("[data-testid='inner-next']").trigger("click");
    await settled();
    expect(wrapper.text()).toContain("Content B");
    wrapper.unmount();
  });
});

// ---------------------------------------------------------------------------
// fieldErrors
// ---------------------------------------------------------------------------

describe("PathShell (Vue) — fieldErrors", () => {
  it("does not render messages before the user has attempted to proceed", async () => {
    const path: PathDefinition = {
      id: "p",
      steps: [
        { id: "step-a", title: "Step A", fieldErrors: () => ({ name: "Required", email: "Invalid email address" }) },
        { id: "step-b", title: "Step B" }
      ]
    };
    const TestHost = defineComponent({
      setup() {
        return () => h(PathShell, { path }, { "step-a": () => h("div", "A"), "step-b": () => h("div", "B") });
      }
    });
    const wrapper = mount(TestHost, { attachTo: document.body });
    await settled();
    expect(wrapper.find(".pw-shell__validation").exists()).toBe(false);
    wrapper.unmount();
  });

  it("renders labeled messages after clicking Next when navigation is blocked", async () => {
    const path: PathDefinition = {
      id: "p",
      steps: [
        { id: "step-a", title: "Step A", fieldErrors: () => ({ name: "Required", email: "Invalid email address" }) },
        { id: "step-b", title: "Step B" }
      ]
    };
    const TestHost = defineComponent({
      setup() {
        return () => h(PathShell, { path, validationDisplay: "summary" }, { "step-a": () => h("div", "A"), "step-b": () => h("div", "B") });
      }
    });
    const wrapper = mount(TestHost, { attachTo: document.body });
    await settled();
    await wrapper.find(".pw-shell__btn--next").trigger("click");
    await settled();
    expect(wrapper.text()).toContain("Name");
    expect(wrapper.text()).toContain("Required");
    expect(wrapper.text()).toContain("Email");
    expect(wrapper.text()).toContain("Invalid email address");
    wrapper.unmount();
  });

  it("does not render the validation list when fieldErrors is empty", async () => {
    const path: PathDefinition = {
      id: "p",
      steps: [{ id: "step-a", title: "Step A", fieldErrors: () => ({}) }]
    };
    const TestHost = defineComponent({
      setup() {
        return () => h(PathShell, { path }, { "step-a": () => h("div", "A") });
      }
    });
    const wrapper = mount(TestHost, { attachTo: document.body });
    await settled();
    await wrapper.find(".pw-shell__btn--next").trigger("click");
    await settled();
    expect(wrapper.find(".pw-shell__validation").exists()).toBe(false);
    wrapper.unmount();
  });

  it("resets hasAttemptedNext when navigating to a new step", async () => {
    const path: PathDefinition = {
      id: "p",
      steps: [
        { id: "step-a", title: "Step A", fieldErrors: () => ({ field: "Fill this in" }), canMoveNext: () => true },
        { id: "step-b", title: "Step B", fieldErrors: () => ({ other: "Also required" }) }
      ]
    };
    const TestHost = defineComponent({
      setup() {
        return () => h(PathShell, { path }, { "step-a": () => h("div", "A"), "step-b": () => h("div", "B") });
      }
    });
    const wrapper = mount(TestHost, { attachTo: document.body });
    await settled();
    await wrapper.find(".pw-shell__btn--next").trigger("click");
    await settled();
    expect(wrapper.text()).toContain("B");
    expect(wrapper.find(".pw-shell__validation").exists()).toBe(false);
    wrapper.unmount();
  });

  it("does not render a label span for the _ key", async () => {
    const path: PathDefinition = {
      id: "p",
      steps: [{ id: "step-a", title: "Step A", fieldErrors: () => ({ _: "Form-level error" }) }]
    };
    const TestHost = defineComponent({
      setup() {
        return () => h(PathShell, { path, validationDisplay: "summary" }, { "step-a": () => h("div", "A") });
      }
    });
    const wrapper = mount(TestHost, { attachTo: document.body });
    await settled();
    await wrapper.find(".pw-shell__btn--next").trigger("click");
    await settled();
    expect(wrapper.find(".pw-shell__validation-label").exists()).toBe(false);
    expect(wrapper.text()).toContain("Form-level error");
    wrapper.unmount();
  });
});

