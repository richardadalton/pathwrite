# Your First Path (React)

This tutorial builds a complete 3-step registration flow using `@daltonr/pathwrite-react`. By the end you will have a working wizard with validation, per-field error messages, and a completion handler — all wired up through `PathShell` and `usePathContext`.

## What you are building

Three steps:

1. **Name** — collects a first and last name, both required
2. **Contact** — collects an email address, validated for basic format
3. **Review** — shows a summary of the collected data before submission

## Step 1 — Install

```bash
npm install @daltonr/pathwrite-core @daltonr/pathwrite-react
```

Peer dependency: `react >= 18.0.0` must already be installed.

## Step 2 — Define the path

Create a file for your path definition. This is plain TypeScript — no React imports needed here.

```ts
// src/registrationPath.ts
import type { PathDefinition } from "@daltonr/pathwrite-core";

export interface RegistrationData {
  firstName: string;
  lastName: string;
  email: string;
}

export const registrationPath: PathDefinition<RegistrationData> = {
  id: "registration",
  title: "Create your account",
  steps: [
    {
      id: "name",
      title: "Your name",
      fieldErrors: ({ data }) => ({
        firstName: !data.firstName?.trim() ? "First name is required." : undefined,
        lastName:  !data.lastName?.trim()  ? "Last name is required."  : undefined,
      }),
    },
    {
      id: "contact",
      title: "Contact details",
      fieldErrors: ({ data }) => ({
        email: !String(data.email ?? "").includes("@")
          ? "A valid email address is required."
          : undefined,
      }),
    },
    {
      id: "review",
      title: "Review",
      // No fieldErrors — the user is just reviewing, not entering data.
    },
  ],
};
```

A few things to notice:

- `fieldErrors` returns a map of field ID to error message (or `undefined` when the field is valid). When any field has an error, `canMoveNext` is automatically `false` — you do not need to write a separate guard.
- The engine stores a single data object for the whole path. All three steps share the same `RegistrationData` shape.
- The `review` step has no hooks or guards. The user can always proceed from it.

## Step 3 — Write the step components

Each step component uses `usePathContext()` to read the current snapshot and call `setData`. The context is provided automatically by `PathShell` — no manual provider setup needed.

### NameStep

```tsx
// src/steps/NameStep.tsx
import { usePathContext } from "@daltonr/pathwrite-react";
import type { RegistrationData } from "../registrationPath";

export function NameStep() {
  const { snapshot, setData } = usePathContext<RegistrationData>();

  // snapshot is always non-null here — PathShell only renders this component
  // when the path is active and this step is current.
  const data = snapshot!.data;
  const errors = snapshot!.fieldErrors;

  return (
    <div>
      <div>
        <label htmlFor="firstName">First name</label>
        <input
          id="firstName"
          value={data.firstName ?? ""}
          onChange={(e) => setData("firstName", e.target.value)}
        />
        {errors.firstName && <p className="error">{errors.firstName}</p>}
      </div>

      <div>
        <label htmlFor="lastName">Last name</label>
        <input
          id="lastName"
          value={data.lastName ?? ""}
          onChange={(e) => setData("lastName", e.target.value)}
        />
        {errors.lastName && <p className="error">{errors.lastName}</p>}
      </div>
    </div>
  );
}
```

`snapshot.fieldErrors` contains only the errors for the *current* step as defined in your `PathDefinition`. Errors are gated by `hasAttemptedNext` in the default shell — they appear only after the user has clicked Next at least once. If you render errors inline yourself (as above), they appear as the user types; this is often the right behaviour for a form.

### ContactStep

```tsx
// src/steps/ContactStep.tsx
import { usePathContext } from "@daltonr/pathwrite-react";
import type { RegistrationData } from "../registrationPath";

export function ContactStep() {
  const { snapshot, setData } = usePathContext<RegistrationData>();

  const data = snapshot!.data;
  const errors = snapshot!.fieldErrors;

  return (
    <div>
      <label htmlFor="email">Email address</label>
      <input
        id="email"
        type="email"
        value={data.email ?? ""}
        onChange={(e) => setData("email", e.target.value)}
      />
      {errors.email && <p className="error">{errors.email}</p>}
    </div>
  );
}
```

### ReviewStep

```tsx
// src/steps/ReviewStep.tsx
import { usePathContext } from "@daltonr/pathwrite-react";
import type { RegistrationData } from "../registrationPath";

export function ReviewStep() {
  const { snapshot } = usePathContext<RegistrationData>();
  const data = snapshot!.data;

  return (
    <dl>
      <dt>First name</dt>
      <dd>{data.firstName}</dd>

      <dt>Last name</dt>
      <dd>{data.lastName}</dd>

      <dt>Email</dt>
      <dd>{data.email}</dd>
    </dl>
  );
}
```

## Step 4 — Assemble with PathShell

`PathShell` handles the progress indicator, navigation buttons, and error summary. You pass it the path definition, initial data, a completion handler, and the map of step ID to step component.

```tsx
// src/RegistrationWizard.tsx
import { PathShell } from "@daltonr/pathwrite-react";
import "@daltonr/pathwrite-react/styles.css";

import { registrationPath } from "./registrationPath";
import type { RegistrationData } from "./registrationPath";
import { NameStep }    from "./steps/NameStep";
import { ContactStep } from "./steps/ContactStep";
import { ReviewStep }  from "./steps/ReviewStep";

function handleComplete(data: RegistrationData) {
  console.log("Registration complete:", data);
  // Replace this with your actual submission logic —
  // an API call, a router.push("/success"), etc.
}

export function RegistrationWizard() {
  return (
    <PathShell
      path={registrationPath}
      initialData={{ firstName: "", lastName: "", email: "" }}
      onComplete={handleComplete}
      steps={{
        name:    <NameStep />,
        contact: <ContactStep />,
        review:  <ReviewStep />,
      }}
    />
  );
}
```

The keys of the `steps` map must match the `id` values in your `PathDefinition`. The shell renders `steps[snapshot.stepId]` for the current step and hides all others.

## Step 5 — Render it

Drop `RegistrationWizard` into your app's component tree wherever you want the wizard to appear:

```tsx
// src/App.tsx
import { RegistrationWizard } from "./RegistrationWizard";

export function App() {
  return (
    <main>
      <h1>Sign up</h1>
      <RegistrationWizard />
    </main>
  );
}
```

## How it works end to end

1. `PathShell` mounts and starts the engine with your `registrationPath` definition and `initialData`. The first step (`name`) becomes active.
2. The shell renders `steps["name"]`, which is `<NameStep />`. The engine context is provided to all step children automatically.
3. `NameStep` calls `usePathContext()` to read `snapshot.data` and `snapshot.fieldErrors`. As the user types, `setData()` updates the engine and triggers a snapshot update, which re-renders the component.
4. When the user clicks Next, the engine evaluates `fieldErrors` for the `name` step. If any field has an error, `canMoveNext` is `false` and the shell keeps the button disabled. Once all fields are valid, the engine advances to `contact`.
5. The same process repeats on the `contact` step. On the `review` step there are no guards, so the user can always proceed.
6. When the user clicks Complete on the last step, the engine calls `onComplete` with the final data object. Your `handleComplete` function receives `{ firstName, lastName, email }`.

## Optional — skip the default styles

`PathShell` works without the stylesheet, but it will be unstyled. The styles are all scoped to `--pw-*` CSS custom properties, so you can theme them without overriding selectors:

```css
:root {
  --pw-color-primary: #3b82f6;
  --pw-shell-radius: 8px;
}
```

See the Developer Guide for the full list of CSS variables.

## Optional — replace the shell entirely

Once you are ready for a fully custom UI, replace `PathShell` with your own component using the `usePath` hook directly:

```tsx
import { usePath } from "@daltonr/pathwrite-react";
import { registrationPath } from "./registrationPath";

export function RegistrationWizard() {
  const { snapshot, start, next, previous, setData } = usePath({
    onEvent(event) {
      if (event.type === "completed") {
        console.log("Done:", event.data);
      }
    },
  });

  if (!snapshot) {
    return <button onClick={() => start(registrationPath, { firstName: "", lastName: "", email: "" })}>Start</button>;
  }

  return (
    <div>
      {/* your own progress indicator */}
      <p>Step {snapshot.stepIndex + 1} of {snapshot.stepCount}: {snapshot.stepTitle}</p>

      {/* render the active step */}
      {snapshot.stepId === "name"    && <NameStep />}
      {snapshot.stepId === "contact" && <ContactStep />}
      {snapshot.stepId === "review"  && <ReviewStep />}

      {/* your own navigation */}
      <button onClick={previous} disabled={snapshot.status !== "idle" || !snapshot.canMovePrevious}>
        Back
      </button>
      <button onClick={next} disabled={snapshot.status !== "idle" || !snapshot.canMoveNext}>
        {snapshot.isLastStep ? "Complete" : "Next"}
      </button>
    </div>
  );
}
```

When using `usePath` directly, step children need access to the engine too. Wrap the wizard in a `PathProvider` and call `usePathContext()` in step components, or pass snapshot and setData down as props.

## Next steps

- **Core Concepts** — understand how `PathDefinition`, `PathEngine`, and `PathSnapshot` relate to each other
- **Developer Guide §6** — navigation guards (`canMoveNext`, `canMovePrevious`, `shouldSkip`) in depth
- **Developer Guide §9** — sub-paths for nested flows
- **Persistence Guide** — save and restore wizard state with `LocalStorageStore` or `HttpStore`

© 2026 Devjoy Ltd. MIT License.
