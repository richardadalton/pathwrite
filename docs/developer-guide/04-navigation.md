# Chapter 4: Navigation and Guards

Navigation is the core of what Pathwrite does. Understanding how the engine moves between steps — and what happens at each boundary — makes the difference between debugging by guesswork and knowing exactly why your UI behaves as it does. This chapter walks through every navigation method, the precise sequence of events when a step transition occurs, and the guard system that controls whether transitions are allowed at all.

---

## The navigation methods

Pathwrite exposes four ways to move between steps. They differ in whether they check guards and whether they respect `shouldSkip`.

### `next()` and `previous()`

These are the workhorses. `next()` advances one step forward; `previous()` goes one step back. Both run the direction-appropriate guard on the current step, fire `onLeave` and `onEnter`, and skip any steps whose `shouldSkip` returns `true`.

```tsx
const { next, previous } = usePathContext();

<button onClick={() => next()}>Next</button>
<button onClick={() => previous()}>Back</button>
```

`previous()` is a no-op when already on the first step of a top-level path — the engine stays put and emits no event. When called on the first step of a sub-path, it cancels the sub-path and returns control to the parent.

### `goToStep(stepId, options?)`

Jumps directly to a named step. It calls `onLeave` on the current step and `onEnter` on the target, but it bypasses guards and `shouldSkip` entirely. Use this for non-linear flows — rejection paths, admin overrides, or any case where you know it is valid to land on a step regardless of what the guard would say.

```typescript
// Jump directly to a rejection step, bypassing all guards
await engine.goToStep("application-rejected");
```

Because guards are not checked, `goToStep` will happily take the user to a step they could not normally reach. Use it deliberately.

**`validateOnLeave` option**

Pass `{ validateOnLeave: true }` to mark the departing step as attempted before navigating. This causes `hasAttemptedNext` to be `true` if the user later returns to that step, so inline field errors become visible without ever clicking Next. This is the idiomatic pattern for tab mode:

```typescript
// Tab bar click handler — switch tabs and reveal errors on the tab you just left
onClick={() => goToStep(step.id, { validateOnLeave: true })}
```

**`hasAttemptedNext` is now per-step and persistent**

`hasAttemptedNext` tracks which steps have been attempted, not whether the engine is currently on an attempted step. The flag for a given step is set when `next()` is called on it (or when `goToStep` is called with `validateOnLeave: true`). It persists when the user navigates away and back. The entire set is only cleared by `start()` / `restart()`.

### `goToStepChecked(stepId)`

Jumps to a named step but first checks the direction-appropriate guard on the current step: `canMoveNext` when jumping forward, `canMovePrevious` when jumping backward. If the guard blocks, the jump does not happen. `shouldSkip` is not evaluated on the target.

```typescript
// Jump to review, but only if the current step's guard allows it
await engine.goToStepChecked("review");
```

This is the right choice for a stepper UI that lets users click ahead to any already-valid step — you want the guard to run, but you do not need `shouldSkip` to re-evaluate the intermediate steps.

---

## What happens at a step boundary

When `next()` is called, the engine follows a precise sequence. Understanding this sequence explains a great deal of behaviour that might otherwise seem like a quirk.

**1. `canMoveNext` is evaluated on the current step.**

If the guard returns `{ allowed: false, reason }`, the engine updates the snapshot with the reason surfaced as `blockingError`, marks this step as attempted (`hasAttemptedNext` becomes `true`), and stops. No hooks fire. The user stays on the current step.

If the guard is async, the engine enters `"validating"` status while it waits. Navigation controls should be disabled during this time. The full async flow is covered in Chapter 5.

**2. `onLeave` fires on the departing step.**

The hook can return a partial data patch, which the engine merges into the path data. The user is still considered to be on the departing step at this point. Throwing from `onLeave` will set `status` to `"error"`.

**3. `shouldSkip` is evaluated on each candidate next step.**

The engine walks forward through the step array, calling `shouldSkip` on each step until it finds one that does not skip. If every remaining step skips, the path completes. Steps are evaluated in order — the engine never jumps over a step without asking whether it should.

**4. `onEnter` fires on the arriving step.**

Like `onLeave`, `onEnter` can return a data patch. It receives a `PathStepContext` with `isFirstEntry: true` on the first visit, which lets you distinguish initial setup from back-navigation re-entry.

**5. A new snapshot is emitted.**

The engine emits a `stateChanged` event with `cause: "next"`. Any subscribed framework adapter (the `usePath()` hook, the Angular `PathFacade`, etc.) picks this up and re-renders.

This sequence applies in both directions for `previous()`, with `canMovePrevious` substituted for `canMoveNext` and the step array walked backward.

---

## Status transitions

The `snapshot.status` property tells you what the engine is doing right now. It has more values than you might expect:

| Status | Meaning |
|---|---|
| `"idle"` | On a step, waiting for user input |
| `"entering"` | The `onEnter` hook is running |
| `"validating"` | A `canMoveNext` or `canMovePrevious` guard is running |
| `"leaving"` | The `onLeave` hook is running |
| `"completing"` | The path's `onComplete` callback is running |
| `"error"` | An async operation threw — see `snapshot.error` |

For most navigation UI, the practical rule is: disable controls whenever `status !== "idle"`. The engine does not queue navigation calls — if a call arrives while the engine is busy, it returns immediately without effect. Keeping buttons disabled prevents users from triggering this case.

```tsx
<button
  onClick={() => next()}
  disabled={snapshot.status !== "idle" || !snapshot.canMoveNext}
>
  Next
</button>
<button
  onClick={() => previous()}
  disabled={snapshot.status !== "idle" || !snapshot.canMovePrevious}
>
  Back
</button>
```

The `"validating"` status is the async guard state. During it, the engine is waiting for a `canMoveNext` promise to resolve. Chapter 5 covers how to handle this in the UI.

---

## blockingError and validationDisplay

When `canMoveNext` returns `{ allowed: false, reason: "You must accept the terms." }`, the reason surfaces as `snapshot.blockingError`. This is distinct from `fieldErrors` (which are per-field) and from `snapshot.error` (which is a thrown exception). A blocking error means the guard ran and made an explicit decision to halt with a message.

The default `PathShell` renders `blockingError` automatically between the step content and the navigation buttons. If you are building a custom UI or want errors to appear inline, set `validationDisplay="inline"` on `PathShell` and render the error yourself:

```tsx
<PathShell
  path={myPath}
  initialData={data}
  validationDisplay="inline"
  steps={{ details: <DetailsStep /> }}
/>
```

```tsx
// Inside DetailsStep
function DetailsStep() {
  const { snapshot } = usePathContext();
  return (
    <>
      {/* step fields ... */}
      {snapshot!.hasAttemptedNext && snapshot!.blockingError && (
        <p className="error-banner">{snapshot!.blockingError}</p>
      )}
    </>
  );
}
```

`blockingError` is cleared automatically when the user successfully navigates to a new step or calls `restart()`.

---

## canMoveNext and canMovePrevious: guard function vs. snapshot boolean

These names appear in two places with different meanings, and it is worth being precise.

On a `PathStep`, `canMoveNext` is a **guard function** — it receives a `PathStepContext` and returns a `GuardResult`. It is the definition of the rule.

On a `PathSnapshot`, `canMoveNext` is a **derived boolean** — it reflects whether the guard would currently allow navigation, evaluated synchronously at snapshot time. Async guards default to `true` in the snapshot (optimistic) because the actual result is not known without running the async work.

```typescript
// PathStep definition — a guard function
{
  id: "details",
  canMoveNext: (ctx) => {
    if (!ctx.data.email?.includes("@")) {
      return { allowed: false, reason: "A valid email address is required." };
    }
    return true;
  }
}
```

```tsx
// PathSnapshot — a derived boolean
<button disabled={!snapshot.canMoveNext}>Next</button>
```

`snapshot.canMoveNext` is also auto-derived from `fieldErrors`: if the step defines `fieldErrors` but not an explicit `canMoveNext`, the engine sets `canMoveNext` to `false` whenever any field has an active error message. You only need an explicit `canMoveNext` guard when the rule is something other than "all fields valid."

`snapshot.canMovePrevious` is `false` on the first step of a top-level path. On all other steps, it is `true` unless an explicit `canMovePrevious` guard blocks it.

> **Angular:** The same snapshot properties are available on the `PathFacade` as signals: `facade.snapshot()?.canMoveNext`. The guard function on `PathStep` is identical across all adapters.

---

## hasAttemptedNext

`snapshot.hasAttemptedNext` becomes `true` after the user calls `next()` for the first time on the current step — regardless of whether navigation succeeded. It resets to `false` when the user arrives at a new step.

The purpose is progressive error disclosure: showing validation errors before the user has had a chance to fill in the form creates a confusing first impression. By gating error display on `hasAttemptedNext`, you let the user encounter the form clean, then surface errors only after they have tried to proceed.

```tsx
function EmailStep() {
  const { snapshot, setData } = usePathContext();
  const errors = snapshot!.fieldErrors;
  const attempted = snapshot!.hasAttemptedNext;

  return (
    <>
      <label htmlFor="email">Email address</label>
      <input
        id="email"
        value={String(snapshot!.data.email ?? "")}
        onChange={(e) => setData("email", e.target.value)}
      />
      {attempted && errors.email && (
        <span className="field-error">{errors.email}</span>
      )}
    </>
  );
}
```

The shell uses the same flag internally to decide when to render its automatic `fieldErrors` summary — you get consistent timing whether you use the shell's summary or your own inline errors.

---

## isDirty and resetStep

`snapshot.isDirty` is `true` when the current step's data differs from what it was when the step was entered. The engine takes a snapshot of `data` on each step entry and compares against it on every change. `isDirty` resets to `false` when the user navigates to a new step.

The most common use is a "Cancel changes" or "Reset" button that reverts in-progress edits without navigating away. Pair it with `resetStep()`, which restores data to the entry snapshot:

```tsx
function AddressStep() {
  const { snapshot, resetStep } = usePathContext();

  return (
    <>
      {/* address fields ... */}
      {snapshot!.isDirty && (
        <button
          type="button"
          onClick={() => resetStep()}
          className="secondary"
        >
          Cancel changes
        </button>
      )}
    </>
  );
}
```

`resetStep()` only reverts the current step's data — it does not navigate. The user stays on the same step with the data restored to what it was on entry. `isDirty` returns to `false` after the reset.

---

All the navigation so far has been synchronous. Chapter 5 covers async guards — the most powerful feature in the engine.

© 2026 Devjoy Ltd. MIT License.
