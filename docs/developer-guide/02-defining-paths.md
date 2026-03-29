# Chapter 2: Defining Paths

The `PathDefinition` is where you spend most of your time as a Pathwrite developer. It is the place where business logic lives: what steps exist, what data each step requires, when the user is allowed to advance, and what should happen when the flow ends. Getting comfortable with the full set of definition options gives you the vocabulary to express almost any flow without reaching for custom state management. This chapter covers every part of the definition in depth.

---

## PathDefinition structure

The top-level shape is straightforward. Four fields, two of which are optional:

```typescript
import type { PathDefinition } from "@daltonr/pathwrite-core";

interface OnboardingData {
  name: string;
  role: string;
  acceptedTerms: boolean;
}

const onboardingPath: PathDefinition<OnboardingData> = {
  id: "onboarding",            // required — unique within your app
  steps: [ /* ... */ ],        // required — ordered array of steps
  onComplete: async (data) => {
    await api.saveOnboarding(data);
  },
  onCancel: (data) => {
    analytics.track("onboarding_abandoned", { lastStep: "unknown" });
  },
};
```

The type parameter `<OnboardingData>` is the shape of the data object the engine will carry through all steps. Every hook and guard in every step receives a `Readonly<OnboardingData>` via `ctx.data`. TypeScript will check that your hook return values and `setData` calls match this shape.

**`id`** must be unique within your application. It appears in serialized state, analytics events, and sub-path callbacks, so choose something stable and descriptive.

**`onComplete`** fires when the user reaches the end of the last step and calls `next()`. It receives the final accumulated data object. This is where you would call an API, navigate the router, or dispatch to your application's state manager. It can be async; the engine sets `snapshot.status` to `"completing"` while it runs.

**`onCancel`** fires when the path is cancelled — either programmatically via `engine.cancel()` or by the user pressing Back on the first step. It receives the data as it stood at the moment of cancellation.

Both callbacks are called only for top-level paths. If this path is started as a sub-path inside another flow, completion and cancellation are handled by the parent step's `onSubPathComplete` and `onSubPathCancel` hooks instead.

---

## Steps

Each entry in `steps` is a `PathStep<TData>` object. Here is a full step with every property annotated:

```typescript
import type { PathStep } from "@daltonr/pathwrite-core";

const detailsStep: PathStep<OnboardingData> = {
  id: "details",        // required — unique within the path
  title: "Your details", // optional — shown in progress bars and breadcrumbs
  meta: { icon: "user" }, // optional — arbitrary data for your UI
  // ... hooks and guards described below
};
```

### `id` and `title`

`id` is the stable identifier used to link steps to their UI components, to navigate with `goToStep()`, and to track visited steps in persistence. It must be unique within the path.

`title` is an optional human-readable label exposed on the snapshot as `snapshot.stepTitle` and in the `snapshot.steps` summary array. The default shell uses it in the progress indicator. It is also available in `meta` if you need richer display data.

### `fieldErrors` — per-field validation

`fieldErrors` is a synchronous function that receives `PathStepContext` and returns a map of field ID to error string (or `undefined` to indicate no error for that field):

```typescript
{
  id: "contact",
  fieldErrors: ({ data }) => ({
    email:   !data.email?.includes("@")    ? "Valid email address required."  : undefined,
    phone:   data.phone && !/^\d{10}$/.test(data.phone) ? "10 digits required." : undefined,
  }),
}
```

When the engine evaluates a snapshot, it calls `fieldErrors` with the current data and puts the result on `snapshot.fieldErrors`. Your step components can read individual messages from it to render inline errors.

The important consequence is the **auto-derived `canMoveNext`**: when `fieldErrors` is defined and `canMoveNext` is not, the engine automatically treats the step as valid — and therefore allows forward navigation — only when every value in the map is `undefined`. You get navigation blocking for free without writing a separate guard.

```typescript
// No canMoveNext needed — the engine derives it from fieldErrors automatically.
{
  id: "name",
  fieldErrors: ({ data }) => ({
    firstName: !data.firstName?.trim() ? "Required." : undefined,
    lastName:  !data.lastName?.trim()  ? "Required." : undefined,
  }),
}
```

#### The `"_"` key for form-level errors

Some validation failures do not belong to a single field. A password confirmation mismatch, for instance, could be attributed to either the `password` field or the `confirmPassword` field — or to neither. Use `"_"` as the field key for these cases:

```typescript
fieldErrors: ({ data }) => ({
  password:        !data.password        ? "Required." : undefined,
  confirmPassword: !data.confirmPassword ? "Required." : undefined,
  _: data.password && data.confirmPassword && data.password !== data.confirmPassword
    ? "Passwords do not match."
    : undefined,
})
```

The default shell renders `"_"` errors without a field label, in the same position as labelled field errors. When implementing custom UI, check for `snapshot.fieldErrors["_"]` separately.

#### `fieldErrors` must be synchronous

`fieldErrors` is called during snapshot construction, which is synchronous. If you provide an async function, it will be called but its result will be discarded — the snapshot will show `{}`. If validation depends on asynchronous state (for example, checking email availability), resolve that state separately, store the result in `data` with `setData`, and reference it from a synchronous `fieldErrors`. Async guards are covered in Chapter 4.

### `fieldWarnings` — non-blocking hints

`fieldWarnings` has exactly the same shape as `fieldErrors` but is purely informational. Warnings never affect `canMoveNext`, they are never gated behind `hasAttemptedNext`, and the shell renders them in amber rather than red. Use them for character counters, format suggestions, and advisory messages that should not prevent the user from proceeding:

```typescript
{
  id: "bio",
  fieldErrors: ({ data }) => ({
    bio: !data.bio?.trim() ? "Bio is required." : undefined,
  }),
  fieldWarnings: ({ data }) => ({
    bio: (data.bio?.length ?? 0) > 280
      ? `${data.bio!.length - 280} characters over the recommended limit.`
      : undefined,
  }),
}
```

Because warnings are always visible — not gated by any attempt flag — they work well as live feedback that updates as the user types. Errors, by contrast, are typically shown only after the first navigation attempt (see *hasAttemptedNext and progressive disclosure* below).

### `canMoveNext` — explicit navigation guards

Most of the time, `fieldErrors` handles forward-navigation blocking, and you do not need `canMoveNext` at all. Reach for it when the condition for allowing navigation is something other than "all fields are valid":

```typescript
{
  id: "terms",
  fieldErrors: ({ data }) => ({
    _: !data.acceptedTerms ? "You must accept the terms." : undefined,
  }),
  // Explicit override — only allow Next when the checkbox is checked.
  // fieldErrors alone would work here too; this shows the pattern.
  canMoveNext: ({ data }) => data.acceptedTerms === true,
}
```

`canMoveNext` can also return a structured object to provide a blocking reason:

```typescript
canMoveNext: ({ data }) => {
  if (!data.acceptedTerms) {
    return { allowed: false, reason: "You must accept the terms before continuing." };
  }
  return true;
}
```

The `reason` string is surfaced on `snapshot.blockingError`, which the default shell renders automatically. In custom UI, display it conditionally:

```tsx
{snapshot.hasAttemptedNext && snapshot.blockingError && (
  <p className="error">{snapshot.blockingError}</p>
)}
```

`canMoveNext` can be async — the engine awaits it and sets `snapshot.status` to `"validating"` while it runs. Async guards and their UX implications are covered in Chapter 4.

### `shouldSkip` — dynamic step exclusion

`shouldSkip` returns `true` when a step should be omitted from the flow based on the current data. The engine evaluates it during navigation — when moving forward or backward — and automatically steps past any skipped steps without stopping:

```typescript
steps: [
  { id: "account-type" },
  {
    id: "vat-details",
    shouldSkip: ({ data }) => data.accountType !== "business",
  },
  { id: "review" },
]
```

A few things to keep in mind. Skipped steps are not counted in `snapshot.stepCount` and do not appear in `snapshot.steps`, so the progress bar reflects only visible steps. If all remaining steps would be skipped going forward, the engine completes the path. If all preceding steps would be skipped going backward, the engine cancels the path (or, for a sub-path, pops back to the parent).

Like `canMoveNext`, `shouldSkip` can be async — covered in Chapter 4.

### `onEnter` and `onLeave` — lifecycle hooks

These hooks fire as the user moves through the path. They are for side effects and data initialisation, not for validation or blocking — use `canMoveNext` for that.

**`onEnter`** fires when the engine arrives at a step, including when the user navigates backward. It can return a partial data patch that the engine will merge into the accumulated data:

```typescript
{
  id: "shipping",
  onEnter: async ({ data, isFirstEntry }) => {
    if (!isFirstEntry) return; // Don't overwrite data on Back/re-entry
    const address = await api.getDefaultAddress(data.userId);
    return { shippingAddress: address };
  },
}
```

`ctx.isFirstEntry` is `true` only on the very first visit to the step within the current path instance. On all subsequent entries — for example, when the user goes Back and returns — it is `false`. Always guard one-time initialisation logic with `isFirstEntry` to avoid overwriting data the user has already filled in.

**`onLeave`** fires when the engine departs a step — but only when navigation is actually allowed. If a guard blocks navigation, `onLeave` does not run. Like `onEnter`, it can return a partial data patch:

```typescript
{
  id: "billing",
  onLeave: ({ data }) => {
    // Normalise the card number format before leaving the step
    return { cardNumber: data.cardNumber?.replace(/\s/g, "") };
  },
}
```

Both hooks can be async. The engine sets `snapshot.status` to `"entering"` or `"leaving"` while they run.

---

## StepChoice — variant forms

Sometimes the same logical position in a flow needs different UI depending on earlier choices. A shipping address step might show a US form (state dropdown, ZIP code) or a EU form (region field, postal code). The data structure is different; the components are different; but from the user's perspective it is one step.

`StepChoice` handles this case. Instead of a `PathStep`, you put a `StepChoice` in the `steps` array. The choice has its own `id` (used for progress tracking and `goToStep`), a `select` function that returns which inner step to activate, and a `steps` array of the candidate `PathStep` objects:

```typescript
import type { StepChoice } from "@daltonr/pathwrite-core";

const addressChoice: StepChoice<CheckoutData> = {
  id: "address",
  title: "Shipping address",
  select: ({ data }) => data.country === "US" ? "address-us" : "address-eu",
  steps: [
    {
      id: "address-us",
      fieldErrors: ({ data }) => ({
        state:   !data.state   ? "State is required."   : undefined,
        zipCode: !data.zipCode ? "ZIP code is required." : undefined,
      }),
    },
    {
      id: "address-eu",
      fieldErrors: ({ data }) => ({
        region:     !data.region     ? "Region is required."      : undefined,
        postalCode: !data.postalCode ? "Postal code is required."  : undefined,
      }),
    },
  ],
};
```

The progress bar shows one step. The engine calls `select` on entry to determine which inner step is active, runs that step's hooks and guards as normal, and exposes the inner step's `id` on `snapshot.formId`. Your UI renders the appropriate form component by switching on `snapshot.formId`:

```tsx
function AddressStep() {
  const { snapshot } = usePathContext<CheckoutData>();

  return snapshot!.formId === "address-us"
    ? <USAddressForm />
    : <EUAddressForm />;
}
```

`StepChoice` also supports `shouldSkip` at the choice level, with the same semantics as on a `PathStep`.

---

## Path-level hooks

`onComplete` and `onCancel` on the `PathDefinition` are the path-level lifecycle hooks. They are distinct from any UI-level `onComplete` prop you might pass to `PathShell` — the definition's `onComplete` fires as part of the engine's lifecycle and is where business logic belongs (API calls, state updates, audit logs). The shell's `onComplete` prop is a UI notification for triggering transitions or navigation.

```typescript
const checkoutPath: PathDefinition<CheckoutData> = {
  id: "checkout",
  steps: [ /* ... */ ],
  onComplete: async (data) => {
    // Business logic here — this is part of the definition, not the UI.
    const order = await api.createOrder(data);
    analytics.track("checkout_completed", { orderId: order.id });
  },
  onCancel: (data) => {
    analytics.track("checkout_abandoned", { itemCount: data.items.length });
  },
};
```

If `onComplete` throws, the engine sets `snapshot.status` to `"error"` and populates `snapshot.error`. The shell renders an error state with a retry option; your definition's `onComplete` will be called again when the user retries.

---

## `hasAttemptedNext` and progressive disclosure

`fieldErrors` is evaluated on every snapshot — including the very first one, before the user has typed anything. If you render error messages unconditionally, the user sees a wall of errors before they have had a chance to fill in the form. That is not good UX.

The engine tracks this with `snapshot.hasAttemptedNext`: it starts as `false` when a step is entered and flips to `true` the first time the user calls `next()` on that step, regardless of whether navigation succeeded. It resets to `false` when the engine moves to a new step.

Use it to gate error display:

```tsx
function EmailStep() {
  const { snapshot, setData } = usePathContext<SignupData>();
  const errors = snapshot!.fieldErrors;
  const attempted = snapshot!.hasAttemptedNext;

  return (
    <div>
      <label htmlFor="email">Email address</label>
      <input
        id="email"
        type="email"
        value={snapshot!.data.email ?? ""}
        onChange={(e) => setData("email", e.target.value)}
      />
      {attempted && errors.email && (
        <span className="error">{errors.email}</span>
      )}
    </div>
  );
}
```

This pattern — hide errors until first attempt, show them immediately on all subsequent renders — is the standard Pathwrite approach to progressive disclosure. The default shell applies it automatically to its own error summary rendering. When you render errors inline yourself, you own the gating, and `hasAttemptedNext` gives you the flag to do it correctly.

Note that `fieldWarnings` are never gated by `hasAttemptedNext`. Because warnings are non-blocking advisories, it is appropriate to show them as the user types without waiting for a navigation attempt.

---

You now know how to describe a path. Chapter 3 covers what happens when a user moves through it.
