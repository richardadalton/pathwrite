# Shared Workflows

A Pathwrite workflow is a `PathDefinition` — a plain TypeScript object that
describes what steps exist, what data is collected at each step, and what rules
govern navigation between them. It has no UI and no framework imports.

Because the definition is just data, it can be extracted into its own package and
shared across every framework adapter. This guide explains what goes into a shared
workflow, how to package it, and how to test it in complete isolation from any UI.

---

## What is a workflow?

The engine and the renderer are deliberately separate. `PathEngine` is the state
machine; an adapter (`PathShell` in React, Vue, Svelte, Angular, or React Native)
is the renderer. The `PathDefinition` sits in between — it is the contract.

```
┌─────────────────────────────────────────────────┐
│  shared workflow package                        │
│  ┌─────────────┐   ┌──────────────────────────┐ │
│  │ service     │   │ createApplicationPath()  │ │
│  │ interface   │──▶│ PathDefinition<TData>    │ │
│  └─────────────┘   └──────────────────────────┘ │
└─────────────────────────────────────────────────┘
          │                        │
          ▼                        ▼
  mock / real               PathEngine
  implementation          (state machine)
                                   │
                         ┌─────────┴──────────┐
                         ▼                    ▼
                    React / Vue         Angular / Svelte
                    PathShell           PathShell / pw-shell
```

The workflow package lives entirely in the top row. It never imports from an
adapter. Every adapter imports from it.

---

## Anatomy of a workflow package

A complete workflow package has three source files.

### 1. The data shape (`application-path.ts`)

The `ApplicationData` interface is the typed record that accumulates as the user
moves through the wizard. Every step reads from and writes to this shape.

```ts
export interface ApplicationData {
  roleId:          string;
  yearsExperience: string;
  skills:          string;
  coverLetter:     string;
  [key: string]: unknown;  // required by PathData constraint
}

export const INITIAL_DATA: ApplicationData = {
  roleId:          "",
  yearsExperience: "",
  skills:          "",
  coverLetter:     "",
};
```

`INITIAL_DATA` provides the starting state. Adapters pass it as `initialData` to
`PathShell` or `engine.start()`.

### 2. The service interface (`services.ts`)

Any step that needs to call an external system — an API, a database, a feature-flag
service — does so through a service interface. The interface lives in the workflow
package; the implementation lives outside it.

```ts
export interface ApplicationServices {
  getRoles(): Promise<Role[]>;
  checkEligibility(yearsExperience: number): Promise<EligibilityResult>;
  requiresCoverLetter(roleId: string): Promise<boolean>;
}
```

The interface is the only thing the workflow definition depends on. That dependency
is injected when the path is created (see the factory below), not at module load time.

A mock implementation ships alongside the interface for demos and tests:

```ts
export class MockApplicationServices implements ApplicationServices {
  async checkEligibility(yearsExperience: number): Promise<EligibilityResult> {
    await delay(900);
    if (yearsExperience < 2) {
      return { eligible: false, reason: "A minimum of 2 years is required." };
    }
    return { eligible: true };
  }
  // ...
}

// Convenience singleton for non-DI frameworks
export const services = new MockApplicationServices();
```

### 3. The path factory (`application-path.ts`)

The factory is the workflow itself. It returns a `PathDefinition<TData>` — the
structure the engine reads.

```ts
export function createApplicationPath(
  svc: ApplicationServices
): PathDefinition<ApplicationData> {
  return {
    id: "job-application",
    steps: [
      {
        id: "role",
        title: "Choose a Role",
        fieldErrors: ({ data }) => ({
          roleId: !data.roleId ? "Please select a role to continue." : undefined,
        }),
      },
      {
        id: "experience",
        title: "Your Experience",
        fieldErrors: ({ data }) => {
          const years = Number(data.yearsExperience);
          return {
            yearsExperience: !data.yearsExperience ? "Required."
              : isNaN(years) || years < 0 ? "Enter a valid number of years."
              : undefined,
            skills: !data.skills?.trim() ? "Required." : undefined,
          };
        },
      },
      {
        id: "eligibility",
        title: "Eligibility Check",
        // Async guard — engine awaits this before advancing.
        // Returns { allowed: false, reason } to block and surface an error.
        canMoveNext: async ({ data }) => {
          const result = await svc.checkEligibility(Number(data.yearsExperience));
          if (!result.eligible) return { allowed: false, reason: result.reason };
          return true;
        },
      },
      {
        // NOTE: camelCase IDs are required — see "Step ID naming" below.
        id: "coverLetter",
        title: "Cover Letter",
        // Async shouldSkip — evaluated lazily; step count is optimistic until resolved.
        shouldSkip: async ({ data }) => {
          const needed = await svc.requiresCoverLetter(data.roleId);
          return !needed;
        },
        fieldErrors: ({ data }) => ({
          coverLetter: !data.coverLetter?.trim() ? "Please write a cover letter."
            : data.coverLetter.trim().length < 20 ? "Must be at least 20 characters."
            : undefined,
        }),
      },
      { id: "review", title: "Review & Submit" },
    ],
  };
}
```

**Why a factory and not a constant?**

Guards and `shouldSkip` need to call the service. If the path were a constant,
those calls would be hardwired to a specific service instance at module load time.
The factory pattern makes the dependency explicit and injectable — the test suite
can pass a fast mock; production code passes a real API client.

**Step ID naming**

Use camelCase step IDs. The Svelte adapter maps step IDs to component prop names;
prop names must be valid JavaScript identifiers, so hyphens are forbidden. camelCase
works in all adapters.

```ts
// ✗ Breaks Svelte
{ id: "cover-letter", ... }

// ✓ Works everywhere
{ id: "coverLetter", ... }
```

### 4. The barrel (`index.ts`)

A single re-export surface keeps consumer imports clean.

```ts
export type { Role, EligibilityResult, ApplicationServices } from "./services";
export { MockApplicationServices, services } from "./services";
export type { ApplicationData } from "./application-path";
export { INITIAL_DATA, createApplicationPath } from "./application-path";
```

---

## Packaging

### Directory structure

```
apps/shared-workflows/demo-workflow-job-application/
├── package.json
├── tsconfig.json
└── src/
│   ├── index.ts
│   ├── services.ts
│   └── application-path.ts
└── test/
    ├── workflow-job-application.test.ts
    └── workflow-job-application.properties.test.ts
```

Tests live inside the package. They run against the source (via vitest path
aliases), not against the dist.

### `package.json`

```json
{
  "name": "@daltonr/pathwrite-demo-workflow-job-application",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "@daltonr/pathwrite-core": "*"
  }
}
```

### `tsconfig.json`

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "declarationMap": true
  },
  "include": ["src"]
}
```

### Building

```bash
npx tsc -p apps/shared-workflows/demo-workflow-job-application/tsconfig.json
```

The shared package must be built before framework demos can import it, because
Vite and Angular's compiler do not process TypeScript from `node_modules`. After
building, run `npm install` from the repo root to ensure workspace symlinks are
in place.

### Consuming from framework adapters (React, Vue, Angular, Svelte)

Add the package as a dependency in the demo's `package.json`:

```json
"dependencies": {
  "@daltonr/pathwrite-demo-workflow-job-application": "*"
}
```

Then import directly:

```ts
// React / Vue / Svelte / Angular step components
import {
  services,
  createApplicationPath,
  INITIAL_DATA,
  type ApplicationData,
  type ApplicationServices,
} from "@daltonr/pathwrite-demo-workflow-job-application";
```

**Angular note:** Angular DI cannot inject a plain class. Wrap the shared mock
with `@Injectable` in the Angular app's local `services.ts`:

```ts
import { Injectable } from "@angular/core";
import { MockApplicationServices as Base } from "@daltonr/pathwrite-demo-workflow-job-application";
export type { ApplicationServices, Role } from "@daltonr/pathwrite-demo-workflow-job-application";

@Injectable({ providedIn: "root" })
export class MockApplicationServices extends Base {}
```

Step components then inject the local subclass; the path factory receives the same
instance via `app.component.ts`.

### Consuming from React Native

React Native's Metro bundler excludes the root `node_modules` (to avoid stale
dependency conflicts) and does not follow workspace symlinks automatically. Add
the package to `metro.config.js` explicitly:

```js
config.resolver.extraNodeModules = {
  "@daltonr/pathwrite-core":    path.resolve(workspaceRoot, "packages/core"),
  "@daltonr/pathwrite-react-native": path.resolve(workspaceRoot, "packages/react-native-adapter"),
  // Add every new shared workflow package here:
  "@daltonr/pathwrite-demo-workflow-job-application":
    path.resolve(workspaceRoot, "apps/shared-workflows/demo-workflow-job-application"),
};
```

Metro will resolve the package via `"main": "dist/index.js"` in `package.json`, so
the package must be built before the Metro bundler starts.

---

## Testing a workflow in isolation

The workflow has no UI and no framework dependencies. It can be tested with a plain
`PathEngine` instance and a mock service — no React testing library, no Angular
`TestBed`, no Svelte component harness.

Tests are in `test/workflow-job-application.test.ts`. Run them with:

```bash
npx vitest run apps/shared-workflows/demo-workflow-job-application/test/workflow-job-application.test.ts
```

### The fast mock pattern

`MockApplicationServices` introduces network-simulating delays (600–900 ms). For
unit and integration tests, define a `FastMockServices` class in the test file:

```ts
class FastMockServices implements ApplicationServices {
  async getRoles() {
    return [
      { id: "eng", label: "Software Engineer" },
      // ...
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
```

`FastMockServices` mirrors the real logic exactly — it is not a stub that always
returns happy-path values. Its purpose is to remove the `await delay(...)` calls
so tests run in milliseconds.

### Testing `fieldErrors` directly

`fieldErrors` is a plain synchronous function on the step definition. There is no
need to spin up a `PathEngine` to test it — call it directly:

```ts
describe("createApplicationPath — fieldErrors", () => {
  const path = createApplicationPath(fast);
  const roleStep       = path.steps[0];
  const experienceStep = path.steps[1];
  const coverLetterStep = path.steps[3]; // 0=role,1=experience,2=eligibility,3=coverLetter

  // Minimal helper: fieldErrors only needs `data` from the context object
  function errs(step: typeof roleStep, partial: Partial<ApplicationData>) {
    return step.fieldErrors!({ data: { ...INITIAL_DATA, ...partial } } as any);
  }

  it("requires roleId", () => {
    expect(errs(roleStep, { roleId: "" }).roleId).toBeTruthy();
  });

  it("clears the error once a role is selected", () => {
    expect(errs(roleStep, { roleId: "eng" }).roleId).toBeUndefined();
  });

  it("rejects a cover letter shorter than 20 characters", () => {
    expect(errs(coverLetterStep, { coverLetter: "Too short." }).coverLetter).toBeTruthy();
  });
});
```

The `as any` cast on the context is intentional — `fieldErrors` only destructures
`data`; the other context fields (`stepId`, `path`) are unused and can be omitted.

### Testing async guards via `PathEngine`

`canMoveNext` runs during navigation, not during snapshot reads. Test it by calling
`engine.next()` and observing whether `stepId` advanced:

```ts
it("eligibility guard blocks when years < 2", async () => {
  const engine = new PathEngine();
  await engine.start(createApplicationPath(fast), {
    ...INITIAL_DATA,
    roleId: "eng",
    yearsExperience: "1",
    skills: "TS",
  });
  await engine.next(); // role → experience
  await engine.next(); // experience → eligibility
  await engine.next(); // guard fires — blocks
  expect(engine.snapshot()?.stepId).toBe("eligibility");
  expect(engine.snapshot()?.blockingError).toBeTruthy();
});
```

When the guard returns `{ allowed: false, reason }`, the engine stays on the
current step and sets `snapshot.blockingError` to the reason string.

To test the retry path, update data and call `next()` again:

```ts
engine.setData("yearsExperience", "5");
await engine.next(); // guard now passes
expect(engine.snapshot()?.blockingError).toBeNull();
expect(engine.snapshot()?.stepId).toBe("coverLetter");
```

### Testing async `shouldSkip` via `PathEngine`

`shouldSkip` is evaluated when the engine enters a step. The simplest way to test
it is to drive navigation past the step and check where you land:

```ts
async function advanceToAfterEligibility(roleId: string) {
  const engine = new PathEngine();
  await engine.start(createApplicationPath(fast), {
    ...INITIAL_DATA, roleId, yearsExperience: "3", skills: "TS",
  });
  await engine.next(); // role → experience
  await engine.next(); // experience → eligibility
  await engine.next(); // eligibility → coverLetter *or* review
  return engine;
}

it("skips coverLetter for pm role", async () => {
  const engine = await advanceToAfterEligibility("pm");
  expect(engine.snapshot()?.stepId).toBe("review");
});

it("includes coverLetter for eng role", async () => {
  const engine = await advanceToAfterEligibility("eng");
  expect(engine.snapshot()?.stepId).toBe("coverLetter");
});
```

### Testing full completion

Listen for the `"completed"` event via `engine.subscribe()`:

```ts
it("completes an eng application", async () => {
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
  await engine.next(); // review → done

  expect(completedData).not.toBeNull();
  expect(completedData!.roleId).toBe("eng");
});
```

After completion `engine.snapshot()` returns `null`.

### Testing the real service's delay behaviour

To test `MockApplicationServices` without waiting 900 ms per assertion, use
Vitest's fake timers. Call `vi.useFakeTimers()` before the test, start the async
call, advance all timers with `await vi.runAllTimersAsync()`, then await the result:

```ts
it("checkEligibility blocks when years < 2", async () => {
  vi.useFakeTimers();
  const svc = new MockApplicationServices();

  const promise = svc.checkEligibility(1);
  await vi.runAllTimersAsync(); // fires the setTimeout inside MockApplicationServices
  const result = await promise;

  expect(result.eligible).toBe(false);
  expect(result.reason).toBeTruthy();
  vi.useRealTimers();
});
```

Always call `vi.useRealTimers()` at the end, or use `afterEach`. Leaving fake
timers active between tests causes confusing failures in unrelated tests.

---

## Property-based testing

Property tests complement unit tests by running the same assertion across hundreds
of automatically generated inputs. Instead of `checkEligibility(1)` and
`checkEligibility(2)`, a property test asks: "for every non-negative integer,
is `eligible` exactly equal to `years >= 2`?" If that holds for 100 random inputs
it is very likely to be a true invariant.

This codebase uses [fast-check](https://fast-check.dev). Property tests live in
`test/workflow-job-application.properties.test.ts`.

### Setting up fast-check

`fast-check` is already a root devDependency. Import it alongside Vitest's helpers:

```ts
import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";
import { PathEngine } from "@daltonr/pathwrite-core";
import { createApplicationPath, INITIAL_DATA, type ApplicationServices } from "../src/index";
```

The vitest config must include the test directory:

```ts
// vitest.config.mts
test: {
  include: [
    "packages/**/test/**/*.test.ts",
    "apps/shared-workflows/**/test/**/*.test.ts",
  ]
}
```

And map the package to its source for test resolution:

```ts
resolve: {
  alias: {
    "@daltonr/pathwrite-demo-workflow-job-application":
      fileURLToPath(new URL("apps/shared-workflows/demo-workflow-job-application/src/index.ts", import.meta.url)),
  }
}
```

### Defining arbitraries for your domain

An **arbitrary** is a generator that produces random values of a given type. Define
your domain arbitraries at the top of the test file so they can be reused:

```ts
const KNOWN_ROLES = ["eng", "pm", "design", "data", "devrel"] as const;

// Known roles plus arbitrary strings — exercises both recognised and unknown inputs
const arbRoleId = fc.oneof(
  fc.constantFrom(...KNOWN_ROLES),
  fc.string()
);

// Experience input as it arrives from a form field: strings, edge cases
const arbYearsStr = fc.oneof(
  fc.nat(50).map(n => n.toString()),           // integers "0" to "50"
  fc.float({ min: 0, max: 50, noNaN: true }).map(n => n.toFixed(1)), // decimals
  fc.constant(""),                              // empty — the most common mistake
  fc.constant("abc"),                           // non-numeric
);

// A cover letter guaranteed to pass the 20-char minimum
const arbValidCoverLetter = fc.string({ minLength: 5 }).map(
  s => "I am an excellent fit for this role. " + s
);
```

**Rules of thumb for domain arbitraries:**
- Include known-good values (`fc.constantFrom(...)`) alongside random strings.
- Include boundary cases explicitly: the empty string, zero, negative numbers.
- Use `.map()` to transform generic generators into domain-meaningful values
  (e.g. integers mapped to numeric strings).
- Name arbitraries after the domain concept, not the type (`arbRoleId` not `arbString`).

### Service contract properties

The simplest properties check that a service method respects its contract for all
valid inputs. Use `fc.asyncProperty` with `vi.useFakeTimers()` to keep these fast:

```ts
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
});
```

`fc.nat(100)` generates integers from 0 to 100. Each run gets a different value;
fast-check runs 100 iterations by default. If the predicate fails, fast-check
shrinks the input to the smallest failing example.

### Validation rule properties

`fieldErrors` is a pure function — no async, no side effects. Test it as a
property with a sync predicate inside `fc.asyncProperty`:

```ts
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
});
```

The predicate encodes the rule as executable specification: the error is present
if and only if the value fails the three rejection conditions. If someone later
changes the validation logic in a way that no longer matches this rule, the property
test will catch it.

### Routing properties

Navigation decisions (`shouldSkip`, guard results) are the most important workflow
logic to cover with properties. Use `PathEngine` to drive navigation and observe
which step is reached:

```ts
describe("createApplicationPath (property) — coverLetter routing", () => {
  it("coverLetter visited iff roleId is 'eng' or 'data', for all known roles", async () => {
    await fc.assert(fc.asyncProperty(
      fc.constantFrom(...KNOWN_ROLES),
      fc.integer({ min: 2, max: 30 }),
      async (roleId, years) => {
        const engine = new PathEngine();
        await engine.start(createApplicationPath(fast), {
          ...INITIAL_DATA, roleId, yearsExperience: years.toString(), skills: "TS",
        });
        await engine.next(); // role → experience
        await engine.next(); // experience → eligibility
        await engine.next(); // eligibility → coverLetter or review
        const stepId = engine.snapshot()?.stepId;
        if (roleId === "eng" || roleId === "data") {
          expect(stepId).toBe("coverLetter");
        } else {
          expect(stepId).toBe("review");
        }
      }
    ));
  });
});
```

### Determinism properties

A workflow should be deterministic: the same inputs always produce the same step
sequence. Test this by running the same engine twice and comparing the visited
step IDs:

```ts
it("the same inputs always visit the same steps in the same order", async () => {
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
```

### The FINDING pattern

Some property tests document a behaviour that is surprising, non-obvious, or worth
calling out explicitly in code review. Prefix the test description with `FINDING —`
to make this intent visible in the test report:

```ts
it("FINDING — trim applies before the length check: surrounding whitespace does not count", async () => {
  await fc.assert(fc.asyncProperty(
    fc.integer({ min: 0, max: 50 }),   // inner non-space chars
    fc.integer({ min: 0, max: 20 }),   // leading spaces
    fc.integer({ min: 0, max: 20 }),   // trailing spaces
    (innerLen, leading, trailing) => {
      const coverLetter = " ".repeat(leading) + "x".repeat(innerLen) + " ".repeat(trailing);
      const errors = step.fieldErrors!({ data: { ...INITIAL_DATA, coverLetter } } as any);
      expect(!!errors.coverLetter).toBe(innerLen < 20);
    }
  ));
});

it("FINDING — unknown role IDs always skip the cover letter (allow-list logic)", async () => {
  // Any roleId outside "eng" | "data" silently skips the cover letter —
  // including future roles added to the UI before the service is updated.
  await fc.assert(fc.asyncProperty(
    fc.string().filter(s => s !== "eng" && s !== "data"),
    async (roleId) => {
      const result = await fast.requiresCoverLetter(roleId);
      expect(result).toBe(false);
    }
  ));
});
```

FINDING tests serve as living documentation of design decisions and implicit
constraints. They are especially useful when a rule is correct but a future
developer might reasonably question it.

### Pitfalls

**`fc.float` requires 32-bit float boundaries**

`fc.float({ min: 0, max: 1.9999 })` will throw because `1.9999` is not exactly
representable as a 32-bit float. Use integer arithmetic instead:

```ts
// ✗ throws at runtime
fc.float({ min: 0, max: 1.9999, noNaN: true })

// ✓ generates "0.0000" to "1.9999" as strings
fc.integer({ min: 0, max: 19999 }).map(n => (n / 10000).toFixed(4))
```

**`fc.string()` can generate whitespace-only strings**

If a test navigates through a step that validates fields, a whitespace-only skills
value will fail `fieldErrors` and block navigation before reaching the step under
test. This is valid behaviour, not a bug — but it means the test fails for the
wrong reason. Filter it out:

```ts
// Generates strings with at least one non-whitespace character
fc.string({ minLength: 1 }).filter(s => s.trim().length > 0)
```

**Leaving fake timers active between tests**

`vi.useFakeTimers()` without a matching `vi.useRealTimers()` at the end will
affect all subsequent tests in the file. Wrap timer-dependent properties tightly:

```ts
it("...", async () => {
  vi.useFakeTimers();
  await fc.assert(fc.asyncProperty(...));
  vi.useRealTimers(); // always restore
});
```

**Slow PathEngine tests from too many runs**

Each `fc.asyncProperty` iteration starts a fresh `PathEngine` and runs several
`next()` calls. With the default 100 runs and 5 navigations per run, a single
property executes 500 async operations. For `FastMockServices` this is negligible.
If a test unexpectedly becomes slow, check whether a real service with delays has
crept in.
