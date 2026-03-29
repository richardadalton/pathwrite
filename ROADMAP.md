# Pathwrite — Road to 1.0

---

## Where we are

The core engine, all five framework adapters (React, Vue, Svelte, Angular, React Native), the store package, and the services package are built and tested. The public API covers:

- Multi-step navigation with guards, validation, and lifecycle hooks
- Async guards with `PathStatus` for precise loading states
- `GuardResult` — guards return a reason when blocking, surfaced as `snapshot.blockingError`
- `onComplete: (data: TData) => void | Promise<void>` — async completion with `status === "completing"` and full error recovery
- Error handling with retry and suspend — `status === "error"` replaces the footer with a recovery UI
- Sub-paths (nested wizards) with full stack management
- `StepChoice` — conditional step selection
- `usePathContext<TData, TServices>()` — consistent across all adapters
- `defineServices` — declarative cache, deduplication, and prefetch
- Persistence via `PathStore` (HttpStore, LocalStorageStore)

---

## Must-have for 1.0

These are gaps that would force a breaking change or a painful workaround if shipped as-is.

### 1. Async `shouldSkip` snapshot accuracy

**Status:** When `shouldSkip` returns a `Promise`, the synchronous snapshot evaluation defaults to `false` (don't skip). This means `stepCount` and `progress` can be wrong while the engine is deciding which steps to show — the progress bar jumps when skips resolve.

**Fix:** Same approach as `canMoveNext` — optimistic default in snapshot (include the step), enforce asynchronously during navigation. Add a console warning for async `shouldSkip` so consumers know what's happening.

---

### 2. Documentation pass

The guides were written before several API changes. Before 1.0 they need to reflect current reality:

- `isNavigating` → `snapshot.status` throughout
- `getPathContext` → `usePathContext` in Svelte examples
- `injectPath` → `usePathContext` in Angular examples
- `canMoveNext: () => false` → `GuardResult` shape
- `blockingError` and `loadingLabel` documented
- `defineServices` guide verified against the shipped implementation
- `usePathContext<TData, TServices>()` services pattern documented with a full example

---

## Post-1.0 backlog

These are real gaps but not blocking. None require breaking changes.

### Field-level async validation

`fieldErrors` is synchronous. Checking email uniqueness against an API must go through `canMoveNext`, which blocks navigation but can't attach the message to a specific field. A future `asyncFieldErrors` hook would run on next-attempt and merge into `snap.fieldErrors`.

Depends on: error surface design (currently using `blockingError` as the landing spot — may be sufficient).

### Step "not ready" state

A step component that is still loading its own data (e.g. fetching a list of options) has no clean way to prevent the user from hitting Next before the load completes. Current workaround: `canMoveNext` returns `{ allowed: false }` until data is ready. A first-class `isReady` mechanism would be cleaner.

### Guard / hook timeout

Long-running guards with no timeout leave the user stuck indefinitely. A `timeout` option (throwing `ServiceUnavailableError` from `@daltonr/pathwrite-services`) covers most cases, but native engine support would be cleaner.

### Offline workflows / IndexedDB store

`@daltonr/pathwrite-services` supports a pluggable `ServiceCacheStorage` interface. An `IndexedDBStore` implementation that satisfies it would enable full offline-first workflows. Blocked until the services caching pattern has been used in production and the storage interface is stable.

### Race conditions in parameterised calls

If a step unmounts while a service call is in flight, the response may try to update unmounted state. The pattern (AbortController passed to service methods) is documented but not enforced. A future `abortable` option on `defineServices` methods would handle this declaratively.

---

## 1.0 release checklist

- [ ] Async `shouldSkip` snapshot accuracy fix
- [ ] Documentation pass (all guides reflect current API)
- [ ] Changeset bump to 1.0.0 across all packages
- [ ] Publish to npm

---

*Last updated: 2026-03-28*
