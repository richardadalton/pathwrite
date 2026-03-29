# Async Guards and External Services

## The Architecture

A workflow package declares what it needs from the outside world through a typed services interface. The factory function accepts an implementation of that interface and returns a `PathDefinition` that closes over it. The engine calls service functions and awaits their results — it never knows, or needs to know, what is behind them.

```ts
// Declared in the workflow package — the contract
export interface ApplicationServices {
  getRoles(): Promise<Role[]>;
  checkEligibility(years: number): Promise<EligibilityResult>;
}

// Factory — services are injected, guards can call them
export function createApplicationPath(
  svc: ApplicationServices
): PathDefinition<ApplicationData> {
  return {
    id: "job-application",
    steps: [
      {
        id: "role",
        onEnter: async ({ isFirstEntry }) => {
          if (!isFirstEntry) return;
          const roles = await svc.getRoles();
          return { availableRoles: roles };
        },
      },
      {
        id: "eligibility",
        canMoveNext: async ({ data }) => {
          const result = await svc.checkEligibility(Number(data.yearsExperience));
          return result.eligible
            ? true
            : { allowed: false, reason: result.reason };
        },
      },
    ],
  };
}
```

The same factory produces identical `PathDefinition` shapes regardless of the service implementation:

```ts
const path = createApplicationPath(new LiveServices());      // hits the API
const path = createApplicationPath(new OfflineServices());   // reads from cache
const path = createApplicationPath(new MockServices());      // returns test data
```

The engine receives the same structure each time. It has no knowledge of which implementation is running. See [OFFLINE_WORKFLOWS.md](./OFFLINE_WORKFLOWS.md) for the full treatment of services as the online/offline abstraction layer.

---

## Async Guards

`canMoveNext`, `canMovePrevious`, and `shouldSkip` all accept `Promise` return values. The engine awaits the result before deciding whether to advance. This is how guards call external services.

Guards return a `GuardResult`:
- `true` — allow navigation
- `{ allowed: false }` — block navigation (no message)
- `{ allowed: false, reason: "..." }` — block navigation with a message surfaced as `snapshot.blockingError`

```ts
canMoveNext: async ({ data }) => {
  const result = await svc.validateApprovers(data.approvers as string[]);
  return result.valid
    ? true
    : { allowed: false, reason: result.failureReason };
}
```

While the guard is pending:
- `snapshot.status` is `"validating"`
- The shell's Next button shows a CSS spinner via `pw-shell__btn--loading`
- All navigation buttons are disabled
- The step content is stable and visible

When the guard returns `true`, navigation proceeds. When it returns `{ allowed: false }`, the user stays on the current step and `snapshot.blockingError` is set to the `reason` (if provided). When it throws, the engine enters `status === "error"` — the shell replaces the footer with a recovery panel.

### `blockingError` — surfacing guard rejection messages

When a guard blocks navigation with a reason, the message is available as `snapshot.blockingError`. The default shell renders it automatically. In custom UI:

```tsx
{snapshot.hasAttemptedNext && snapshot.blockingError && (
  <p className="guard-error">{snapshot.blockingError}</p>
)}
```

`blockingError` is gated by `hasAttemptedNext` so it's only shown after the user has tried to proceed — not before they've had a chance to fill in the step. It clears automatically on step entry and on `restart()`.

### Snapshot behaviour with async guards

The snapshot evaluates guards synchronously for display purposes. Async guards always return `true` in `snapshot.canMoveNext` — this is an optimistic default, not the actual guard result. The guard is still enforced during actual navigation.

---

## Async Lifecycle Hooks

`onEnter`, `onLeave`, `onSubPathComplete`, and `onSubPathCancel` all support async return values. The engine awaits them and applies any data patch before updating the snapshot.

```ts
onEnter: async ({ data, isFirstEntry }) => {
  if (!isFirstEntry) return;
  const profile = await svc.getUserProfile(data.userId as string);
  return {
    billingName:    profile.name,
    billingAddress: profile.address,
  };
}
```

While `onEnter` is executing, `snapshot.status` is `"entering"`. While `onLeave` is executing it is `"leaving"`. While `onComplete` is executing it is `"completing"`. This lets step components distinguish between lifecycle phases.

### `onEnter` for reference data — the tradeoff

Using `onEnter` to load dropdown options into path data (as in `demo-react-async`) is a workable pattern but has a conceptual cost: option lists are UI data, not form data, and they end up in the submission payload unless explicitly filtered in `onComplete`.

The cleaner shape is for step components to call `services.getOptions()` directly via `usePathContext<TData, TServices>().services`, with the service responsible for pre-loading and caching. `onEnter` is better suited to pre-populating *form field values* from an API — things that genuinely belong in path data.

```ts
// Good use of onEnter — patches form data
onEnter: async ({ data, isFirstEntry }) => {
  if (!isFirstEntry) return;
  const address = await svc.getSavedAddress(data.userId as string);
  return { street: address.street, city: address.city };
}

// Workable but messy — option lists pollute path data
onEnter: async ({ isFirstEntry }) => {
  if (!isFirstEntry) return;
  const roles = await svc.getRoles();
  return { availableRoles: roles };  // shouldn't be in form payload
}
```

---

## Service Calls in Step Components

Step components access the services object via `usePathContext<TData, TServices>()`. The services value is passed as a prop on `PathShell` and threaded through context automatically.

```tsx
// Pass services to the shell
<PathShell path={path} services={svc} steps={{ ... }} />

// In a step component
function PositionStep() {
  const { snapshot, services, setData } = usePathContext<AppData, AppServices>();
  const [positions, setPositions] = useState<Position[]>([]);
  const officeId = snapshot!.data.officeId as string;

  useEffect(() => {
    if (!officeId) return;
    services.getPositionsForOffice(officeId).then(setPositions);
  }, [officeId]);
  // ...
}
```

The same pattern works across all adapters:

```svelte
<!-- Svelte -->
<PathShell {path} {services} ... />

<script>
  const { snapshot, services } = usePathContext<AppData, AppServices>();
</script>
```

```typescript
// Angular — usePathContext() in step components
protected readonly path = usePathContext<AppData, AppServices>();
// path.services is typed as AppServices
```

If the service pre-loads static data at construction time, the step receives it immediately — no loading state needed. Parameterised calls run reactively as the user makes selections, with the service handling whether the result comes from an API or a local filter.

### What `onEnter` is for

`onEnter` runs once when the user enters a step (and again if they return, unless guarded by `isFirstEntry`). It is the right hook for pre-populating *form field values* from a service — billing address pre-filled from a saved profile, a document pre-loaded for review, a default selection from user preferences. The returned patch goes into path data and belongs there.

It is not the right mechanism for option lists (UI data that doesn't belong in the submission payload) or for data that reacts to mid-step user input (which `onEnter` won't re-run for). Use `services` in the step component for those.

---

## Testing

The factory pattern makes workflows testable without mocking:

```ts
const testServices: ApplicationServices = {
  getRoles:           () => Promise.resolve([{ id: "eng", label: "Engineer" }]),
  checkEligibility:   () => Promise.resolve({ eligible: true }),
};

const path = createApplicationPath(testServices);
const engine = new PathEngine();
await engine.start(path, INITIAL_DATA);
await engine.next();
// ...
```

No HTTP interception, no global state, no coupling to implementation details. The test drives the workflow through its service interface. See [OFFLINE_WORKFLOWS.md](./OFFLINE_WORKFLOWS.md) for the connection between mock services and offline capability.

---

## Status

| Capability | Status |
|---|---|
| Async guards (`canMoveNext`, `canMovePrevious`, `shouldSkip`) | Implemented and tested |
| Async lifecycle hooks (`onEnter`, `onLeave`, `onSubPathComplete`) | Implemented and tested |
| `snapshot.status` for precise phase tracking | Implemented (`"idle"` \| `"entering"` \| `"leaving"` \| `"validating"` \| `"completing"` \| `"error"`) |
| `snapshot.blockingError` — guard rejection message | Implemented |
| Next button spinner while `status !== "idle"` | Implemented (all adapters) |
| `loadingLabel` prop on all shells | Implemented |
| `usePathContext<TData, TServices>()` — services in step components | Implemented (all adapters) |

---

© 2026 Devjoy Ltd. MIT License.
