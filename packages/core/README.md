# @daltonr/pathwrite-core

Headless path/wizard/stepper engine with no framework dependencies.

## Installation

```bash
npm install @daltonr/pathwrite-core
```

## Quick start

```typescript
import { PathEngine } from "@daltonr/pathwrite-core";
import type { PathDefinition } from "@daltonr/pathwrite-core";

interface SignupData {
  name: string;
  email: string;
}

const signupPath: PathDefinition<SignupData> = {
  id: "signup",
  steps: [
    {
      id: "details",
      canMoveNext: ({ data }) => (data.name ?? "").length > 0,
    },
    {
      id: "confirm",
    },
  ],
  onComplete: (data) => console.log("Done:", data),
};

const engine = new PathEngine();
await engine.start(signupPath, { name: "", email: "" });

engine.setData("name", "Alice");
await engine.next();

const snapshot = engine.snapshot();
// snapshot.stepId       → "confirm"
// snapshot.stepIndex    → 1
// snapshot.isLastStep   → true
```

## PathEngine

| Method | Signature summary | What it does |
|---|---|---|
| `start` | `(definition, initialData?) => Promise<void>` | Start a new path (or re-start the current one). |
| `next` | `() => Promise<void>` | Advance to the next step if guards pass. |
| `previous` | `() => Promise<void>` | Go back to the previous step if guards pass. |
| `cancel` | `() => Promise<void>` | Cancel the active path; fires `onCancel` and emits `cancelled`. |
| `goToStep` | `(stepId: string) => Promise<void>` | Jump directly to a step by ID without checking guards. |
| `setData` | `(key, value) => void` | Update a single data field; emits `stateChanged`. |
| `resetStep` | `() => void` | Revert data to what it was when the current step was entered. |
| `startSubPath` | `(definition, data?, meta?) => Promise<void>` | Push a nested sub-path onto the stack. |
| `exportState` | `() => SerializedPathState \| null` | Return a plain JSON-serialisable snapshot of all engine state. |
| `fromState` | `static (state, pathDefs, options?) => PathEngine` | Reconstruct a `PathEngine` from previously exported state. |
| `subscribe` | `(listener) => () => void` | Register a removable event listener; returns an unsubscribe function. |

For the complete options and overloads see [docs/reference/core-api.md](../../docs/reference/core-api.md).

## PathSnapshot

Returned by `engine.snapshot()`. All properties are read-only.

| Property | Type | Description |
|---|---|---|
| `stepId` | `string` | ID of the currently active step. |
| `stepIndex` | `number` | Zero-based index of the current step. |
| `stepCount` | `number` | Total number of steps in the active path. |
| `stepTitle` | `string \| undefined` | Optional title defined on the step. |
| `data` | `Readonly<TData>` | Copy of all path data accumulated so far. |
| `fieldErrors` | `FieldErrors` | Map of field ID → error string from `fieldErrors` hook. |
| `fieldWarnings` | `FieldErrors` | Map of field ID → warning string from `fieldWarnings` hook. |
| `canMoveNext` | `boolean` | Evaluated result of the current step's `canMoveNext` guard. |
| `canMovePrevious` | `boolean` | Evaluated result of the current step's `canMovePrevious` guard. |
| `isFirstStep` | `boolean` | `true` when `stepIndex === 0`. |
| `isLastStep` | `boolean` | `true` when on the final step of the path. |
| `status` | `PathStatus` | Current engine state: `"idle"`, `"active"`, `"completed"`, or `"cancelled"`. |
| `blockingError` | `string \| undefined` | Reason string from a guard that returned `{ allowed: false, reason }`. |
| `progress` | `number` | Completion fraction in the range `[0, 1]`. |
| `isDirty` | `boolean` | `true` if any data field has changed since entering the current step. |

## defineServices

`defineServices` wraps async service functions with caching, in-flight deduplication, and retry — useful for guards that call external APIs on every navigation attempt.

```typescript
import { defineServices, ServiceUnavailableError } from "@daltonr/pathwrite-core";

const services = defineServices(
  {
    getRoles:    { fn: api.getRoles,    cache: "auto" },
    getUser:     { fn: api.getUser,     cache: "auto", retry: 2 },
    submitForm:  { fn: api.submitForm,  cache: "none" },
  },
  { storage: localStorage, keyPrefix: "myapp:svc:" }
);

await services.prefetch();           // warm zero-arg cached methods
const roles = await services.getRoles();
```

| Option | Values | Description |
|---|---|---|
| `cache` | `"auto"` \| `"none"` | `"auto"` caches the first result and deduplicates concurrent calls. `"none"` always calls through. |
| `retry` | `number` (default `0`) | Additional attempts on failure, with exponential back-off starting at 200 ms. Exhausted retries throw `ServiceUnavailableError`. |
| `storage` | `SyncServiceStorage \| AsyncServiceStorage` | Optional persistent cache (e.g. `localStorage`, React Native `AsyncStorage`). |

## Further reading

- [docs/reference/core-api.md](../../docs/reference/core-api.md) — full method and type reference
- [docs/getting-started/core-concepts.md](../../docs/getting-started/core-concepts.md) — guards, lifecycle hooks, sub-paths, and observers explained
- [docs/README.md](../../docs/README.md) — documentation index
