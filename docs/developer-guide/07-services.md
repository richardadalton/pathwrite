# Chapter 7: Services

Guards and hooks make your path smart. But smart behaviour usually means calling an API: checking eligibility before the user advances, loading a list of approvers to populate a dropdown, submitting a form when the path completes. The naive approach — putting a `fetch()` call directly inside a guard — works for a prototype, but it creates three problems simultaneously: the PathDefinition now imports from your API layer, testing requires intercepting real HTTP, and the same definition cannot be reused across environments with different transports. The service interface pattern eliminates all three problems by separating *what* your path needs from *how* those needs are satisfied.

---

## The problem with inline fetch calls

Consider an eligibility guard written without services:

```typescript
canMoveNext: async ({ data }) => {
  const res = await fetch(`/api/eligibility/${data.applicantId}`);
  const result = await res.json();
  if (!result.eligible) return { allowed: false, reason: result.reason };
  return true;
}
```

This works. But now your `PathDefinition` has a hard dependency on the network. To test it you need to mock `globalThis.fetch`. To run it in a React Native context you need to swap the transport layer. To reuse it in a different product with a different API, you need to edit the definition itself. The guard has become entangled with its environment.

---

## Define an interface, not an implementation

The fix is to state *what you need* as a TypeScript interface and leave the *how* to the caller.

```typescript
// hiring-services.ts

export interface HiringServices {
  checkEligibility(applicantId: string): Promise<{ eligible: boolean; reason?: string }>;
  getRoles(): Promise<Array<{ id: string; title: string }>>;
  submitApplication(data: HiringData): Promise<{ applicationId: string }>;
}
```

The `PathDefinition` never references `fetch`, `axios`, or any specific backend. It depends only on this interface. The concrete implementation that calls your real API is a separate file. The test uses a stub that returns predetermined values. The same path definition works in all three contexts because it only holds a reference to the interface — not to any specific implementation of it.

---

## The factory pattern in full

The mechanism that gives a path definition access to its services is a factory function. Instead of exporting a `PathDefinition` object directly, you export a function that accepts services and returns a definition. The definition closes over the services instance.

```typescript
// hiring-path.ts

import type { PathDefinition } from "@daltonr/pathwrite-react";
import type { HiringServices } from "./hiring-services";

export interface HiringData {
  applicantId: string;
  roleId: string;
  startDate: string;
}

export function createHiringPath(svc: HiringServices): PathDefinition<HiringData> {
  return {
    id: "hiring",
    steps: [
      {
        id: "applicant",
        fieldErrors: ({ data }) => ({
          applicantId: !data.applicantId ? "Required." : undefined,
        }),
        canMoveNext: async ({ data }) => {
          const result = await svc.checkEligibility(data.applicantId);
          if (!result.eligible) {
            return { allowed: false, reason: result.reason ?? "Applicant is not eligible." };
          }
          return true;
        },
      },
      {
        id: "role",
        fieldErrors: ({ data }) => ({
          roleId: !data.roleId ? "Select a role." : undefined,
          startDate: !data.startDate ? "Choose a start date." : undefined,
        }),
      },
      {
        id: "review",
      },
    ],
    onComplete: async (data) => {
      await svc.submitApplication(data);
    },
  };
}
```

There are three things to notice here. First, the guard on the `applicant` step calls `svc.checkEligibility` — a method declared in the interface, not a direct `fetch` call. Second, `onComplete` calls `svc.submitApplication`, so the final submission is also delegated to the service layer. Third, neither the guard nor the hook knows whether `svc` is backed by a real REST API, a GraphQL client, or a test stub. The factory function receives whatever is injected at the call site.

---

## Passing services to the shell

Once you have a path factory and a services implementation, wiring them into your React app takes three lines:

```tsx
// HiringWizard.tsx

import { PathShell } from "@daltonr/pathwrite-react";
import { createHiringPath } from "./hiring-path";
import { liveHiringServices } from "./live-hiring-services";

const svc = liveHiringServices();
const hiringPath = createHiringPath(svc);

export function HiringWizard() {
  return (
    <PathShell
      path={hiringPath}
      services={svc}
      initialData={{ applicantId: "", roleId: "", startDate: "" }}
      onComplete={(data) => console.log("Done:", data)}
      steps={{
        applicant: <ApplicantStep />,
        role: <RoleStep />,
        review: <ReviewStep />,
      }}
    />
  );
}
```

`PathShell` accepts a `services` prop typed as `unknown`. It does not inspect the value — it simply passes it through context to all step components. The same services object that was passed to `createHiringPath` is passed here, so both the engine's guards and the UI components work against the same instance.

Step components access services through `usePathContext`, providing both data and services type parameters:

```tsx
// RoleStep.tsx

import { usePathContext } from "@daltonr/pathwrite-react";
import { useEffect, useState } from "react";
import type { HiringData } from "./hiring-path";
import type { HiringServices } from "./hiring-services";

export function RoleStep() {
  const { snapshot, setData, services } = usePathContext<HiringData, HiringServices>();
  const [roles, setRoles] = useState<Array<{ id: string; title: string }>>([]);

  useEffect(() => {
    services.getRoles().then(setRoles);
  }, [services]);

  return (
    <div>
      <label htmlFor="role">Role</label>
      <select
        id="role"
        value={snapshot.data.roleId}
        onChange={(e) => setData("roleId", e.target.value)}
      >
        <option value="">Select…</option>
        {roles.map((r) => (
          <option key={r.id} value={r.id}>{r.title}</option>
        ))}
      </select>
    </div>
  );
}
```

Both generics on `usePathContext<HiringData, HiringServices>()` are type-level assertions. TypeScript uses them to narrow `snapshot.data` to `HiringData` and `services` to `HiringServices`. There is no runtime check — it is your responsibility to pass the matching types.

> **Angular:** Angular has its own dependency injection system, and it is idiomatic to use it directly rather than threading services through a `services` prop. Step components call `inject(HiringService)` to receive their dependencies from the Angular injector. The `services` prop on `<pw-shell>` is not used in Angular applications — the injector is the services layer.

---

## The @daltonr/pathwrite-services package

Guards run on every navigation attempt. If `checkEligibility` makes a network round-trip every time the user taps Next, a three-step wizard with one eligibility guard produces three identical API calls. For reference data that doesn't change during a session — role lists, country codes, approver names — that is pure waste.

`@daltonr/pathwrite-services` wraps your service functions to add caching, in-flight deduplication, and automatic retry. It has no dependency on the rest of Pathwrite; it is a standalone utility that works with plain async functions.

```typescript
import { defineServices } from "@daltonr/pathwrite-services";
import * as api from "./api";

export const hiringServices = defineServices(
  {
    checkEligibility: { fn: api.checkEligibility, cache: "auto", retry: 2 },
    getRoles:         { fn: api.getRoles,         cache: "auto" },
    submitApplication:{ fn: api.submitApplication, cache: "none" },
  },
  {
    storage: localStorage,       // optional — persist cache across page reloads
    keyPrefix: "hiring:svc:",
  }
);
```

`defineServices` accepts a config map where each entry declares the underlying function and two options:

**`cache`** controls whether the result is stored after the first successful call.

- `"auto"` — the result is cached after the first call. Subsequent calls with the same serialised arguments are served from memory without hitting the network. Two concurrent calls for the same arguments are deduplicated into a single in-flight request; the second caller waits on the same promise. This is the right choice for any read-only reference data that is stable for the session.
- `"none"` — the function is always called through. No caching, no deduplication. Use this for write operations like `submitApplication`, where side effects must not be swallowed or replayed.

**`retry`** sets the number of additional attempts on failure. Retries use exponential back-off starting at 200 ms. When all attempts are exhausted, `defineServices` throws a `ServiceUnavailableError`. If that error propagates out of a guard, the engine catches it and moves to the `"error"` status, surfacing a retry UI to the user.

```typescript
import { ServiceUnavailableError } from "@daltonr/pathwrite-services";

// If checkEligibility fails after 3 attempts (the initial call + 2 retries),
// a ServiceUnavailableError is thrown. The engine catches it automatically
// and sets snapshot.status = "error", presenting the user with a "Try again" button.
```

You do not need to catch `ServiceUnavailableError` inside your guards. The engine's error recovery mechanism handles it. The user sees the shell's built-in error panel — "Something went wrong. Try again" — and clicking the button re-runs the guard from the top.

### Prefetching

If your application knows which reference data will be needed before the user reaches the relevant step, you can warm the cache proactively:

```typescript
// Warm all zero-argument cached methods (getRoles, in this case)
await hiringServices.prefetch();

// Or specify exactly what to warm
await hiringServices.prefetch({
  getRoles: undefined,               // zero-arg — call once
  getOfficeLocations: [["EU"], ["US"]], // call once per argument set
});
```

Prefetch errors are silently swallowed. A failed prefetch never rejects the caller; the method will simply make a live call when the component first renders.

### When to use defineServices vs plain service objects

`defineServices` is worth adding when one or more of the following is true: a method is called from multiple guards or components and makes a network request; the method is slow enough that a duplicate call would be perceptible; or you need built-in retry without writing retry logic in every guard. For local or trivially fast functions, a plain object implementing the interface is fine.

---

## Testing with services

The payoff of the interface pattern arrives at test time. Pass a mock object that satisfies `HiringServices`, assert on guard behaviour, and never touch the network.

```typescript
// hiring-path.test.ts

import { describe, it, expect, vi } from "vitest";
import { PathEngine } from "@daltonr/pathwrite-core";
import { createHiringPath } from "./hiring-path";
import type { HiringServices } from "./hiring-services";

function makeMockServices(overrides?: Partial<HiringServices>): HiringServices {
  return {
    checkEligibility: vi.fn().mockResolvedValue({ eligible: true }),
    getRoles: vi.fn().mockResolvedValue([{ id: "eng-1", title: "Engineer" }]),
    submitApplication: vi.fn().mockResolvedValue({ applicationId: "app-42" }),
    ...overrides,
  };
}

describe("hiring path — eligibility guard", () => {
  it("blocks navigation when the applicant is ineligible", async () => {
    const svc = makeMockServices({
      checkEligibility: vi.fn().mockResolvedValue({
        eligible: false,
        reason: "Probation period has not ended.",
      }),
    });

    const engine = new PathEngine();
    await engine.start(createHiringPath(svc), { applicantId: "emp-7", roleId: "", startDate: "" });

    await engine.setData("applicantId", "emp-7");
    await engine.next(); // guard fires here

    const snapshot = engine.snapshot()!;
    expect(snapshot.stepId).toBe("applicant"); // still on the first step
    expect(snapshot.blockingError).toBe("Probation period has not ended.");
    expect(svc.checkEligibility).toHaveBeenCalledWith("emp-7");
  });

  it("advances when the applicant is eligible", async () => {
    const svc = makeMockServices(); // default: eligible: true

    const engine = new PathEngine();
    await engine.start(createHiringPath(svc), { applicantId: "emp-3", roleId: "", startDate: "" });

    await engine.setData("applicantId", "emp-3");
    await engine.next();

    expect(engine.snapshot()!.stepId).toBe("role");
  });
});
```

No `vi.spyOn(globalThis, "fetch")`. No `msw` server. No network. The guard is tested as a pure function of whatever the service returns, which is exactly the contract you care about.

---

Services handle live data during a path. Persistence handles what happens between sessions — saving progress so users can pick up where they left off.
