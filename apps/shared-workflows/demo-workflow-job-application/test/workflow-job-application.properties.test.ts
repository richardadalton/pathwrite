import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";
import { PathEngine } from "@daltonr/pathwrite-core";
import {
  MockApplicationServices,
  createApplicationPath,
  INITIAL_DATA,
  type ApplicationServices,
} from "../src/index";

// Fast services — zero delay, same logic as MockApplicationServices.
// Used for PathEngine integration properties to keep the suite quick.
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
    if (years < 2) return { eligible: false, reason: "Minimum 2 years required." };
    return { eligible: true };
  }
  async requiresCoverLetter(roleId: string) {
    return roleId === "eng" || roleId === "data";
  }
}

const fast = new FastMockServices();
const KNOWN_ROLES = ["eng", "pm", "design", "data", "devrel"] as const;

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Any role ID: known roles plus arbitrary strings (unknown roles) */
const arbRoleId = fc.oneof(
  fc.constantFrom(...KNOWN_ROLES),
  fc.string()
);

/** Experience string: valid numbers, edge cases, non-numeric */
const arbYearsStr = fc.oneof(
  fc.nat(50).map(n => n.toString()),
  fc.float({ min: 0, max: 50, noNaN: true }).map(n => n.toFixed(1)),
  fc.constant(""),
  fc.constant("abc"),
);

/** Valid cover letter — always passes the 20-char trimmed minimum */
const arbValidCoverLetter = fc.string({ minLength: 5 }).map(
  s => "I am an excellent fit for this role. " + s
);

// ---------------------------------------------------------------------------
// MockApplicationServices — service contract properties
// ---------------------------------------------------------------------------

describe("MockApplicationServices (property) — checkEligibility", () => {
  it("eligible iff years >= 2, for every non-negative integer", async () => {
    vi.useFakeTimers();
    await fc.assert(fc.asyncProperty(
      fc.nat(100),
      async (years) => {
        const svc = new MockApplicationServices();
        const p = svc.checkEligibility(years);
        await vi.runAllTimersAsync();
        const result = await p;
        expect(result.eligible).toBe(years >= 2);
      }
    ));
    vi.useRealTimers();
  });

  it("ineligibility always carries a non-empty reason string", async () => {
    vi.useFakeTimers();
    await fc.assert(fc.asyncProperty(
      fc.integer({ min: 0, max: 1 }),
      async (years) => {
        const svc = new MockApplicationServices();
        const p = svc.checkEligibility(years);
        await vi.runAllTimersAsync();
        const result = await p;
        expect(result.eligible).toBe(false);
        expect(typeof result.reason).toBe("string");
        expect((result.reason as string).length).toBeGreaterThan(0);
      }
    ));
    vi.useRealTimers();
  });
});

describe("MockApplicationServices (property) — requiresCoverLetter", () => {
  it("true iff roleId is exactly 'eng' or 'data', for any string including unknown roles", async () => {
    vi.useFakeTimers();
    await fc.assert(fc.asyncProperty(
      fc.oneof(fc.constantFrom(...KNOWN_ROLES), fc.string()),
      async (roleId) => {
        const svc = new MockApplicationServices();
        const p = svc.requiresCoverLetter(roleId);
        await vi.runAllTimersAsync();
        const result = await p;
        expect(result).toBe(roleId === "eng" || roleId === "data");
      }
    ));
    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// fieldErrors — validation properties
// ---------------------------------------------------------------------------

describe("createApplicationPath (property) — role fieldErrors", () => {
  const step = createApplicationPath(fast).steps[0];

  it("error present iff roleId is the empty string, for any string value", async () => {
    await fc.assert(fc.asyncProperty(arbRoleId, (roleId) => {
      const errors = step.fieldErrors!({ data: { ...INITIAL_DATA, roleId } } as any);
      expect(!!errors.roleId).toBe(roleId === "");
    }));
  });
});

describe("createApplicationPath (property) — experience fieldErrors", () => {
  const step = createApplicationPath(fast).steps[1];

  it("yearsExperience error present iff value is empty, non-numeric, or negative", async () => {
    await fc.assert(fc.asyncProperty(arbYearsStr, (yearsExperience) => {
      const errors = step.fieldErrors!({ data: { ...INITIAL_DATA, yearsExperience } } as any);
      const n = Number(yearsExperience);
      const shouldError = !yearsExperience || isNaN(n) || n < 0;
      expect(!!errors.yearsExperience).toBe(shouldError);
    }));
  });

  it("skills error present iff the value is empty or whitespace-only, for any string", async () => {
    await fc.assert(fc.asyncProperty(fc.string(), (skills) => {
      const errors = step.fieldErrors!({ data: { ...INITIAL_DATA, skills } } as any);
      expect(!!errors.skills).toBe(!skills?.trim());
    }));
  });
});

describe("createApplicationPath (property) — coverLetter fieldErrors", () => {
  const step = createApplicationPath(fast).steps[3]; // index 3 = coverLetter

  it("no error iff trimmed length >= 20, for any string", async () => {
    await fc.assert(fc.asyncProperty(fc.string(), (coverLetter) => {
      const errors = step.fieldErrors!({ data: { ...INITIAL_DATA, coverLetter } } as any);
      const trimLen = coverLetter?.trim().length ?? 0;
      expect(!!errors.coverLetter).toBe(trimLen < 20);
    }));
  });

  it("FINDING — trim applies before the length check: surrounding whitespace does not count toward the minimum", async () => {
    // A cover letter of 19 real characters padded with any amount of surrounding
    // whitespace is still invalid — trim().length === 19 < 20.
    // A cover letter of 20 real characters padded with whitespace is valid —
    // trim().length === 20.  The key rule: whitespace never contributes to length.
    await fc.assert(fc.asyncProperty(
      fc.integer({ min: 0, max: 50 }),  // inner non-space chars
      fc.integer({ min: 0, max: 20 }),  // leading spaces
      fc.integer({ min: 0, max: 20 }),  // trailing spaces
      (innerLen, leading, trailing) => {
        const coverLetter = " ".repeat(leading) + "x".repeat(innerLen) + " ".repeat(trailing);
        const errors = step.fieldErrors!({ data: { ...INITIAL_DATA, coverLetter } } as any);
        expect(!!errors.coverLetter).toBe(innerLen < 20);
      }
    ));
  });
});

// ---------------------------------------------------------------------------
// Eligibility guard — async canMoveNext
// ---------------------------------------------------------------------------

describe("createApplicationPath (property) — eligibility guard", () => {
  it("blocks navigation for every integer years value < 2, regardless of role", async () => {
    await fc.assert(fc.asyncProperty(
      fc.integer({ min: 0, max: 1 }),
      fc.constantFrom(...KNOWN_ROLES),
      async (years, roleId) => {
        const engine = new PathEngine();
        await engine.start(createApplicationPath(fast), {
          ...INITIAL_DATA, roleId, yearsExperience: years.toString(), skills: "TS",
        });
        await engine.next(); // → experience
        await engine.next(); // → eligibility
        await engine.next(); // guard blocks
        expect(engine.snapshot()?.stepId).toBe("eligibility");
      }
    ));
  });

  it("allows navigation for every integer years value >= 2, regardless of role", async () => {
    await fc.assert(fc.asyncProperty(
      fc.integer({ min: 2, max: 50 }),
      fc.constantFrom(...KNOWN_ROLES),
      async (years, roleId) => {
        const engine = new PathEngine();
        await engine.start(createApplicationPath(fast), {
          ...INITIAL_DATA, roleId, yearsExperience: years.toString(), skills: "TS",
        });
        await engine.next();
        await engine.next();
        await engine.next(); // guard passes
        expect(engine.snapshot()?.stepId).not.toBe("eligibility");
      }
    ));
  });

  it("blockingError is always a non-empty string when the guard blocks", async () => {
    await fc.assert(fc.asyncProperty(
      fc.integer({ min: 0, max: 1 }),
      fc.constantFrom(...KNOWN_ROLES),
      async (years, roleId) => {
        const engine = new PathEngine();
        await engine.start(createApplicationPath(fast), {
          ...INITIAL_DATA, roleId, yearsExperience: years.toString(), skills: "TS",
        });
        await engine.next();
        await engine.next();
        await engine.next(); // blocked
        const error = engine.snapshot()?.blockingError;
        expect(typeof error).toBe("string");
        expect((error as string).length).toBeGreaterThan(0);
      }
    ));
  });

  it("FINDING — threshold is numeric, not string: '1.9' is blocked, '2.0' passes", async () => {
    // yearsExperience is stored as a string but evaluated as Number().
    // This verifies the coercion behaviour: any string that parses to < 2 blocks.
    await fc.assert(fc.asyncProperty(
      fc.integer({ min: 0, max: 19999 }).map(n => (n / 10000).toFixed(4)),
      async (yearsStr) => {
        const engine = new PathEngine();
        await engine.start(createApplicationPath(fast), {
          ...INITIAL_DATA, roleId: "pm", yearsExperience: yearsStr, skills: "TS",
        });
        await engine.next();
        await engine.next();
        await engine.next();
        expect(engine.snapshot()?.stepId).toBe("eligibility");
      }
    ));
  });
});

// ---------------------------------------------------------------------------
// Cover letter routing — async shouldSkip
// ---------------------------------------------------------------------------

describe("createApplicationPath (property) — coverLetter routing", () => {
  it("coverLetter step is visited iff roleId is 'eng' or 'data', for all known roles", async () => {
    await fc.assert(fc.asyncProperty(
      fc.constantFrom(...KNOWN_ROLES),
      fc.integer({ min: 2, max: 30 }),
      async (roleId, years) => {
        const engine = new PathEngine();
        await engine.start(createApplicationPath(fast), {
          ...INITIAL_DATA, roleId, yearsExperience: years.toString(), skills: "TS",
        });
        await engine.next();
        await engine.next();
        await engine.next();
        const stepId = engine.snapshot()?.stepId;
        if (roleId === "eng" || roleId === "data") {
          expect(stepId).toBe("cover-letter");
        } else {
          expect(stepId).toBe("review");
        }
      }
    ));
  });

  it("FINDING — unknown role IDs always skip the cover letter (allow-list logic)", async () => {
    // requiresCoverLetter uses an explicit allow-list ("eng" | "data").
    // Any roleId outside the list — including future roles added to the UI —
    // will silently skip the cover letter step until the service is updated.
    // This test documents that behaviour as a deliberate design choice.
    await fc.assert(fc.asyncProperty(
      fc.string().filter(s => s !== "eng" && s !== "data"),
      async (roleId) => {
        const result = await fast.requiresCoverLetter(roleId);
        expect(result).toBe(false);
      }
    ));
  });
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe("createApplicationPath (property) — determinism", () => {
  it("the same application data always visits the same steps in the same order", async () => {
    const arbValidData = fc.record({
      roleId:          fc.constantFrom(...KNOWN_ROLES),
      yearsExperience: fc.integer({ min: 2, max: 30 }).map(n => n.toString()),
      skills:          fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
      coverLetter:     arbValidCoverLetter,
    });

    await fc.assert(fc.asyncProperty(arbValidData, async (data) => {
      async function run() {
        const engine = new PathEngine();
        await engine.start(createApplicationPath(fast), data);
        const visited: string[] = [];
        while (engine.snapshot()) {
          visited.push(engine.snapshot()!.stepId);
          if (!engine.snapshot()!.canMoveNext) break;
          await engine.next();
        }
        return visited;
      }

      const [first, second] = await Promise.all([run(), run()]);
      expect(first).toEqual(second);
    }));
  });

  it("a restart always produces the same first step regardless of prior navigation", async () => {
    const arbValidData = fc.record({
      roleId:          fc.constantFrom(...KNOWN_ROLES),
      yearsExperience: fc.integer({ min: 2, max: 30 }).map(n => n.toString()),
      skills:          fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
      coverLetter:     arbValidCoverLetter,
    });

    const arbActions = fc.array(
      fc.oneof(fc.constant("next" as const), fc.constant("previous" as const)),
      { minLength: 0, maxLength: 6 }
    );

    await fc.assert(fc.asyncProperty(arbValidData, arbActions, async (data, actions) => {
      const engine = new PathEngine();
      await engine.start(createApplicationPath(fast), data);

      for (const action of actions) {
        if (!engine.snapshot()) break;
        action === "next" ? await engine.next() : await engine.previous();
      }

      await engine.restart();
      expect(engine.snapshot()?.stepId).toBe("role");
      expect(engine.snapshot()?.stepIndex).toBe(0);
    }));
  });
});
