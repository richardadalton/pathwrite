import { describe, it, expect, vi } from "vitest";
import { PathEngine } from "@daltonr/pathwrite-core";
import {
  MockApplicationServices,
  services,
  createApplicationPath,
  INITIAL_DATA,
  type ApplicationData,
  type ApplicationServices,
} from "../src/index";

// ---------------------------------------------------------------------------
// Fast mock — same logic as MockApplicationServices, no network delays.
// Used for workflow integration tests so the suite stays quick.
// ---------------------------------------------------------------------------

class FastMockServices implements ApplicationServices {
  async getRoles() {
    return [
      { id: "eng",    label: "Software Engineer" },
      { id: "pm",     label: "Product Manager" },
      { id: "design", label: "Designer" },
      { id: "data",   label: "Data Scientist" },
      { id: "devrel", label: "Developer Advocate" },
    ];
  }
  async checkEligibility(years: number) {
    if (years < 2) {
      return { eligible: false, reason: "A minimum of 2 years of relevant experience is required." };
    }
    return { eligible: true };
  }
  async requiresCoverLetter(roleId: string) {
    return roleId === "eng" || roleId === "data";
  }
}

const fast = new FastMockServices();

// ---------------------------------------------------------------------------
// MockApplicationServices — service contract and delay behaviour
// ---------------------------------------------------------------------------

describe("MockApplicationServices", () => {
  it("exports a singleton", () => {
    expect(services).toBeInstanceOf(MockApplicationServices);
  });

  it("getRoles returns all 5 roles", async () => {
    vi.useFakeTimers();
    const svc = new MockApplicationServices();
    const p = svc.getRoles();
    await vi.runAllTimersAsync();
    const roles = await p;
    expect(roles).toHaveLength(5);
    expect(roles.map(r => r.id)).toEqual(["eng", "pm", "design", "data", "devrel"]);
    vi.useRealTimers();
  });

  it("checkEligibility blocks when years < 2", async () => {
    vi.useFakeTimers();
    const svc = new MockApplicationServices();
    const p = svc.checkEligibility(1);
    await vi.runAllTimersAsync();
    const result = await p;
    expect(result.eligible).toBe(false);
    expect(result.reason).toBeTruthy();
    vi.useRealTimers();
  });

  it("checkEligibility allows when years >= 2", async () => {
    vi.useFakeTimers();
    const svc = new MockApplicationServices();
    const p = svc.checkEligibility(2);
    await vi.runAllTimersAsync();
    const result = await p;
    expect(result.eligible).toBe(true);
    vi.useRealTimers();
  });

  it("requiresCoverLetter is true for eng and data", async () => {
    vi.useFakeTimers();
    const svc = new MockApplicationServices();
    const [eng, data] = await Promise.all([
      (async () => { const p = svc.requiresCoverLetter("eng"); await vi.runAllTimersAsync(); return p; })(),
      (async () => { const p = svc.requiresCoverLetter("data"); await vi.runAllTimersAsync(); return p; })(),
    ]);
    vi.useRealTimers();
    expect(eng).toBe(true);
    expect(data).toBe(true);
  });

  it("requiresCoverLetter is false for all other roles", async () => {
    vi.useFakeTimers();
    const svc = new MockApplicationServices();
    const results = await Promise.all(
      ["pm", "design", "devrel"].map(async id => {
        const p = svc.requiresCoverLetter(id);
        await vi.runAllTimersAsync();
        return p;
      })
    );
    vi.useRealTimers();
    expect(results).toEqual([false, false, false]);
  });
});

// ---------------------------------------------------------------------------
// Field validation — called directly from the step definitions
// ---------------------------------------------------------------------------

describe("createApplicationPath — fieldErrors", () => {
  const path = createApplicationPath(fast);
  const roleStep       = path.steps[0];
  const experienceStep = path.steps[1];
  const coverLetterStep = path.steps[3]; // index 3 = coverLetter (after role, experience, eligibility)

  // Call fieldErrors with minimal context (path/stepId are not used by these fns)
  function errs(step: typeof roleStep, partial: Partial<ApplicationData>) {
    return step.fieldErrors!({ data: { ...INITIAL_DATA, ...partial } } as any);
  }

  describe("role step", () => {
    it("requires roleId", () => {
      expect(errs(roleStep, { roleId: "" }).roleId).toBeTruthy();
    });
    it("clears the error once a role is selected", () => {
      expect(errs(roleStep, { roleId: "eng" }).roleId).toBeUndefined();
    });
  });

  describe("experience step", () => {
    it("requires yearsExperience", () => {
      expect(errs(experienceStep, { yearsExperience: "" }).yearsExperience).toBeTruthy();
    });
    it("rejects negative years", () => {
      expect(errs(experienceStep, { yearsExperience: "-1" }).yearsExperience).toBeTruthy();
    });
    it("rejects non-numeric input", () => {
      expect(errs(experienceStep, { yearsExperience: "abc" }).yearsExperience).toBeTruthy();
    });
    it("requires skills", () => {
      expect(errs(experienceStep, { yearsExperience: "3", skills: "" }).skills).toBeTruthy();
    });
    it("clears both errors with valid input", () => {
      const e = errs(experienceStep, { yearsExperience: "3", skills: "TypeScript" });
      expect(e.yearsExperience).toBeUndefined();
      expect(e.skills).toBeUndefined();
    });
  });

  describe("coverLetter step", () => {
    it("requires a cover letter", () => {
      expect(errs(coverLetterStep, { coverLetter: "" }).coverLetter).toBeTruthy();
    });
    it("rejects a letter shorter than 20 characters", () => {
      expect(errs(coverLetterStep, { coverLetter: "Too short." }).coverLetter).toBeTruthy();
    });
    it("accepts a letter with exactly 20 characters", () => {
      expect(errs(coverLetterStep, { coverLetter: "A".repeat(20) }).coverLetter).toBeUndefined();
    });
    it("accepts a letter longer than 20 characters", () => {
      expect(errs(coverLetterStep, { coverLetter: "I am a great fit for this role." }).coverLetter).toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// Async canMoveNext — eligibility guard
// ---------------------------------------------------------------------------

describe("createApplicationPath — eligibility guard", () => {
  it("blocks navigation and sets blockingError when years < 2", async () => {
    const engine = new PathEngine();
    await engine.start(createApplicationPath(fast), {
      ...INITIAL_DATA,
      roleId: "eng",
      yearsExperience: "1",
      skills: "TS",
    });
    await engine.next(); // role → experience
    await engine.next(); // experience → eligibility
    await engine.next(); // attempt to leave eligibility — guard blocks
    expect(engine.snapshot()?.stepId).toBe("eligibility");
    expect(engine.snapshot()?.blockingError).toBeTruthy();
  });

  it("allows navigation when years >= 2", async () => {
    const engine = new PathEngine();
    await engine.start(createApplicationPath(fast), {
      ...INITIAL_DATA,
      roleId: "eng",
      yearsExperience: "3",
      skills: "TS",
    });
    await engine.next(); // role → experience
    await engine.next(); // experience → eligibility
    await engine.next(); // eligibility → coverLetter (eng requires it)
    expect(engine.snapshot()?.stepId).toBe("cover-letter");
  });

  it("clears blockingError after the guard passes on retry", async () => {
    const engine = new PathEngine();
    await engine.start(createApplicationPath(fast), {
      ...INITIAL_DATA,
      roleId: "eng",
      yearsExperience: "1",
      skills: "TS",
    });
    await engine.next();
    await engine.next();
    await engine.next(); // blocked — blockingError set
    expect(engine.snapshot()?.blockingError).toBeTruthy();

    engine.setData("yearsExperience", "5");
    await engine.next(); // guard now passes — blockingError cleared
    expect(engine.snapshot()?.blockingError).toBeNull();
    expect(engine.snapshot()?.stepId).toBe("cover-letter");
  });
});

// ---------------------------------------------------------------------------
// Async shouldSkip — cover letter step
// ---------------------------------------------------------------------------

describe("createApplicationPath — coverLetter shouldSkip", () => {
  async function advanceToAfterEligibility(roleId: string) {
    const engine = new PathEngine();
    await engine.start(createApplicationPath(fast), {
      ...INITIAL_DATA,
      roleId,
      yearsExperience: "3",
      skills: "TS",
    });
    await engine.next(); // role → experience
    await engine.next(); // experience → eligibility
    await engine.next(); // eligibility → coverLetter or review
    return engine;
  }

  it("includes coverLetter for 'eng' role", async () => {
    const engine = await advanceToAfterEligibility("eng");
    expect(engine.snapshot()?.stepId).toBe("cover-letter");
  });

  it("includes coverLetter for 'data' role", async () => {
    const engine = await advanceToAfterEligibility("data");
    expect(engine.snapshot()?.stepId).toBe("cover-letter");
  });

  it("skips coverLetter for 'pm' role", async () => {
    const engine = await advanceToAfterEligibility("pm");
    expect(engine.snapshot()?.stepId).toBe("review");
  });

  it("skips coverLetter for 'design' role", async () => {
    const engine = await advanceToAfterEligibility("design");
    expect(engine.snapshot()?.stepId).toBe("review");
  });

  it("skips coverLetter for 'devrel' role", async () => {
    const engine = await advanceToAfterEligibility("devrel");
    expect(engine.snapshot()?.stepId).toBe("review");
  });
});

// ---------------------------------------------------------------------------
// Full workflow completion
// ---------------------------------------------------------------------------

describe("createApplicationPath — full completion", () => {
  it("completes an eng application (cover letter required)", async () => {
    const engine = new PathEngine();
    let completedData: ApplicationData | null = null;
    engine.subscribe(e => {
      if (e.type === "completed") completedData = e.data as ApplicationData;
    });

    await engine.start(createApplicationPath(fast), {
      roleId: "eng",
      yearsExperience: "5",
      skills: "TypeScript, React",
      coverLetter: "I am an excellent engineer with deep TypeScript experience.",
    });

    await engine.next(); // role → experience
    await engine.next(); // experience → eligibility
    await engine.next(); // eligibility → coverLetter
    await engine.next(); // coverLetter → review
    await engine.next(); // review → complete

    expect(completedData).not.toBeNull();
    expect(completedData!.roleId).toBe("eng");
  });

  it("completes a pm application (cover letter skipped)", async () => {
    const engine = new PathEngine();
    let completedData: ApplicationData | null = null;
    engine.subscribe(e => {
      if (e.type === "completed") completedData = e.data as ApplicationData;
    });

    await engine.start(createApplicationPath(fast), {
      roleId: "pm",
      yearsExperience: "4",
      skills: "Product strategy",
      coverLetter: "",
    });

    await engine.next(); // role → experience
    await engine.next(); // experience → eligibility
    await engine.next(); // eligibility → review (coverLetter skipped)
    await engine.next(); // review → complete

    expect(completedData).not.toBeNull();
    expect(completedData!.roleId).toBe("pm");
  });

  it("snapshot is completed after completion", async () => {
    const engine = new PathEngine();
    await engine.start(createApplicationPath(fast), {
      roleId: "pm",
      yearsExperience: "4",
      skills: "Product strategy",
      coverLetter: "",
    });
    await engine.next();
    await engine.next();
    await engine.next();
    await engine.next();
    expect(engine.snapshot()?.status).toBe("completed");
  });
});
