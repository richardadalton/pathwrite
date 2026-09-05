// @vitest-environment jsdom
import "zone.js";
import "zone.js/testing";
import "@angular/compiler";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Component, TemplateRef } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from "@angular/platform-browser-dynamic/testing";
import type { PathDefinition } from "@daltonr/pathwrite-core";
import { PathEngine } from "@daltonr/pathwrite-core";
import { PathShellComponent, PathStepDirective, PathShellHeaderDirective } from "../src/shell";

beforeAll(() => {
  // vitest compiles TypeScript with esbuild, which emits no decorator
  // metadata, so Angular's JIT compiler cannot see constructor parameter
  // types. The shell component uses inject() and needs nothing; the pwStep
  // directive takes TemplateRef through its constructor, so give JIT the
  // same ctorParameters hint the AOT compiler would have written.
  (PathStepDirective as any).ctorParameters = () => [{ type: TemplateRef }];
  (PathShellHeaderDirective as any).ctorParameters = () => [{ type: TemplateRef }];
  TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting(), {
    teardown: { destroyAfterEach: true },
  });
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
        { id: "step-b", title: "Step B" },
      ],
    };

    @Component({
      standalone: true,
      imports: [PathShellComponent, PathStepDirective],
      template: `
        <pw-shell [path]="path" [validateWhen]="true" validationDisplay="summary">
          <ng-template pwStep="step-a"><div class="step-a">A</div></ng-template>
          <ng-template pwStep="step-b"><div class="step-b">B</div></ng-template>
        </pw-shell>
      `,
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
        steps: [{ id: "type-a" }, { id: "type-b" }],
      },
      { id: "done" },
    ],
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
          <ng-template pwShellHeader let-s
            ><div class="custom-header">Step {{ s.stepIndex + 1 }}</div></ng-template
          >
          <ng-template pwStep="a"><div>A</div></ng-template>
          <ng-template pwStep="b"><div>B</div></ng-template>
          <ng-template pwStep="c"><div>C</div></ng-template>
          <ng-template pwStep="only"><div>Only</div></ng-template>
        </pw-shell>
      `,
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

  it('hides a custom header under layout="tabs"', async () => {
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
        {
          id: "inner-a",
          onEnter: () => {
            calls.enterA++;
          },
          onLeave: () => {
            calls.leaveA++;
          },
        },
        {
          id: "inner-b",
          onEnter: () => {
            calls.enterB++;
          },
          fieldErrors: ({ data }) => (data.city ? {} : { city: "City required" }),
        },
      ],
    };
    const outer: PathDefinition = { id: "outer", steps: [{ id: "host" }, { id: "after" }] };

    @Component({
      standalone: true,
      imports: [PathShellComponent, PathStepDirective],
      template: `
        <pw-shell [path]="outer" nextLabel="OuterNext" backLabel="OuterBack">
          <ng-template pwStep="host">
            <pw-shell
              [path]="inner"
              restoreKey="inner"
              validationDisplay="summary"
              nextLabel="InnerNext"
              completeLabel="InnerComplete"
            >
              <ng-template pwStep="inner-a"><div class="inner-a">Inner Content A</div></ng-template>
              <ng-template pwStep="inner-b"><div class="inner-b">Inner Content B</div></ng-template>
            </pw-shell>
          </ng-template>
          <ng-template pwStep="after"><div class="after">After</div></ng-template>
        </pw-shell>
      `,
    })
    class Host {
      outer = outer;
      inner = inner;
    }

    const fixture = TestBed.createComponent(Host);
    // Nested shells start asynchronously one inside the other: give the inner
    // start a few turns and re-run change detection between them.
    const settle = async () => {
      for (let i = 0; i < 4; i++) {
        fixture.detectChanges();
        await tick();
      }
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

// ---------------------------------------------------------------------------
// A late engine input is adopted (Angular already did this via ngOnChanges — pinned by a test)
// ---------------------------------------------------------------------------

describe("PathShell (Angular) — late engine input", () => {
  it("shows the empty state until the engine arrives, then renders and drives that engine", async () => {
    const started = new PathEngine();
    await started.start({ id: "late", steps: [{ id: "a" }, { id: "b" }] }, { name: "restored" });

    @Component({
      standalone: true,
      imports: [PathShellComponent, PathStepDirective],
      template: `
        <pw-shell [path]="path" [autoStart]="false" [engine]="engine">
          <ng-template pwStep="a"><div class="a">Content A</div></ng-template>
          <ng-template pwStep="b"><div class="b">Content B</div></ng-template>
        </pw-shell>
      `,
    })
    class Host {
      path: PathDefinition = { id: "late", steps: [{ id: "a" }, { id: "b" }] };
      engine?: PathEngine;
    }
    const fixture = TestBed.createComponent(Host);
    const settle = async () => {
      for (let i = 0; i < 4; i++) {
        fixture.detectChanges();
        await tick();
      }
      fixture.detectChanges();
    };
    await settle();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector(".a")).toBeNull();

    fixture.componentInstance.engine = started;
    await settle();
    expect(el.querySelector(".a")).not.toBeNull();

    (el.querySelector(".pw-shell__btn--next") as HTMLButtonElement).click();
    await settle();
    expect(started.snapshot()?.stepId).toBe("b");
    expect(el.querySelector(".b")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Empty state after cancel; completion panel inside the body (review: Angular drift)
// ---------------------------------------------------------------------------

describe("PathShell (Angular) — empty state and completion markup", () => {
  async function mountTwoSteps() {
    @Component({
      standalone: true,
      imports: [PathShellComponent, PathStepDirective],
      template: `
        <pw-shell [path]="path">
          <ng-template pwStep="a"><div class="a">A</div></ng-template>
          <ng-template pwStep="b"><div class="b">B</div></ng-template>
        </pw-shell>
      `,
    })
    class Host {
      path: PathDefinition = { id: "m", steps: [{ id: "a" }, { id: "b" }] };
    }
    const fixture = TestBed.createComponent(Host);
    const settle = async () => {
      for (let i = 0; i < 4; i++) {
        fixture.detectChanges();
        await tick();
      }
      fixture.detectChanges();
    };
    await settle();
    return { el: fixture.nativeElement as HTMLElement, settle };
  }

  it('shows "No active path." after the path is cancelled, like the other shells', async () => {
    const { el, settle } = await mountTwoSteps();
    expect(el.querySelector(".a")).not.toBeNull();
    (el.querySelector(".pw-shell__btn--cancel") as HTMLButtonElement).click();
    await settle();
    expect(el.querySelector(".a")).toBeNull();
    expect(el.textContent).toContain("No active path.");
  });

  it("wraps the completion panel in .pw-shell__body", async () => {
    const { el, settle } = await mountTwoSteps();
    (el.querySelector(".pw-shell__btn--next") as HTMLButtonElement).click();
    await settle();
    (el.querySelector(".pw-shell__btn--next") as HTMLButtonElement).click();
    await settle();
    expect(el.querySelector(".pw-shell__body .pw-shell__completion")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Validation / warning rows — memoised entries, DOM rows tracked by field key
// ---------------------------------------------------------------------------

describe("PathShell (Angular) — validation and warning row stability", () => {
  const path: PathDefinition = {
    id: "stable",
    steps: [
      {
        id: "form",
        fieldErrors: ({ data }) => {
          const errors: Record<string, string> = {};
          if (!data.name) errors.name = "Name required";
          if (!data.email) errors.email = "Email required";
          if (data.email === "bad") errors.email = "Email invalid";
          return errors;
        },
        fieldWarnings: ({ data }) => {
          const warnings: Record<string, string> = {};
          if (!data.nickname) warnings.nickname = "Nickname recommended";
          if (data.nickname === "long") warnings.nickname = "Nickname is long";
          return warnings;
        },
      },
      { id: "done" },
    ],
  };

  async function mount() {
    @Component({
      standalone: true,
      imports: [PathShellComponent, PathStepDirective],
      template: `
        <pw-shell [path]="path" [validateWhen]="true" validationDisplay="summary">
          <ng-template pwStep="form"><div class="form">Form</div></ng-template>
          <ng-template pwStep="done"><div class="done">Done</div></ng-template>
        </pw-shell>
      `,
    })
    class Host {
      path = path;
    }
    const fixture = TestBed.createComponent(Host);
    const settle = async () => {
      for (let i = 0; i < 4; i++) {
        fixture.detectChanges();
        await tick();
      }
      fixture.detectChanges();
    };
    await settle();
    const shell = fixture.debugElement.query(By.directive(PathShellComponent))
      .componentInstance as PathShellComponent;
    return { fixture, settle, shell: shell as any, el: fixture.nativeElement as HTMLElement };
  }

  it("fieldEntries returns the same array for the same snapshot and a new one after the errors change", async () => {
    const { shell } = await mount();
    const s1 = shell.facade.snapshot();
    const first = shell.fieldEntries(s1);
    expect(first).toEqual([
      ["name", "Name required"],
      ["email", "Email required"],
    ]);
    expect(shell.fieldEntries(s1)).toBe(first);

    await shell.facade.setData("email", "bad");
    const s2 = shell.facade.snapshot();
    const second = shell.fieldEntries(s2);
    expect(second).not.toBe(first);
    expect(second).toEqual([
      ["name", "Name required"],
      ["email", "Email invalid"],
    ]);
    expect(shell.fieldEntries(s2)).toBe(second);
  });

  it("warningEntries returns the same array for the same snapshot and a new one after the warnings change", async () => {
    const { shell } = await mount();
    const s1 = shell.facade.snapshot();
    const first = shell.warningEntries(s1);
    expect(first).toEqual([["nickname", "Nickname recommended"]]);
    expect(shell.warningEntries(s1)).toBe(first);

    await shell.facade.setData("nickname", "long");
    const s2 = shell.facade.snapshot();
    const second = shell.warningEntries(s2);
    expect(second).not.toBe(first);
    expect(second).toEqual([["nickname", "Nickname is long"]]);
    expect(shell.warningEntries(s2)).toBe(second);
  });

  it("keeps the error row DOM nodes across a change-detection pass that changes nothing", async () => {
    const { fixture, el } = await mount();
    const rows = () => Array.from(el.querySelectorAll(".pw-shell__validation-item"));
    const before = rows();
    expect(before).toHaveLength(2);

    fixture.detectChanges();
    fixture.detectChanges();
    const after = rows();
    expect(after).toHaveLength(2);
    expect(after[0]).toBe(before[0]);
    expect(after[1]).toBe(before[1]);
  });

  it("updates the error rows when an error changes, keeping the untouched row's node", async () => {
    const { shell, settle, el } = await mount();
    const rows = () => Array.from(el.querySelectorAll(".pw-shell__validation-item"));
    const before = rows();
    expect(before.map((r) => r.textContent?.trim())).toEqual(["NameName required", "EmailEmail required"]);

    await shell.facade.setData("email", "bad");
    await settle();
    const after = rows();
    expect(after.map((r) => r.textContent?.trim())).toEqual(["NameName required", "EmailEmail invalid"]);
    // Tracked by field key: the "name" row is the same node, "email" was updated in place.
    expect(after[0]).toBe(before[0]);
    expect(after[1]).toBe(before[1]);

    await shell.facade.setData("name", "Ada");
    await settle();
    const afterRemoval = rows();
    expect(afterRemoval.map((r) => r.textContent?.trim())).toEqual(["EmailEmail invalid"]);
    expect(afterRemoval[0]).toBe(before[1]);
  });

  it("keeps the warning row DOM nodes across a change-detection pass that changes nothing", async () => {
    const { fixture, el } = await mount();
    const rows = () => Array.from(el.querySelectorAll(".pw-shell__warnings-item"));
    const before = rows();
    expect(before).toHaveLength(1);

    fixture.detectChanges();
    const after = rows();
    expect(after).toHaveLength(1);
    expect(after[0]).toBe(before[0]);
  });
});
