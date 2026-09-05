# @daltonr/pathwrite-core

Headless engine for multi-step paths and flows — wizards, onboarding, checkouts, document lifecycles — with no framework dependencies.

## Installation

```bash
npm install @daltonr/pathwrite-core
```

## Quick start

```typescript
import { PathEngine } from "@daltonr/pathwrite-core";
import type { PathDefinition, PathData } from "@daltonr/pathwrite-core";

// Data types extend PathData (a string-keyed record) so the engine can store them.
interface SignupData extends PathData {
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
| `start` | `(definition, initialData?) => Promise<void>` | Start a new path, replacing any active one. |
| `restart` | `() => Promise<void>` | Tear down and restart the last-started path with its original `initialData`. |
| `next` | `() => Promise<void>` | Advance to the next step if guards pass. |
| `previous` | `() => Promise<void>` | Go back to the previous step if guards pass. |
| `cancel` | `() => Promise<void>` | Cancel the active path. Top-level: fires `onCancel` and emits `cancelled`. Sub-path: pops back to the parent and fires its `onSubPathCancel`. |
| `goToStep` | `(stepId: string, options?: { validateOnLeave?: boolean }) => Promise<void>` | Jump directly to a step by ID without checking guards. |
| `goToStepChecked` | `(stepId: string, options?: { validateOnLeave?: boolean }) => Promise<void>` | Jump to a step by ID, running `canMoveNext` / `canMovePrevious` for the direction of travel. |
| `setData` | `(key, value) => Promise<void>` | Update a single data field; emits `stateChanged`. |
| `resetStep` | `() => Promise<void>` | Revert data to what it was when the current step was entered. |
| `startSubPath` | `(definition, data?, meta?) => Promise<void>` | Push a nested sub-path onto the stack. |
| `retry` | `() => Promise<void>` | Re-run the operation that failed when `status === "error"`. |
| `suspend` | `() => Promise<void>` | Clear any error and emit `suspended`, leaving state intact for a later restore. |
| `validate` | `() => void` | Set `snapshot.hasValidated` so every step can reveal its errors at once. |
| `exportState` | `() => SerializedPathState \| null` | Return a plain JSON-serialisable snapshot of all engine state. |
| `fromState` | `static (state, pathDefs, options?) => PathEngine` | Reconstruct a `PathEngine` from previously exported state. |
| `snapshot` | `() => PathSnapshot \| null` | Read the current state synchronously; `null` when no path is active. |
| `subscribe` | `(listener) => () => void` | Register a removable event listener; returns an unsubscribe function. |

**`completionBehaviour`** on `PathDefinition` controls what happens after the path finishes:
- `"stayOnFinal"` (default) — engine stays active, `snapshot().status === "completed"`. `PathShell` renders a completion panel. Call `engine.restart()` to begin again.
- `"dismiss"` — engine clears its state, `snapshot()` returns `null`.
- `"reset"` — engine immediately restarts from step 1 (useful for kiosk / repeating flows).

For the complete options and overloads see [docs/reference/core-api.md](../../docs/reference/core-api.md).

## PathSnapshot

Returned by `engine.snapshot()`. All properties are read-only.

| Property | Type | Description |
|---|---|---|
| `stepId` | `string` | ID of the currently active step. |
| `stepIndex` | `number` | Zero-based index of the current step among visible (non-skipped) steps. |
| `stepCount` | `number` | Number of visible steps in the active path (confirmed skips excluded). |
| `stepTitle` | `string \| undefined` | Optional title defined on the step. |
| `data` | `TData` | Copy of all path data accumulated so far. Mutating it has no effect on the engine. |
| `fieldErrors` | `Record<string, string>` | Map of field ID → error string from the `fieldErrors` hook (empty entries dropped). |
| `fieldWarnings` | `Record<string, string>` | Map of field ID → warning string from the `fieldWarnings` hook. |
| `canMoveNext` | `boolean` | Evaluated result of the current step's `canMoveNext` guard. |
| `canMovePrevious` | `boolean` | Evaluated result of the current step's `canMovePrevious` guard. |
| `isFirstStep` | `boolean` | `true` when `stepIndex === 0`. |
| `isLastStep` | `boolean` | `true` when on the final step of a top-level path (always `false` inside a sub-path). |
| `status` | `PathStatus` | Current engine state. Key values: `"idle"` (ready to navigate), `"completing"` (running `onComplete`), `"completed"` (path finished, engine still active with `stayOnFinal`), `"error"` (async operation failed). |
| `blockingError` | `string \| null` | Reason string from a guard that returned `{ allowed: false, reason }`; `null` when there is none. |
| `progress` | `number` | Completion fraction in the range `[0, 1]` (`1` for a single-step path). |
| `isDirty` | `boolean` | `true` if any data field has changed since entering the current step. |
| `hasAttemptedNext` | `boolean` | `true` once `next()` has been called on the current step; remembered per step until `start()` / `restart()`. |
| `error` | `{ message; phase; retryCount } \| null` | Details of the failed operation when `status === "error"`. |

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
