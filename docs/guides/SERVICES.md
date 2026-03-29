# Pathwrite Services

This document covers the full picture of how external services — APIs, databases, caches, mock data — connect to Pathwrite workflows. It describes what is implemented, what is planned, and the open design questions.

---

## The Core Pattern

A workflow package declares what it needs from the outside world through a typed services interface. The factory function accepts an implementation and returns a `PathDefinition` that closes over it. The engine calls service functions and awaits their results — it does not know, and does not care, what is behind them.

```ts
// Declared in the workflow package — the contract
export interface HiringServices {
  getOffices(): Promise<Office[]>;
  getPositionsForOffice(officeId: string): Promise<Position[]>;
  checkEligibility(years: number): Promise<EligibilityResult>;
}

// Factory — guards and hooks call the services
export function createHiringPath(
  svc: HiringServices
): PathDefinition<HiringData> {
  return {
    id: "hiring",
    steps: [
      {
        id: "office",
        onEnter: async ({ isFirstEntry }) => {
          if (!isFirstEntry) return;
          const offices = await svc.getOffices();
          return { offices };
        },
      },
      {
        id: "eligibility",
        canMoveNext: async ({ data }) => {
          const result = await svc.checkEligibility(Number(data.years));
          return result.eligible
            ? true
            : { allowed: false, reason: result.reason };
        },
      },
    ],
  };
}
```

The same factory produces identical path shapes across all environments:

```ts
const path = createHiringPath(new LiveServices());    // hits the API
const path = createHiringPath(new OfflineServices()); // reads from cache
const path = createHiringPath(new MockServices());    // returns test data
```

---

## What Is Implemented Today

| Capability | Status |
|---|---|
| Async guards (`canMoveNext`, `canMovePrevious`, `shouldSkip`) | Done |
| Async lifecycle hooks (`onEnter`, `onLeave`, `onComplete`) | Done |
| Factory pattern for service injection into guards/hooks | Done |
| `snapshot.status` — phase tracking (`"idle"` / `"entering"` / `"validating"` / `"completing"` / `"error"`) | Done |
| `snapshot.blockingError` — guard rejection messages | Done |
| Next button spinner while `status !== "idle"` | Done — `pw-shell__btn--loading` |
| `loadingLabel` prop on all shells | Done |
| `usePathContext<TData, TServices>()` — services in step components | Done (all adapters) |
| `snapshot.error` — structured async error with retry/suspend | Done |
| `shouldSkip` snapshot accuracy (stepCount/progress exclude confirmed skips) | Done |
| Engine tests: guard throws, guard false→true, concurrent next() | Done |

---

## Services in Step Components

Step components access the services object via `usePathContext<TData, TServices>()`. Pass the services object as a `services` prop on `PathShell` — it is threaded through context automatically.

```tsx
<PathShell path={path} services={svc} steps={{ ... }} />

function PositionStep() {
  const { snapshot, services } = usePathContext<HiringData, HiringServices>();
  const [positions, setPositions] = useState<Position[]>([]);
  const officeId = snapshot!.data.officeId as string;

  useEffect(() => {
    if (!officeId) return;
    services.getPositionsForOffice(officeId).then(setPositions);
  }, [officeId]);
  // ...
}
```

`onEnter` returns to its proper role — pre-populating *form field values* (saved address, user preferences) rather than loading display data. Option lists and runtime parameterised queries belong in step components via `services`.

---

## Planned: `@daltonr/pathwrite-services` — Caching Policy

Writing online/offline switching logic into every service method by hand is repetitive. A `defineServices` utility will wrap service functions with a declarative caching policy.

### Three modes

**`cache: 'auto'`** — Lazy memoisation. First call fetches and caches. Subsequent calls with the same arguments return the cached value without a network round-trip. For parameterised methods, the cache key is the serialised argument list — `getPositionsForOffice('dublin')` and `getPositionsForOffice('london')` are cached separately.

Use for: stable reference data — office lists, role enumerations, lookup tables, anything unlikely to change during a session.

**`cache: 'none'`** — Always live. Every call passes through to the underlying function. Use for: real-time data — live inventory, seat availability, anything where a stale answer is wrong.

```ts
const services = defineServices<HiringServices>({
  getOffices: {
    fn:    () => fetch('/api/offices').then(r => r.json()),
    cache: 'auto',
  },
  getPositionsForOffice: {
    fn:    (id: string) => fetch(`/api/positions?office=${id}`).then(r => r.json()),
    cache: 'auto',   // per-argument cache
  },
  checkEligibility: {
    fn:    (years: number) => fetch('/api/eligibility', { method: 'POST', body: JSON.stringify({ years }) }).then(r => r.json()),
    cache: 'none',   // eligibility rules could change
  },
});
```

### Prefetch — preparing for offline

`cache: 'auto'` is lazy: the first call must succeed. To prepare for offline operation, the application eagerly populates the cache before connectivity is lost:

```ts
// Zero-argument methods are prefetched automatically
await services.prefetch();

// For parameterised methods, supply the argument sets to prefetch
await services.prefetch({
  getPositionsForOffice: ['dublin', 'london', 'berlin'],
});
```

Prefetch is deliberate, not automatic. Pre-fetching everything on app start would load data for workflows the user may never open. The application decides when to prefetch — on a "Go offline" action, when connectivity is detected as degrading, or on explicit user request.

Methods marked `cache: 'none'` are excluded from prefetch entirely.

### Open design questions for `defineServices`

- **Cache storage**: In-memory means the cache is lost on page reload — prefetch before going offline would need to be repeated. IndexedDB or Cache API would survive a reload. Should this be configurable per method, or a global store option?
- **TTL / cache invalidation**: Should `cache: 'auto'` entries expire after a configurable duration? Or is session-scoped caching sufficient?
- **Request deduplication**: If two components simultaneously call `getPositionsForOffice('dublin')` before the first resolves, only one network request should go out. The `defineServices` wrapper should coalesce in-flight requests for identical arguments.

---

## Error Handling When Service Calls Fail

When an async guard, lifecycle hook, or `onComplete` throws, the engine enters `status === "error"`. The default shell replaces the footer with a recovery panel.

### The error state

The snapshot carries a structured error field whenever an engine-invoked async operation throws:

```ts
snapshot.error: {
  message:    string;
  phase:      'entering' | 'leaving' | 'validating' | 'completing';
  retryCount: number;  // how many times the user has explicitly retried
} | null
```

`phase` tells the shell which operation failed. `retryCount` drives UX escalation. Engine-invoked operations: `onEnter`, `onLeave`, `canMoveNext` / `canMovePrevious` / `shouldSkip`, `PathDefinition.onComplete`. Service calls made directly by step components via `usePathServices()` are the component's own concern, handled with local state.

### Retry and the "come back later" escalation

**First failure** (`retryCount === 0`): show a transient error with a retry button. "Couldn't load available positions. Try again."

**After the retry threshold is crossed** (e.g. `retryCount >= 2`): shift tone. Acknowledge that connectivity or the server may be the issue and — critically — confirm that progress is saved if it is. "We're having trouble reaching the server. Your progress has been saved — you can close this and try again when you're back online."

This message is only honest if a persistence store is attached to the engine. The shell knows whether persistence is active via `hasPersistence: boolean` on the snapshot. If no store is configured, the message becomes "We're having trouble reaching the server. Please try again later." — no mention of saved progress.

### The `suspend()` action

"Come back later" is meaningfully different from "cancel." Cancel signals abandonment and may clear saved state. Suspend means: pause with intent to return, preserve everything.

`suspend()` on the engine:
1. Triggers an explicit persistence flush — ensures state is written even if the normal persistence strategy has not fired yet
2. Transitions the engine to a `suspended` lifecycle state
3. Emits a `suspended` event the application listens for — typically used to close or dismiss the wizard UI

When the user returns and the application restores engine state from the persistence store, they land on the same step with the same data, as if nothing went wrong beyond a normal session restore.

The `suspended` state sits alongside the existing lifecycle states:

| State | Meaning |
|---|---|
| `active` | In progress |
| `complete` | Finished — `PathDefinition.onComplete` resolved |
| `cancelled` | User chose to stop — state may be cleared |
| `suspended` | Paused due to connectivity or server failure — state is preserved |

### Retry policy in `defineServices`

`defineServices` absorbs retries with backoff internally and only surfaces a final failure to the engine once all attempts are exhausted:

```ts
getPositionsForOffice: {
  fn:    (id: string) => fetch(`/api/positions?office=${id}`).then(r => r.json()),
  cache: 'auto',
  retry: { attempts: 3, backoff: 'exponential' },
}
```

Once exhausted, `defineServices` throws a `ServiceUnavailableError`. The engine catches it and increments `snapshot.error.retryCount`. The `retryCount` on the snapshot counts how many times the *user* has explicitly clicked "Try again" — not the internal backoff attempts, which are invisible to the user. These are distinct.

### Shell rendering

`PathShell` handles both states automatically with configurable thresholds:

```tsx
<PathShell
  path={path}
  services={svc}
  store={store}
  retryThreshold={2}               // user retries before switching to "come back later"
  onSuspend={() => modal.close()}  // called when user chooses to suspend
  onError={(err) => log(err)}      // called on every error for observability
/>
```

When `snapshot.error` is non-null and `retryCount < retryThreshold`, the shell renders a retry UI in place of the step content. When `retryCount >= retryThreshold`, it renders the "come back later" message with a suspend button. Step content and accumulated data are preserved underneath — state is never lost during error handling.

---

## Async `onComplete` — Submitting the Form

`PathDefinition.onComplete` is `(data: TData) => void | Promise<void>`. The engine awaits it. While pending, `snapshot.status` is `"completing"` and the Submit button shows a spinner. If it throws, `snapshot.error` is set with `phase: "completing"` and the shell handles it inline.

### Two-level design

Submission and UI response are distinct concerns and belong in different places.

**`PathDefinition.onComplete`** — business logic. Has services in scope via the factory closure:

```ts
export function createHiringPath(svc: HiringServices): PathDefinition<HiringData> {
  return {
    id: "hiring",
    onComplete: async (data) => {
      await svc.submitApplication(data);  // engine holds status: "completing"
    },
    steps: [...]
  };
}
```

**`PathShell.onComplete`** — UI layer. Fires after the engine's `onComplete` resolves successfully. Used to navigate to a thank-you page, close a modal, update application state. Stays synchronous — it is a notification, not a work item.

```tsx
<PathShell
  path={path}
  onComplete={() => router.push('/thank-you')}
/>
```

If `PathDefinition.onComplete` rejects, `PathShell.onComplete` never fires. The error lands on `snapshot.error` and the shell handles it inline — the user can retry or suspend without losing their form data.

This separation means the submission logic is testable independently of the UI: mock `svc.submitApplication` in tests and the full completion path is exercised without mounting a component.

---

## Gap: Field-Level Async Validation

`fieldErrors` is synchronous. Checking whether a username is taken, whether an email already has an account, or whether an ID matches a backend record requires an API call — but that error has no field to attach to today. It either goes through `canMoveNext` (which can't carry a per-field message) or lives entirely in component state.

**What is needed**: A hook for async field validation that runs on next-attempt (not on every keystroke, which would hammer the API) and attaches results to specific fields alongside the synchronous `fieldErrors` result.

Sketch:

```ts
{
  id: "account",
  fieldErrors: ({ data }) => ({
    email: !data.email ? "Required." : undefined,
  }),
  asyncFieldErrors: async ({ data }) => ({
    email: await svc.checkEmailUnique(data.email as string)
      ? undefined
      : "This email is already registered.",
  }),
}
```

`asyncFieldErrors` would run when the user clicks Next (same timing as `canMoveNext`), with the spinner showing while it is pending. The result merges into `snap.fieldErrors` so step components handle async and sync field errors identically.

**Open questions**: Should `asyncFieldErrors` also run on blur (per field)? If so, there needs to be a mechanism to trigger per-field async validation from the step component. This is more complex and may be a separate capability.

---

## Gap: Guard / Hook Timeout

If an async guard or `onEnter` call hangs — network timeout, hung upstream API — the spinner runs indefinitely. There is no timeout mechanism and no way for the user to cancel or retry. A single slow service endpoint can make the entire workflow unresponsive.

**Short-term workaround**: Wrap service functions with `Promise.race` against a timeout:

```ts
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

getPositionsForOffice: (id: string) =>
  withTimeout(fetch(`/api/positions?office=${id}`).then(r => r.json()), 5000)
```

**Longer term**: `defineServices` could support a `timeout` option per method. The error handling gap (above) is a prerequisite — a timed-out guard produces an error and needs a surface to land on.

---

## Gap: Step "Not Ready" State

A step with cascading dropdowns (select office → positions load) has no Pathwrite-provided way to signal "I'm loading, don't submit yet." Options today:

- Put a loading flag in path data and have `canMoveNext` read it — works, but mixes UI state into the form payload
- Let the user click Next while data is loading, have the guard run anyway — the guard can check the data state, but the spinner implies "validating", not "waiting for data"

**What is needed**: A `stepReady` concept — declarable by the step component or derived from a step-level check — that disables the Next button with a distinct visual state from guard evaluation.

This is lower priority than error handling and async `onComplete`, but matters for the cascading dropdown DX story.

---

## Gap: `loadInitialData` — Async Path Initialisation

If the initial data for a path must come from an API — loading a saved draft, restoring a session, fetching user context — the application must await this before calling `start()`. There is no structured place for this in the path definition; it is ad-hoc async code before `PathShell` mounts, with its own loading state managed entirely outside Pathwrite.

**What is needed**: A `loadInitialData: () => Promise<TData>` option on the path definition that runs before `onEnter` for the first step. While it is pending, the shell shows a loading state rather than an empty first step.

---

---

## Gap: Race Conditions in Parameterised Service Calls

When a step component calls `services.getPositionsForOffice(id)` in a `useEffect` and the user changes their office selection quickly, multiple in-flight requests can resolve out of order. `defineServices` deduplication handles simultaneous identical calls, but not sequential calls with different arguments.

Step components need to discard stale responses. This is standard async React practice (AbortController or a sequence counter), not a Pathwrite engine concern — but it should be documented and `defineServices` may provide an `abortable` option for service functions that support cancellation.

---

## Open Gaps

The core service integration is complete. Remaining work is in the post-1.0 backlog:

- **Field-level async validation** — `asyncFieldErrors` hook that runs on next-attempt and merges results into `snapshot.fieldErrors`
- **Guard / hook timeout** — native `timeout` option in `defineServices`; short-term workaround is `Promise.race`
- **Step "not ready" state** — first-class `isReady` mechanism to prevent Next before step data has loaded
- **Race conditions** — `abortable` option in `defineServices` for parameterised calls that can be cancelled

---

## Related Documents

- [ASYNC_GUARDS_AND_SERVICES.md](./ASYNC_GUARDS_AND_SERVICES.md) — async guards and hooks in depth
- [OFFLINE_WORKFLOWS.md](./OFFLINE_WORKFLOWS.md) — services as the online/offline abstraction layer
- [ROADMAP.md](../../ROADMAP.md) — work items and priority order

---

© 2026 Devjoy Ltd. MIT License.
