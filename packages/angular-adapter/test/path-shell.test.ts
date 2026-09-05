// @vitest-environment jsdom
import "zone.js";
import "zone.js/testing";
import "@angular/compiler";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Component, TemplateRef } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from "@angular/platform-browser-dynamic/testing";
import type { PathDefinition } from "@daltonr/pathwrite-core";
import { PathShellComponent, PathStepDirective } from "../src/shell";

beforeAll(() => {
  // vitest compiles TypeScript with esbuild, which emits no decorator
  // metadata, so Angular's JIT compiler cannot see constructor parameter
  // types. The shell component uses inject() and needs nothing; the pwStep
  // directive takes TemplateRef through its constructor, so give JIT the
  // same ctorParameters hint the AOT compiler would have written.
  (PathStepDirective as any).ctorParameters = () => [{ type: TemplateRef }];
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
