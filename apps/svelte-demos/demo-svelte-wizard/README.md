# demo-svelte-wizard

**Recipe 2 — Linear Onboarding Wizard**

A 4-step linear wizard built with Pathwrite and the Svelte 5 adapter. Demonstrates
guards, per-field validation, and a final review step before completion.

## Steps

| # | Step | Key concepts |
|---|------|-------------|
| 1 | **Personal Info** | `fieldErrors` auto-derives `canMoveNext`; errors shown only after first Next attempt |
| 2 | **About You** | Explicit `canMoveNext` guard + `fieldErrors` together; optional field (Company) |
| 3 | **Preferences** | No guard — all fields have defaults; radio buttons + toggle |
| 4 | **Review** | Read-only summary using `{@const d = ctx.snapshot.data}` for clean access |

## Core vs Adapter

- **Core** (`onboarding.ts`) — pure TypeScript, zero Svelte imports. Path definition,
  guards, validation, and shared types all live here. Identical logic to the Angular,
  React, and Vue wizard demos.
- **Adapter** — `<PathShell>` receives step components as props. Each step uses
  `getPathContext()` for runes-based reactive engine access.

## Step ID note

Step IDs use **camelCase** (`personalInfo`, `aboutYou`) instead of kebab-case because
Svelte component props must be valid JavaScript identifiers. Hyphens are not permitted
in prop names, so `personal-info={PersonalInfoStep}` is a syntax error in Svelte.

## Project structure

```
src/
├── main.ts                  – mounts Svelte app, imports shell CSS
├── App.svelte               – $state flags, PathShell with component props
├── onboarding.ts            – PathDefinition, OnboardingData type, shared labels
├── PersonalInfoStep.svelte  – Step 1: name + email
├── AboutYouStep.svelte      – Step 2: job title + experience
├── PreferencesStep.svelte   – Step 3: theme radios + notifications toggle
├── ReviewStep.svelte        – Step 4: read-only summary
└── style.css                – page + shell override + step styles
```

## Key patterns

### PathShell with component props

```svelte
<PathShell
  path={onboardingPath}
  initialData={INITIAL_DATA}
  completeLabel="Complete Onboarding"
  cancelLabel="Cancel"
  oncomplete={handleComplete}
  oncancel={handleCancel}
  personalInfo={PersonalInfoStep}
  aboutYou={AboutYouStep}
  preferences={PreferencesStep}
  review={ReviewStep}
/>
```

### Accessing engine state inside a step

```svelte
<script lang="ts">
  import { getPathContext } from "@daltonr/pathwrite-svelte";

  const ctx = getPathContext<OnboardingData>();
  let errors = $derived(
    ctx.snapshot?.hasAttemptedNext ? (ctx.snapshot.fieldErrors ?? {}) : {}
  );
</script>

<input value={ctx.snapshot?.data.firstName ?? ""}
       oninput={(e) => ctx.setData("firstName", e.currentTarget.value.trim())} />
```

`getPathContext()` returns a reactive runes-based object. `$derived` re-evaluates
automatically whenever the snapshot changes — no manual subscriptions needed.

## Running locally

```bash
npm install
npm start
```

Open [http://localhost:5173](http://localhost:5173).

