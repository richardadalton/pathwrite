# Navigation, Guards, and Forms

This guide covers how to define a path, describe individual steps, control navigation, validate data, and use Pathwrite for single-step forms.

---

## PathDefinition

A `PathDefinition` is the top-level descriptor for a path. It contains an ID, an optional title, an ordered array of steps, and optional lifecycle callbacks.

```typescript
import { PathDefinition } from "@daltonr/pathwrite-core";

const myPath: PathDefinition = {
  id: "my-path",        // unique within your app
  title: "My Path",     // optional, for display
  steps: [
    { id: "step-one",   title: "Step One" },
    { id: "step-two",   title: "Step Two" },
    { id: "step-three", title: "Step Three" },
  ],
  onComplete: (data) => {
    console.log("Path completed with data:", data);
  },
  onCancel: (data) => {
    console.log("Path cancelled with data:", data);
  }
};
```

### Path-level callbacks

| Field | Type | Description |
|---|---|---|
| `onComplete` | `(data: TData) => void \| Promise<void>` | Called when a top-level path completes (user reaches the end of the last step). Receives the final path data. Not called for sub-paths — sub-path completion is handled by the parent step's `onSubPathComplete` hook. |
| `onCancel` | `(data: TData) => void \| Promise<void>` | Called when a top-level path is cancelled. Receives the path data at the time of cancellation. Not called for sub-paths. |

---

## PathStep properties

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Unique within the path. Used to link steps to UI blocks. |
| `title` | `string` | No | Human-readable label. Exposed in the snapshot as `stepTitle` and in `steps[].title`. |
| `meta` | `Record<string, unknown>` | No | Arbitrary metadata (e.g. icon name, group). Exposed as `stepMeta` and `steps[].meta`. |
| `shouldSkip` | `(ctx) => boolean \| Promise<boolean>` | No | Return `true` to skip this step during navigation. Re-evaluated on every navigation. |
| `canMoveNext` | `(ctx) => GuardResult \| Promise<GuardResult>` | No | Return `true` to allow or `{ allowed: false, reason? }` to block forward navigation. If omitted and `fieldErrors` is defined, auto-derived. |
| `canMovePrevious` | `(ctx) => GuardResult \| Promise<GuardResult>` | No | Return `true` to allow or `{ allowed: false, reason? }` to block backward navigation. |
| `fieldErrors` | `(ctx) => Record<string, string \| undefined>` | No | Returns a map of field ID to error message. Errors gate `canMoveNext` auto-derivation and are displayed by the default shell. Must be synchronous. |
| `fieldWarnings` | `(ctx) => Record<string, string \| undefined>` | No | Same shape as `fieldErrors` but purely informational — warnings never block navigation and are shown immediately without waiting for `hasAttemptedNext`. Must be synchronous. |
| `onEnter` | `(ctx) => Partial<TData> \| void \| Promise<...>` | No | Called on arrival at a step (including Back navigation). Can return a partial data patch. Use `ctx.isFirstEntry` to guard one-time initialisation. |
| `onLeave` | `(ctx) => Partial<TData> \| void \| Promise<...>` | No | Called on departure (only when the guard allows). Can return a partial data patch. |
| `onSubPathComplete` | `(subPathId, subPathData, ctx, meta?) => Partial<TData> \| void \| Promise<...>` | No | Called on the parent step when a sub-path completes naturally. |
| `onSubPathCancel` | `(subPathId, subPathData, ctx, meta?) => Partial<TData> \| void \| Promise<...>` | No | Called on the parent step when a sub-path is cancelled. |

### PathStepContext

Every hook and guard receives a `PathStepContext`:

```typescript
interface PathStepContext<TData> {
  readonly pathId:       string;          // ID of the currently active path
  readonly stepId:       string;          // ID of the current step
  readonly data:         Readonly<TData>; // snapshot copy — mutating it has no effect
  readonly isFirstEntry: boolean;         // true only on the very first visit to this step
}
```

`ctx.data` is a copy. To update data, return a partial patch from the hook. The engine merges it automatically.

### Using `isFirstEntry` for one-time initialisation

`onEnter` fires on every entry including Back navigation. Use `isFirstEntry` to guard logic that should only run once:

```typescript
{
  id: "items",
  onEnter: (ctx) => {
    if (!ctx.isFirstEntry) return; // don't reset data on Back/re-entry
    return { items: [], currentIndex: 0 };
  }
}
```

For data that should be set once at path start, prefer `initialData` passed to `start()` over `onEnter`.

---

## StepChoice — variant forms at a single step

A single step can present different form variants depending on data. While Pathwrite has no built-in "choice" type, the pattern is straightforward: use `shouldSkip` to route past variant steps and render different content in the step template based on `snapshot.data`.

The common approach is to define variant steps and skip the ones that don't apply:

```typescript
steps: [
  { id: "account-type" },               // user picks "personal" or "business"
  {
    id: "personal-details",
    shouldSkip: (ctx) => ctx.data.accountType !== "personal"
  },
  {
    id: "business-details",
    shouldSkip: (ctx) => ctx.data.accountType !== "business"
  },
  { id: "review" }
]
```

---

## Step lifecycle — hook execution order

### Moving forward

```
canMoveNext(current step)
  → blocked: stop, emit stateChanged (status: "idle")
  → allowed:
      onLeave(current step)         ← patch applied to data
      advance index
      shouldSkip(new step)?         ← repeat until a non-skipped step is found
      onEnter(new step)             ← patch applied to data
      emit stateChanged (status: "idle")
```

If all remaining steps are skipped going forward, the path completes.

### Moving backward

```
canMovePrevious(current step)
  → blocked: stop, emit stateChanged (status: "idle")
  → allowed:
      onLeave(current step)         ← patch applied to data
      decrement index
      shouldSkip(new step)?         ← repeat until a non-skipped step is found
      if index < 0 on top-level path: no-op (stay on step 0, no event emitted)
      if index < 0 on sub-path: pop back to parent, emit stateChanged
      onEnter(new step)             ← patch applied to data
      emit stateChanged (status: "idle")
```

If all preceding steps are skipped going backward, the path cancels.

### Async hooks

All hooks and guards can be `async` or return a `Promise`. The engine `await`s them and sets `snapshot.status` to a non-`"idle"` value for the entire duration, allowing you to disable navigation controls while they run.

---

## Navigation

The navigation API is identical in shape across all adapters (React, Vue, Svelte, Angular, and the core engine directly).

### `next()`

Advance forward one step. Runs `canMoveNext` on the current step, then `onLeave` and `onEnter`. Completes the path when called on the last step.

```typescript
await engine.next();
```

### `previous()`

Go back one step. Runs `canMovePrevious`, then `onLeave` and `onEnter`. No-op when already on the first step of a top-level path. Cancels a sub-path when called on the sub-path's first step.

```typescript
await engine.previous();
```

### `goToStep(stepId)`

Jump directly to a step by ID. Calls `onLeave` on the current step and `onEnter` on the target step. Bypasses guards and `shouldSkip`. Use for non-linear transitions such as rejection flows.

```typescript
await engine.goToStep("draft");
```

### `goToStepChecked(stepId)`

Jump to a step by ID while still enforcing the current step's guard. Checks `canMoveNext` when jumping forward or `canMovePrevious` when jumping backward. Navigation is blocked if the guard returns false.

```typescript
await engine.goToStepChecked("review");
```

### Concurrent navigation

All navigation methods are debounced automatically. If a navigation call arrives while `status !== "idle"`, it returns immediately without queuing. Disable controls while the engine is busy to prevent this:

```html
<button disabled={snapshot.status !== "idle" || !snapshot.canMoveNext}>Next</button>
<button disabled={snapshot.status !== "idle" || !snapshot.canMovePrevious}>Back</button>
```

---

## Guards — canMoveNext and canMovePrevious

Guards block navigation without altering data. They receive `PathStepContext` and return a `GuardResult`:

- `true` — allow navigation
- `{ allowed: false }` — block navigation (no message)
- `{ allowed: false, reason: "..." }` — block navigation with a message surfaced as `snapshot.blockingError`

```typescript
{
  id: "details",
  canMoveNext: (ctx) => {
    if (!ctx.data.name?.trim()) {
      return { allowed: false, reason: "Name is required." };
    }
    return true;
  }
}
```

When a guard blocks, the engine stays on the current step. `onEnter` is not re-run.

### `blockingError` — guard rejection messages

When `canMoveNext` returns `{ allowed: false, reason: "..." }`, the reason is surfaced as `snapshot.blockingError`. The default shell renders it automatically. In custom UI, display it after the user has attempted to proceed:

```tsx
{snapshot.hasAttemptedNext && snapshot.blockingError && (
  <p className="error">{snapshot.blockingError}</p>
)}
```

`blockingError` is cleared automatically when the user navigates to a new step or calls `restart()`.

### Proactive guard feedback

The snapshot includes evaluated `canMoveNext` and `canMovePrevious` booleans built from the current step's guards at snapshot time. Use them to proactively disable buttons before the user clicks:

```typescript
<button disabled={snapshot.status !== "idle" || !snapshot.canMoveNext}>Next</button>
```

### Async guards

If a guard is async, the snapshot defaults to `true` (optimistic) — the button appears enabled until clicked. Once clicked, `snapshot.status` becomes `"validating"`, the guard runs, and if it blocks then `snapshot.blockingError` is set.

If you need to pre-disable the button based on async state, load the result ahead of time and store it in `data`, then use a synchronous guard:

```typescript
await facade.setData("emailAvailable", await api.checkEmail(email));

// Guard is synchronous — snapshot reflects it immediately
{ canMoveNext: (ctx) => ctx.data.emailAvailable === true }
```

### Guard safety

Guards and `fieldErrors` run before `onEnter` on first entry. At that moment, `data` still reflects `initialData`, so fields your `onEnter` would set are not yet present. Write guards defensively:

```typescript
// ✅ Safe — handles undefined gracefully
canMoveNext: (ctx) => (ctx.data.name as string ?? "").trim().length > 0
```

If a guard or `fieldErrors` hook throws during snapshot evaluation, Pathwrite catches the error, logs a `console.warn` with the step ID, and returns the safe default (`true` / `{}`) so the UI remains operable.

---

## `fieldErrors` — per-field validation

`fieldErrors` is a synchronous hook that returns a map of field ID to error string (or `undefined` for no error). The shell displays these messages below the step body with human-readable labels. The snapshot exposes them as `snapshot.fieldErrors` so step templates can render per-field inline errors.

```typescript
{
  id: "details",
  fieldErrors: ({ data }) => ({
    firstName: !data.firstName?.trim() ? "First name is required." : undefined,
    email:     !String(data.email ?? "").includes("@") ? "Valid email required." : undefined,
  })
}
```

### Auto-derived `canMoveNext`

When `fieldErrors` is defined and `canMoveNext` is not, the engine automatically derives `canMoveNext` as `true` when every field message is `undefined`, and `false` when any message is non-empty. Only define an explicit `canMoveNext` when your guard logic differs from "all fields valid":

```typescript
// ✅ No canMoveNext needed — auto-derived from fieldErrors
{ id: "details", fieldErrors: ({ data }) => ({ name: !data.name ? "Required." : undefined }) }

// ✅ Explicit canMoveNext when the guard is more than "all fields valid"
{ id: "terms", fieldErrors: ..., canMoveNext: (ctx) => ctx.data.agreed === true }
```

### Form-level errors

Use `"_"` as the field key for errors that don't belong to a specific field. The shell renders `"_"` errors without a label:

```typescript
fieldErrors: ({ data }) => ({
  _: data.password !== data.confirmPassword ? "Passwords do not match." : undefined,
})
```

### `fieldErrors` must be synchronous

`fieldErrors` is called during snapshot construction, which is synchronous. Async functions are called but their result is discarded (the snapshot defaults to `{}`). If validation depends on async state, load it beforehand, store the result in `data`, and reference it from a synchronous `fieldErrors`.

---

## `fieldWarnings` — non-blocking hints

`fieldWarnings` has the same shape as `fieldErrors` but is purely informational. Warnings never block navigation and are displayed immediately — they are not gated behind `hasAttemptedNext`. Use them for hints, deprecation notices, or advisory messages that should not prevent the user from proceeding.

```typescript
{
  id: "password",
  fieldErrors: ({ data }) => ({
    password: !data.password ? "Password is required." : undefined,
  }),
  fieldWarnings: ({ data }) => ({
    password: data.password && data.password.length < 12
      ? "Consider using a longer password for better security."
      : undefined,
  })
}
```

`fieldWarnings` is exposed on the snapshot as `snapshot.fieldWarnings`. Like `fieldErrors`, it must be synchronous.

---

## `validationDisplay` modes

The shell `validationDisplay` prop controls how `fieldErrors` are rendered:

| Value | Behaviour |
|---|---|
| `"summary"` | Shell renders an error list below the step body (default) |
| `"inline"` | Shell suppresses the error list — handle rendering in your step template |
| `"both"` | Shell renders the error list and your template can also render inline errors |

Use `"inline"` or `"both"` when you want per-field errors to appear adjacent to each input rather than collected at the bottom of the step.

```tsx
// React — inline errors in the step template
function DetailsStep() {
  const { snapshot, setData } = usePathContext();
  return (
    <>
      <input value={snapshot!.data.email ?? ""}
             onChange={(e) => setData("email", e.target.value)} />
      {snapshot!.hasAttemptedNext && snapshot!.fieldErrors.email && (
        <span className="error">{snapshot!.fieldErrors.email}</span>
      )}
    </>
  );
}
```

---

## Using the core engine directly (without PathShell)

You can drive Pathwrite entirely in custom (headless) UI by working with `PathEngine` and the snapshot directly, without any shell component.

```typescript
import { PathEngine, PathDefinition } from "@daltonr/pathwrite-core";

const engine = new PathEngine();

const path: PathDefinition = {
  id: "setup",
  steps: [
    { id: "welcome" },
    { id: "configure", canMoveNext: (ctx) => !!ctx.data.apiKey },
    { id: "done" }
  ]
};

const unsubscribe = engine.subscribe((event) => {
  if (event.type === "stateChanged") {
    render(event.snapshot);
  }
  if (event.type === "completed") {
    console.log("Path done:", event.data);
    unsubscribe();
  }
});

await engine.start(path, { apiKey: "" });
```

In a framework adapter (React, Vue, Svelte, Angular), the same pattern applies without `PathShell`:

```tsx
// React — headless, custom UI
function CoursePath() {
  const { snapshot, start, next, previous, setData } = usePath();

  if (!snapshot) {
    return <button onClick={() => start(myPath, { name: "" })}>Start</button>;
  }

  return (
    <div>
      {snapshot.stepId === "details" && (
        <input value={String(snapshot.data.name ?? "")}
               onChange={(e) => setData("name", e.target.value)} />
      )}
      <button onClick={previous} disabled={snapshot.status !== "idle" || !snapshot.canMovePrevious}>Back</button>
      <button onClick={next}     disabled={snapshot.status !== "idle" || !snapshot.canMoveNext}>
        {snapshot.isLastStep ? "Finish" : "Next"}
      </button>
    </div>
  );
}
```

Check both `pathId` and `stepId` when rendering sub-path content to avoid ambiguity if step IDs are reused across paths:

```typescript
if (snapshot.pathId === "main-path" && snapshot.stepId === "summary") { ... }
```

---

## Single-step forms (`footerLayout="form"`)

A single-step `PathDefinition` turns Pathwrite into a conventional form engine. When `stepCount === 1` and `nestingLevel === 0`, the shell automatically:

1. Hides the progress indicator
2. Uses form-style footer layout (Cancel on left, Submit on right)
3. Blocks submission while any `fieldErrors` are non-empty
4. Hides errors until the user first attempts to submit (`hasAttemptedNext`)
5. Renders field errors with auto-generated labels (camelCase → Title Case)

```typescript
const contactForm: PathDefinition = {
  id: "contact-form",
  steps: [{
    id: "contact",
    title: "Contact Us",
    fieldErrors: ({ data }) => ({
      name:    !data.name?.trim()          ? "Name is required."             : undefined,
      email:   !data.email?.includes("@") ? "Valid email address required."  : undefined,
      message: !data.message?.trim()       ? "Message is required."           : undefined,
    })
  }]
};
```

```tsx
// React
<PathShell
  path={contactForm}
  initialData={{ name: "", email: "", message: "" }}
  onComplete={(data) => submitToBackend(data)}
  steps={{ contact: <ContactFormFields /> }}
/>
```

You can override the auto-detected layout when needed:

```tsx
<PathShell
  path={form}
  hideProgress={false}   // force show progress
  footerLayout="wizard"  // force wizard layout
/>
```

The `footerLayout` prop accepts `"wizard"`, `"form"`, or `"auto"` (default). `"auto"` selects `"form"` for single-step top-level paths and `"wizard"` otherwise.

### Validation timing with `hasAttemptedNext`

`snapshot.hasAttemptedNext` becomes `true` after the user calls `next()` at least once on the current step. Use it to suppress errors until the first submission attempt:

```tsx
{snapshot.hasAttemptedNext && snapshot.fieldErrors.email && (
  <span className="error">{snapshot.fieldErrors.email}</span>
)}
```

This prevents error messages appearing before the user has had a chance to fill in the form.
