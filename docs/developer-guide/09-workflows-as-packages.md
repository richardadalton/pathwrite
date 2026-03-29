# Chapter 9: Workflows as Packages

Most developers think of a wizard as a UI component. Pathwrite inverts that assumption: the wizard is a business process described in TypeScript, and the UI is a rendering detail. Once you separate the two, the process becomes a first-class software artifact — something you can publish, version, test, and share like any other package. This chapter shows what that looks like in practice.

---

## The insight

Consider what a multi-step form actually is. It has a data shape, a set of sequential decisions, rules about what qualifies as valid input, and conditions under which certain steps can be skipped or blocked. None of that is inherently visual. The visual part — the progress bar, the input fields, the Next button — is a layer on top.

In a framework-coupled wizard, the business rules live inside components. They are expressed as component state, conditional JSX, and event handlers. You cannot run those rules without mounting the component. You cannot share them with a mobile app. You cannot version them independently of the UI.

`PathDefinition<TData>` is a plain TypeScript object. It has no JSX, no imports from React or Angular or Vue, and no DOM assumptions. You can write it in one place, package it, and hand it to any adapter. The adapter renders it; the definition describes what happens.

That separation is not just architectural tidiness — it changes what you can do:

- A React web app and a React Native mobile app can share the same workflow definition, including every guard and skip condition.
- The workflow can be versioned with semver independently of any UI that renders it.
- Breaking changes in the workflow — a renamed step, a removed field, a changed service interface — are caught at the consuming app's TypeScript compilation step, not at runtime.
- The entire workflow can be tested with no browser, no mounted component, and no DOM.

---

## What belongs in a workflow package

A workflow package is deliberately narrow. It contains exactly four things:

1. **The data shape** — an interface that extends `PathData` and describes every field collected across all steps.
2. **The service interface** — an interface that describes every external call the workflow needs to make.
3. **The path factory** — a function that takes a service implementation and returns a `PathDefinition`.
4. **The barrel export** — an `index.ts` that re-exports the public surface.

That is all. No React components. No Angular decorators. No HTTP clients. No references to `fetch` or `axios`. The package depends on `@daltonr/pathwrite-core` and nothing else.

---

## Package structure

A workflow package looks like this on disk:

```
packages/onboarding-workflow/
├── package.json
├── tsconfig.json
└── src/
│   ├── index.ts
│   ├── services.ts
│   └── onboarding-path.ts
└── test/
    ├── onboarding.test.ts
    └── onboarding.properties.test.ts
```

Tests live alongside the source. They run against the source directly via path aliases — the same pattern the engine's own test suite uses — so you do not need to build before running tests.

### `package.json`

```json
{
  "name": "@myorg/onboarding-workflow",
  "version": "1.0.0",
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
  "peerDependencies": {
    "@daltonr/pathwrite-core": ">=0.10.0"
  }
}
```

`@daltonr/pathwrite-core` is a peer dependency, not a direct dependency. Each consuming app already has it installed; the workflow package simply declares a compatible version range. This prevents the consuming app from accidentally bundling two copies of the engine.

### `tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "declarationMap": true
  },
  "include": ["src"]
}
```

`declarationMap: true` generates source maps for `.d.ts` files, so editors can jump to definition in the original `.ts` source rather than the compiled output.

---

## The three source files

### `services.ts` — the service interface

The service interface declares what the workflow depends on without specifying how those dependencies are fulfilled. Guards and skip conditions call methods on this interface; they never call `fetch` directly.

```ts
// src/services.ts

export interface OnboardingServices {
  checkUsernameAvailable(username: string): Promise<boolean>;
  fetchPlanOptions(): Promise<Plan[]>;
  requiresBillingDetails(planId: string): Promise<boolean>;
}

export interface Plan {
  id: string;
  label: string;
  price: number;
}
```

Alongside the interface, ship a mock implementation that simulates the real behaviour — including any meaningful business rules — but without real network calls. This mock is what tests use, and it is what the demos use.

```ts
export class MockOnboardingServices implements OnboardingServices {
  private takenUsernames = new Set(["admin", "root", "support"]);

  async checkUsernameAvailable(username: string): Promise<boolean> {
    return !this.takenUsernames.has(username.toLowerCase());
  }

  async fetchPlanOptions(): Promise<Plan[]> {
    return [
      { id: "free",  label: "Free",       price: 0 },
      { id: "pro",   label: "Pro",        price: 12 },
      { id: "team",  label: "Team",       price: 49 },
    ];
  }

  async requiresBillingDetails(planId: string): Promise<boolean> {
    return planId !== "free";
  }
}

export const services = new MockOnboardingServices();
```

The `services` singleton is a convenience export for non-DI frameworks. Angular apps should ignore it and use an `@Injectable` subclass instead (see the Angular note below).

### `onboarding-path.ts` — the data shape and factory

```ts
// src/onboarding-path.ts

import type { PathDefinition } from "@daltonr/pathwrite-core";
import type { OnboardingServices } from "./services";

export interface OnboardingData {
  username:       string;
  planId:         string;
  cardNumber:     string;
  cardExpiry:     string;
  [key: string]: unknown; // required by PathData
}

export const INITIAL_DATA: OnboardingData = {
  username:   "",
  planId:     "",
  cardNumber: "",
  cardExpiry: "",
};

export function createOnboardingPath(
  svc: OnboardingServices
): PathDefinition<OnboardingData> {
  return {
    id: "onboarding",
    steps: [
      {
        id: "username",
        title: "Choose a Username",
        fieldErrors: ({ data }) => ({
          username: !data.username.trim()
            ? "Username is required."
            : data.username.length < 3
            ? "Username must be at least 3 characters."
            : undefined,
        }),
        canMoveNext: async ({ data }) => {
          const available = await svc.checkUsernameAvailable(data.username);
          if (!available) return { allowed: false, reason: "That username is already taken." };
          return true;
        },
      },
      {
        id: "plan",
        title: "Choose a Plan",
        fieldErrors: ({ data }) => ({
          planId: !data.planId ? "Please select a plan." : undefined,
        }),
      },
      {
        id: "billing",
        title: "Billing Details",
        shouldSkip: async ({ data }) => {
          const required = await svc.requiresBillingDetails(data.planId);
          return !required;
        },
        fieldErrors: ({ data }) => ({
          cardNumber: !data.cardNumber.trim() ? "Card number is required." : undefined,
          cardExpiry: !data.cardExpiry.trim() ? "Expiry date is required." : undefined,
        }),
      },
      {
        id: "confirm",
        title: "Confirm",
      },
    ],
  };
}
```

**Why a factory and not a constant?**

The guards close over `svc`. If the path were a plain constant, those closures would capture a specific service instance at module load time — and you would have no way to swap in a mock for tests. The factory makes the dependency explicit: callers decide what `svc` is, and the path definition simply uses it.

### `index.ts` — the barrel

```ts
// src/index.ts

export type { OnboardingServices, Plan } from "./services";
export { MockOnboardingServices, services } from "./services";
export type { OnboardingData } from "./onboarding-path";
export { INITIAL_DATA, createOnboardingPath } from "./onboarding-path";
```

Keep this file thin. It is the package's public API; everything that is not exported here is an implementation detail.

---

## The service interface as a contract

The service interface is the seam between the workflow and the outside world. The workflow package owns the interface definition; every implementation — real, mock, or test-only — must satisfy it.

This separation has three useful consequences.

**Tests inject fast mocks.** The `MockOnboardingServices` in the package simulates realistic delays for demo purposes. Test code defines a `FastMockServices` that implements the same interface without any `setTimeout`. Tests run in milliseconds rather than seconds.

**Apps inject real implementations.** A production web app creates a class that calls your actual API:

```ts
class ApiOnboardingServices implements OnboardingServices {
  async checkUsernameAvailable(username: string) {
    const res = await fetch(`/api/users/check?username=${username}`);
    const { available } = await res.json();
    return available;
  }
  // ...
}
```

The workflow definition does not care. It calls `svc.checkUsernameAvailable(username)` and handles whatever comes back.

**React Native shares the interface.** If the mobile app caches responses in AsyncStorage, that is an implementation detail of its service class. The workflow definition remains unchanged.

---

## Consuming from framework adapters

Once a framework app adds the package as a dependency, consumption follows the same pattern everywhere.

**React:**

```tsx
import { createOnboardingPath, services, INITIAL_DATA, type OnboardingData } from "@myorg/onboarding-workflow";
import { PathShell } from "@daltonr/pathwrite-react";

const path = createOnboardingPath(services);

export function OnboardingFlow() {
  return (
    <PathShell path={path} initialData={INITIAL_DATA}>
      {/* step components */}
    </PathShell>
  );
}
```

**Vue:**

```ts
import { createOnboardingPath, services, INITIAL_DATA } from "@myorg/onboarding-workflow";

const path = createOnboardingPath(services);
// pass path and INITIAL_DATA to PathShell
```

**Svelte:**

```ts
import { createOnboardingPath, services, INITIAL_DATA } from "@myorg/onboarding-workflow";

const path = createOnboardingPath(services);
// pass to <PathShell {path} initialData={INITIAL_DATA}>
```

The pattern is identical across all three. The framework adapter handles rendering; the workflow package handles everything else.

> **Angular note.** Angular's dependency injection system cannot inject a plain class — the class must carry the `@Injectable` decorator. Create a thin local wrapper in your Angular app's `services.ts`:
>
> ```ts
> import { Injectable } from "@angular/core";
> import { MockOnboardingServices as Base } from "@myorg/onboarding-workflow";
>
> export type { OnboardingServices } from "@myorg/onboarding-workflow";
>
> @Injectable({ providedIn: "root" })
> export class MockOnboardingServices extends Base {}
> ```
>
> Your step components inject `MockOnboardingServices` from this local file. Your `AppComponent` receives the same instance and passes it to `createOnboardingPath()`. The workflow definition in the package remains untouched.

---

## Versioning and breaking changes

The workflow package is the single source of truth for the business process. Versioning it according to semver is straightforward once you know what constitutes each kind of change.

**Patch** — behaviour-preserving corrections:
- Fixing a validation error message ("Required" → "This field is required.")
- Adjusting a guard threshold (minimum 2 years → minimum 1 year)
- Correcting a bug in a `shouldSkip` condition

**Minor** — additive changes that do not break existing consumers:
- Adding a new optional step
- Adding a new optional field to the data interface (with a default value in `INITIAL_DATA`)
- Adding a new optional method to the service interface

**Major** — breaking changes that require consuming apps to update:
- Removing or renaming a step
- Removing or renaming a field in the data interface
- Adding a required method to the service interface
- Changing the signature of an existing service method

When a consuming app updates to a new major version, TypeScript catches every mismatch at compile time. If you renamed a step from `"cover-letter"` to `"coverLetter"`, every component that renders that step by ID will emit a type error. If you added a required method to the service interface, every service implementation will fail to compile until it implements the new method. The compiler is the upgrade guide.

> **Step ID naming.** Use camelCase step IDs. The Svelte adapter maps step IDs to component prop names, which must be valid JavaScript identifiers. Hyphens are forbidden. `"coverLetter"` works everywhere; `"cover-letter"` breaks Svelte.

---

## Testing in isolation

Because the workflow package has no framework dependencies, your tests import `PathEngine`, your path factory, and nothing else. For testing you want a `FastMockServices` — an implementation of the service interface that resolves immediately, with no `setTimeout`, so tests run in milliseconds:

```ts
// test/onboarding.test.ts

import { describe, it, expect } from "vitest";
import { PathEngine } from "@daltonr/pathwrite-core";
import { createOnboardingPath, INITIAL_DATA, type OnboardingServices } from "../src/index";

class FastMockServices implements OnboardingServices {
  private takenUsernames = new Set(["admin"]);

  async checkUsernameAvailable(username: string) {
    return !this.takenUsernames.has(username);
  }
  async fetchPlanOptions() {
    return [
      { id: "free", label: "Free", price: 0 },
      { id: "pro",  label: "Pro",  price: 12 },
    ];
  }
  async requiresBillingDetails(planId: string) {
    return planId !== "free";
  }
}

const fast = new FastMockServices();

it("free plan users skip billing", async () => {
  const engine = new PathEngine();
  await engine.start(createOnboardingPath(fast), {
    ...INITIAL_DATA,
    username: "alice",
    planId: "free",
  });

  await engine.next(); // username → plan
  await engine.next(); // plan → skips billing → confirm
  expect(engine.snapshot()?.stepId).toBe("confirm");
});

it("paid plan users see billing", async () => {
  const engine = new PathEngine();
  await engine.start(createOnboardingPath(fast), {
    ...INITIAL_DATA,
    username: "bob",
    planId: "pro",
  });

  await engine.next(); // username → plan
  await engine.next(); // plan → billing
  expect(engine.snapshot()?.stepId).toBe("billing");
});
```

Chapter 10 covers the full testing approach — `fieldErrors`, guards, sub-paths, and property-based tests.

---

You can now build, package, and share workflows. Chapter 10 shows you how to test them thoroughly.

© 2026 Devjoy Ltd. MIT License.
