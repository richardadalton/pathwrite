# @daltonr/pathwrite-services

Caching, deduplication, and retry for async service methods called from Pathwrite guards.

## Installation

```bash
npm install @daltonr/pathwrite-services
```

No peer dependencies. Zero hard dependencies on the rest of the Pathwrite ecosystem.

---

## The problem

Guards like `canMoveNext` run on every navigation attempt. Without caching, the same API call fires repeatedly as the user moves through a path — once per navigation event, even when the data cannot have changed. `defineServices` wraps your service methods so that each unique call is made at most once, concurrent calls for the same arguments are deduplicated into a single in-flight request, and transient failures are retried automatically before surfacing an error.

---

## Quick start

```ts
// services.ts
import { defineServices } from "@daltonr/pathwrite-services";
import { api } from "./api";

export const appServices = defineServices({
  getRoles:   { fn: api.getRoles,   cache: "auto" },
  getProfile: { fn: api.getProfile, cache: "auto", retry: 2 },
  submitForm: { fn: api.submitForm, cache: "none" },
});
```

```ts
// signup-path.ts
import type { PathDefinition } from "@daltonr/pathwrite-core";
import type { appServices } from "./services";

interface SignupData {
  roleId: string;
  name: string;
}

type Services = typeof appServices;

export function createSignupPath(svc: Services): PathDefinition<SignupData> {
  return {
    id: "signup",
    steps: [
      {
        id: "role",
        title: "Choose a role",
        canMoveNext: async ({ data }) => {
          const roles = await svc.getRoles();
          return roles.some((r) => r.id === data.roleId);
        },
      },
      {
        id: "details",
        title: "Your details",
        canMoveNext: ({ data }) => data.name.trim().length >= 2,
      },
    ],
  };
}
```

```tsx
// SignupFlow.tsx (React example — pattern is the same for all adapters)
import { PathShell } from "@daltonr/pathwrite-react";
import { appServices } from "./services";
import { createSignupPath } from "./signup-path";

const signupPath = createSignupPath(appServices);

export function SignupFlow() {
  return (
    <PathShell
      path={signupPath}
      initialData={{ roleId: "", name: "" }}
      onComplete={(data) => console.log("Done!", data)}
      steps={{
        role:    <RoleStep />,
        details: <DetailsStep />,
      }}
    />
  );
}
```

`getRoles()` is fetched once. Every subsequent call — from guards, from `canMoveNext`, from step lifecycle hooks — returns the cached result immediately without hitting the network.

---

## Cache policies

| Policy | Behaviour |
|---|---|
| `"auto"` | Cache the first successful result for the lifetime of the service object. Concurrent calls for the same arguments are deduplicated into a single in-flight request. |
| `"none"` | Call through on every invocation. No caching, no deduplication. Use for write operations like form submission. |

### Persistent cache

Pass a storage adapter to survive page refreshes or app restarts. The adapter must implement `getItem`, `setItem`, and `removeItem` — compatible with `localStorage`, `sessionStorage`, or `@daltonr/pathwrite-store`'s adapters via duck-typing (no import needed):

```ts
const appServices = defineServices(
  {
    getRoles: { fn: api.getRoles, cache: "auto" },
  },
  { storage: localStorage, keyPrefix: "myapp:svc:" }
);
```

### Prefetch

Call `prefetch()` before the path starts to warm the cache proactively. Without a manifest, every zero-argument `"auto"` method is called once:

```ts
await appServices.prefetch();

// With a manifest — specify exact argument sets:
await appServices.prefetch({ getRoleDetail: [["eng-1"], ["eng-2"]] });
```

---

## retry

Set `retry` on a method to attempt it up to that many additional times on failure before throwing. Retries use exponential back-off starting at 200 ms:

```ts
getProfile: { fn: api.getProfile, cache: "auto", retry: 2 }
// Tries once, then at 200 ms, then at 400 ms — three total attempts.
```

---

## ServiceUnavailableError

When all retry attempts are exhausted, `defineServices` throws a `ServiceUnavailableError`. This is a named class exported from the package, so you can catch it specifically in `canMoveNext` guards or step lifecycle hooks to set a user-facing error state:

```ts
import { ServiceUnavailableError } from "@daltonr/pathwrite-services";

canMoveNext: async ({ data }) => {
  try {
    const profile = await svc.getProfile(data.userId);
    return profile.verified;
  } catch (err) {
    if (err instanceof ServiceUnavailableError) {
      return false;  // block navigation; show a retry affordance in the step
    }
    throw err;
  }
}
```

`ServiceUnavailableError` exposes `method` (the method name), `attempts` (total calls made), and `cause` (the last underlying error).

---

## Further reading

- [Full docs](../../docs/README.md)

---

© 2026 Devjoy Ltd. MIT License.
