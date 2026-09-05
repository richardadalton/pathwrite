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
