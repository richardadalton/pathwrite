# demo-react-wizard

**Recipe 2 — Linear Onboarding Wizard**

A 4-step linear wizard built with Pathwrite and the React adapter. Demonstrates
guards, per-field validation, and a final review step before completion.

## Steps

| # | Step | Key concepts |
|---|------|-------------|
| 1 | **Personal Info** | `fieldErrors` auto-derives `canMoveNext`; errors shown only after first Next attempt |
| 2 | **About You** | Explicit `canMoveNext` guard + `fieldErrors` together; optional field (Company) |
| 3 | **Preferences** | No guard — all fields have defaults; radio buttons + toggle |
| 4 | **Review** | Read-only summary of all collected data |

## Core vs Adapter

- **Core** (`onboarding.ts`) — pure TypeScript, zero React imports. Path definition,
  guards, validation, and shared types all live here. Identical logic to the Angular,
  Vue, and Svelte wizard demos.
- **Adapter** — `<PathShell>` handles the progress bar, Next/Previous/Cancel buttons,
  and step rendering via the `steps` prop. Each step calls `usePathContext()` for
  typed, hook-based engine access.

## Project structure

```
src/
├── main.tsx              – mounts React app, imports shell CSS
├── App.tsx               – page state, renders PathShell with steps map
├── onboarding.ts         – PathDefinition, OnboardingData type, shared labels
├── PersonalInfoStep.tsx  – Step 1: name + email, fieldErrors only
├── AboutYouStep.tsx      – Step 2: job title + experience, guard + fieldErrors
├── PreferencesStep.tsx   – Step 3: theme radios + notifications toggle
├── ReviewStep.tsx        – Step 4: read-only summary
└── style.css             – page + shell override + step styles
```

## Key patterns

### PathShell with a steps map

```tsx
<PathShell
  path={onboardingPath}
  initialData={INITIAL_DATA}
  completeLabel="Complete Onboarding"
  cancelLabel="Cancel"
  onComplete={handleComplete}
  onCancel={handleCancel}
  steps={{
    "personal-info": <PersonalInfoStep />,
    "about-you":     <AboutYouStep />,
    "preferences":   <PreferencesStep />,
    "review":        <ReviewStep />,
  }}
/>
```

### Accessing engine state inside a step

```tsx
function PersonalInfoStep() {
  const { snapshot, setData } = usePathContext<OnboardingData>();
  const data   = snapshot?.data ?? {} as OnboardingData;
  const errors = snapshot?.hasAttemptedNext ? (snapshot.fieldErrors ?? {}) : {};

  return (
    <input
      value={data.firstName ?? ""}
      onChange={e => setData("firstName", e.target.value.trim())}
    />
  );
}
```

`usePathContext()` provides full typed engine access with no prop drilling.
Data from previous steps is always available in `snapshot.data` — no back-navigation
restore boilerplate needed, as React re-renders with live context on every step change.

## Running locally

```bash
npm install
npm start
```

Open [http://localhost:5173](http://localhost:5173).

