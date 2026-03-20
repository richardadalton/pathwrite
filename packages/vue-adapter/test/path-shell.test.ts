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

  it("shows Back button on the second step", async () => {
    const wrapper = mountShell();
    await settled();
    await wrapper.find(".pw-shell__btn--next").trigger("click");
    await settled();
    expect(wrapper.find(".pw-shell__btn--back").exists()).toBe(true);
    wrapper.unmount();
  });

  it("goes back when Back is clicked", async () => {
    const wrapper = mountShell();
    await settled();
    await wrapper.find(".pw-shell__btn--next").trigger("click");
    await settled();
    await wrapper.find(".pw-shell__btn--back").trigger("click");
    await settled();
    expect(wrapper.text()).toContain("Content A");
    wrapper.unmount();
  });

  it("shows Finish on the last step", async () => {
    const wrapper = mountShell();
    await settled();
    await wrapper.find(".pw-shell__btn--next").trigger("click");
    await settled();
    await wrapper.find(".pw-shell__btn--next").trigger("click");
    await settled();
    expect(wrapper.find(".pw-shell__btn--next").text()).toBe("Finish");
    wrapper.unmount();
  });

  it("emits complete when Finish is clicked", async () => {
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

  it("uses custom finish label on last step", async () => {
    const wrapper = mountShell({ finishLabel: "Complete" });
    await settled();
    await wrapper.find(".pw-shell__btn--next").trigger("click");
    await settled();
    await wrapper.find(".pw-shell__btn--next").trigger("click");
    await settled();
    expect(wrapper.find(".pw-shell__btn--next").text()).toBe("Complete");
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

