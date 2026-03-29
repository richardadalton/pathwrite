# Chapter 4: Async Patterns

Async guards change the developer's mental model in a meaningful way. A synchronous guard gives you an immediate answer — the step either passes or it does not. An async guard introduces a third state: pending. During that pending window, the engine is actively working, the snapshot communicates that fact, and the UI needs to reflect it. Getting this right means your users see a responsive, honest interface; getting it wrong means confusing flickers, double submissions, or silent failures. This chapter covers every dimension of async in Pathwrite.

---

## Async canMoveNext

Any `canMoveNext` guard can return a `Promise<GuardResult>`. The engine `await`s it, and during that time the snapshot reports `status === "validating"`. The common case is an API call that must complete before the user is allowed to advance.

Here is a complete example: an eligibility step that checks whether the applicant qualifies before proceeding.

```typescript
const applicationPath: PathDefinition<ApplicationData> = {
  id: "application",
  steps: [
    { id: "personal-details" },
    {
      id: "eligibility-check",
      canMoveNext: async (ctx) => {
        const result = await eligibilityApi.check({
          age:      ctx.data.age,
          region:   ctx.data.region,
          category: ctx.data.category,
        });
        if (!result.eligible) {
          return { allowed: false, reason: result.reason };
        }
        return true;
      }
    },
    { id: "offer-details" },
    { id: "confirmation" },
  ]
};
```

When the user clicks Next on the eligibility step:

1. The engine sets `status` to `"validating"` and emits a snapshot.
2. `canMoveNext` runs asynchronously.
3. If it resolves `true`, the engine continues with `onLeave`, step advancement, and `onEnter` as normal.
4. If it resolves `{ allowed: false, reason }`, the engine sets `blockingError` to the reason, resets `status` to `"idle"`, and stays on the current step.
5. If it throws, the engine moves to `"error"` status (covered below).

The `loadingLabel` prop on `PathShell` controls what the Next button shows while `status === "validating"`:

```tsx
<PathShell
  path={applicationPath}
  initialData={initialData}
  onComplete={handleComplete}
  loadingLabel="Checking eligibility…"
  steps={{
    "personal-details":  <PersonalDetailsStep />,
    "eligibility-check": <EligibilityStep />,
    "offer-details":     <OfferStep />,
    "confirmation":      <ConfirmationStep />,
  }}
/>
```

In a custom (headless) UI, show a loading state by checking status directly:

```tsx
<button
  onClick={() => next()}
  disabled={snapshot.status !== "idle" || !snapshot.canMoveNext}
>
  {snapshot.status === "validating" ? "Checking…" : "Next"}
</button>
```

---

## Async shouldSkip

`shouldSkip` can also be async. When the engine evaluates whether to skip a candidate step during navigation, it `await`s any promise that `shouldSkip` returns before proceeding.

```typescript
{
  id: "enhanced-verification",
  shouldSkip: async (ctx) => {
    // Only show this step if the user's account tier requires it
    const tier = await accountApi.getTier(ctx.data.userId);
    return tier !== "premium";
  }
}
```

While an async `shouldSkip` is resolving, the engine is still in a transitional status. The progress bar uses the optimistic step count — it counts steps that have not yet been confirmed as skipped — which can mean the bar appears to "jump" slightly when skips resolve. This is expected and honest: the engine does not know the final step count until it has evaluated every skip. The bar settles once navigation completes.

Note that Pathwrite emits a `console.warn` when an async `shouldSkip` is encountered, because async skip evaluation can introduce perceptible latency during navigation. Where possible, preload the data and use a synchronous `shouldSkip` that reads from `ctx.data`.

---

## The validating status in depth

During an async `canMoveNext` or `canMovePrevious`, the engine is in `"validating"` status. This is the engine's way of saying: "I have started work, I am not done, and you should not start anything else."

The engine does not queue concurrent navigation calls. If `next()` is called while `status !== "idle"`, the call returns immediately without effect. Disable navigation controls for the entire duration:

```tsx
const busy = snapshot.status !== "idle";

<button onClick={() => previous()} disabled={busy || !snapshot.canMovePrevious}>
  Back
</button>
<button onClick={() => next()} disabled={busy || !snapshot.canMoveNext}>
  {snapshot.status === "validating" ? "Checking…" : "Next"}
</button>
```

The `PathShell` handles all of this automatically when `loadingLabel` is provided. The shell disables both buttons for any non-idle status and swaps the Next button's label for `loadingLabel` when `status === "validating"`.

---

## Error handling: the error status

If an async guard (or any async hook — `onEnter`, `onLeave`, `onComplete`) throws an unhandled exception, the engine moves to `"error"` status. `snapshot.error` describes what happened:

```typescript
snapshot.error: {
  message:    string;     // the error's message
  phase:      ErrorPhase; // "validating" | "entering" | "leaving" | "completing"
  retryCount: number;     // how many times retry() has been called
} | null
```

The `phase` tells you which operation failed. `errorPhaseMessage(phase)` from `@daltonr/pathwrite-core` converts it to a human-readable string for display.

Two methods handle recovery:

- **`retry()`** re-runs the exact operation that failed. It increments `retryCount` on each call, which lets you escalate from "Try again" to "Come back later" after repeated failures.
- **`suspend()`** clears the error without retrying. It emits a `"suspended"` event, which your application can use to dismiss the wizard UI. Use this for flows where the user can choose to save their progress and return later.

Here is a retry UI pattern you can drop into any headless step:

```tsx
function ErrorPanel() {
  const { snapshot, retry, suspend } = usePathContext();
  const err = snapshot!.error;

  if (!err) return null;

  const phaseMessage = errorPhaseMessage(err.phase); // from @daltonr/pathwrite-core
  const escalated = err.retryCount >= 2;

  return (
    <div className="error-panel" role="alert">
      <p className="error-title">{phaseMessage}</p>
      <p className="error-detail">{err.message}</p>
      <div className="error-actions">
        <button onClick={() => retry()}>
          {escalated ? "Try once more" : "Try again"}
        </button>
        {escalated && (
          <button onClick={() => suspend()} className="secondary">
            Save and come back later
          </button>
        )}
      </div>
    </div>
  );
}
```

The `PathShell` renders its own error panel when `status === "error"`, which follows the same escalation pattern. If you are using the shell, no extra code is needed unless you want to customise the UI.

> **Angular:** `PathFacade` exposes `snapshot()?.error` as a signal. The retry and suspend methods are on the facade directly: `facade.retry()`, `facade.suspend()`.

---

## Guard result shapes

Both sync and async `canMoveNext` (and `canMovePrevious`) accept any of these return values:

```typescript
// Allow navigation — both forms are equivalent
return true;
return { allowed: true };   // this form is not in the type definition but true covers it

// Block silently — no message shown
return false;               // not a valid GuardResult; use the object form for blocking
return { allowed: false };

// Block with a message — surfaces as snapshot.blockingError
return { allowed: false, reason: "You must complete all required fields before continuing." };
```

Practically, `true` is the idiomatic allow and `{ allowed: false, reason }` is the idiomatic block. The `reason` string is shown directly to users, so write it in plain language.

A complete example showing all meaningful shapes:

```typescript
{
  id: "payment-details",
  canMoveNext: async (ctx) => {
    // Missing data — block silently (fieldErrors already covers the message)
    if (!ctx.data.cardToken) {
      return { allowed: false };
    }

    // Validate with the payments API
    let result;
    try {
      result = await paymentsApi.validateCard(ctx.data.cardToken);
    } catch {
      throw new Error("Could not reach the payments service. Please try again.");
    }

    if (!result.valid) {
      return { allowed: false, reason: result.declineMessage ?? "Card validation failed." };
    }

    return true;
  }
}
```

Note the explicit `throw` for network failures. Returning `{ allowed: false }` keeps the engine in `"idle"` — it is a guard decision, not a crash. Throwing moves the engine to `"error"` status and enables the retry/suspend flow. Use the right one for the situation.

---

## Timing and debouncing

Async guards run fresh on every `next()` call. If the guard makes a network request and the user clicks Next, waits for the check to fail, edits nothing, and clicks Next again — the API call fires twice. For expensive checks, this is worth considering.

The simplest caching strategy is to store the result in `data` after the first successful check and return early on subsequent calls:

```typescript
{
  id: "email-verification",
  canMoveNext: async (ctx) => {
    // Already verified in this session — skip the round-trip
    if (ctx.data.emailVerified === true) return true;

    const available = await userApi.checkEmailAvailability(ctx.data.email);
    if (!available) {
      return { allowed: false, reason: "That email address is already registered." };
    }

    // Patch the result into data so we don't re-check on retry
    // (returning a patch from canMoveNext is not supported —
    //  use setData from outside, or store in a service)
    return true;
  }
}
```

Because `canMoveNext` cannot return a data patch (only `onEnter` and `onLeave` can), the caching pattern is typically handled by a service layer that the guard calls. The service caches the result keyed by the input value and returns it on subsequent calls without a network round-trip. This pattern is developed fully in Chapter 7.

---

Async patterns work the same way inside sub-paths, which are the engine's mechanism for branching and nested flows — covered next.
