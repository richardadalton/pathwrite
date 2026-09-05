// @vitest-environment jsdom
import "zone.js";
import "zone.js/testing";
import "@angular/compiler";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Component, TemplateRef } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from "@angular/platform-browser-dynamic/testing";
import type { PathDefinition } from "@daltonr/pathwrite-core";
import { PathShellComponent, PathStepDirective, PathShellHeaderDirective } from "../src/shell";

beforeAll(() => {
  // vitest compiles TypeScript with esbuild, which emits no decorator
  // metadata, so Angular's JIT compiler cannot see constructor parameter
  // types. The shell component uses inject() and needs nothing; the pwStep
  // directive takes TemplateRef through its constructor, so give JIT the
  // same ctorParameters hint the AOT compiler would have written.
  (PathStepDirective as any).ctorParameters = () => [{ type: TemplateRef }];
  (PathShellHeaderDirective as any).ctorParameters = () => [{ type: TemplateRef }];
  TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting(), { teardown: { destroyAfterEach: true } });
});
afterEach(() => TestBed.resetTestingModule());

const tick = () => new Promise((r) => setTimeout(r, 0));

// ---------------------------------------------------------------------------
// validateWhen already true at mount (review finding A3)
// ---------------------------------------------------------------------------

describe("PathShell (Angular) — validateWhen true at mount", () => {
  it("shows the validation summary straight after mounting", async () => {
    const path: PathDefinition = {
      id: "p",
      steps: [
        { id: "step-a", title: "Step A", fieldErrors: () => ({ name: "Required" }) },
        { id: "step-b", title: "Step B" }
      ]
    };

    @Component({
      standalone: true,
      imports: [PathShellComponent, PathStepDirective],
      template: `
        <pw-shell [path]="path" [validateWhen]="true" validationDisplay="summary">
          <ng-template pwStep="step-a"><div class="step-a">A</div></ng-template>
          <ng-template pwStep="step-b"><div class="step-b">B</div></ng-template>
        </pw-shell>
      `
    })
    class Host {
      path = path;
    }

    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await tick();
    await tick();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector(".step-a")).not.toBeNull();
    expect(el.querySelector(".pw-shell__validation")).not.toBeNull();
    expect(el.textContent).toContain("Required");
  });
});

// ---------------------------------------------------------------------------
// StepChoice content lookup — formId then stepId (review finding A5)
// ---------------------------------------------------------------------------

describe("PathShell (Angular) — StepChoice content lookup", () => {
  const choicePath: PathDefinition = {
    id: "choice",
    steps: [
      {
        id: "type",
        select: () => "type-b",
        steps: [{ id: "type-a" }, { id: "type-b" }]
      },
      { id: "done" }
    ]
  };

  async function mount(template: string): Promise<HTMLElement> {
    @Component({ standalone: true, imports: [PathShellComponent, PathStepDirective], template })
    class Host {
      path = choicePath;
    }
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await tick();
    await tick();
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it("falls back to the choice id when nothing is registered under the inner step id", async () => {
    const el = await mount(`
      <pw-shell [path]="path">
        <ng-template pwStep="type"><div class="by-choice">Choice content</div></ng-template>
        <ng-template pwStep="done"><div>Done</div></ng-template>
      </pw-shell>
    `);
    expect(el.querySelector(".by-choice")).not.toBeNull();
  });

  it("prefers the inner step id when both are registered", async () => {
    const el = await mount(`
      <pw-shell [path]="path">
        <ng-template pwStep="type"><div class="by-choice">Choice content</div></ng-template>
        <ng-template pwStep="type-b"><div class="by-inner">Inner B</div></ng-template>
        <ng-template pwStep="done"><div>Done</div></ng-template>
      </pw-shell>
    `);
    expect(el.querySelector(".by-inner")).not.toBeNull();
    expect(el.querySelector(".by-choice")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Custom header visibility (review finding A7)
// ---------------------------------------------------------------------------

describe("PathShell (Angular) — custom header visibility", () => {
  const multi: PathDefinition = { id: "m", steps: [{ id: "a" }, { id: "b" }, { id: "c" }] };
  const single: PathDefinition = { id: "s", steps: [{ id: "only" }] };

  async function mount(path: PathDefinition, shellAttrs: string): Promise<HTMLElement> {
    @Component({
      standalone: true,
      imports: [PathShellComponent, PathStepDirective, PathShellHeaderDirective],
      template: `
        <pw-shell [path]="path" ${shellAttrs}>
          <ng-template pwShellHeader let-s><div class="custom-header">Step {{ s.stepIndex + 1 }}</div></ng-template>
          <ng-template pwStep="a"><div>A</div></ng-template>
          <ng-template pwStep="b"><div>B</div></ng-template>
          <ng-template pwStep="c"><div>C</div></ng-template>
          <ng-template pwStep="only"><div>Only</div></ng-template>
        </pw-shell>
      `
    })
    class Host {
      path = path;
    }
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await tick();
    await tick();
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it("hides a custom header when hideProgress is set", async () => {
    const el = await mount(multi, `[hideProgress]="true"`);
    expect(el.querySelector(".custom-header")).toBeNull();
  });

  it("hides a custom header under layout=\"tabs\"", async () => {
    const el = await mount(multi, `layout="tabs"`);
    expect(el.querySelector(".custom-header")).toBeNull();
  });

  it("renders a custom header for a single-step path", async () => {
    const el = await mount(single, ``);
    expect(el.querySelector(".custom-header")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// restoreKey — remount restores without re-running hooks or losing state
// ---------------------------------------------------------------------------

describe("PathShell (Angular) — restoreKey remount fidelity", () => {
  it("a remounted inner shell resumes where it was: no hooks re-fire, attempted state survives", async () => {
    const calls = { enterA: 0, leaveA: 0, enterB: 0 };
    const inner: PathDefinition = {
      id: "inner",
      steps: [
        { id: "inner-a", onEnter: () => { calls.enterA++; }, onLeave: () => { calls.leaveA++; } },
        { id: "inner-b", onEnter: () => { calls.enterB++; }, fieldErrors: ({ data }) => (data.city ? {} : { city: "City required" }) }
      ]
    };
    const outer: PathDefinition = { id: "outer", steps: [{ id: "host" }, { id: "after" }] };

    @Component({
      standalone: true,
      imports: [PathShellComponent, PathStepDirective],
      template: `
        <pw-shell [path]="outer" nextLabel="OuterNext" backLabel="OuterBack">
          <ng-template pwStep="host">
            <pw-shell [path]="inner" restoreKey="inner" validationDisplay="summary" nextLabel="InnerNext" completeLabel="InnerComplete">
              <ng-template pwStep="inner-a"><div class="inner-a">Inner Content A</div></ng-template>
              <ng-template pwStep="inner-b"><div class="inner-b">Inner Content B</div></ng-template>
            </pw-shell>
          </ng-template>
          <ng-template pwStep="after"><div class="after">After</div></ng-template>
        </pw-shell>
      `
    })
    class Host {
      outer = outer;
      inner = inner;
    }

    const fixture = TestBed.createComponent(Host);
    // Nested shells start asynchronously one inside the other: give the inner
    // start a few turns and re-run change detection between them.
    const settle = async () => {
      for (let i = 0; i < 4; i++) { fixture.detectChanges(); await tick(); }
      fixture.detectChanges();
    };
    await settle();
    const el: HTMLElement = fixture.nativeElement;
    const click = async (label: string) => {
      const btn = Array.from(el.querySelectorAll("button")).find((b) => b.textContent?.trim() === label);
      expect(btn, `button "${label}"`).toBeDefined();
      (btn as HTMLButtonElement).click();
      await settle();
    };
    expect(calls.enterA).toBe(1);

    await click("InnerNext");
    expect(el.querySelector(".inner-b")).not.toBeNull();
    await click("InnerComplete");
    expect(el.textContent).toContain("City required");

    await click("OuterNext");
    expect(el.querySelector(".after")).not.toBeNull();
    expect(el.querySelector(".inner-b")).toBeNull();
    await click("OuterBack");

    expect(el.querySelector(".inner-b")).not.toBeNull();
    expect(el.textContent).toContain("City required");
    expect(calls).toEqual({ enterA: 1, leaveA: 1, enterB: 1 });
  });
});
