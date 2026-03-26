# demo-angular-wizard

**Recipe 2 — Linear Onboarding Wizard**

A 4-step linear wizard built with Pathwrite and the Angular adapter. Demonstrates
guards, per-field validation, back-navigation with state preservation, and a final
review step before completion.

## Steps

| # | Step | Key concepts |
|---|------|-------------|
| 1 | **Personal Info** | `fieldErrors` auto-derives `canMoveNext`; errors shown only after first Next attempt |
| 2 | **About You** | Explicit `canMoveNext` guard + `fieldErrors` together; optional field (Company) |
| 3 | **Preferences** | No guard — all fields have defaults; radio buttons + toggle |
| 4 | **Review** | Read-only summary; navigating back from here preserves all data |

## Core vs Adapter

- **Core** (`onboarding.path.ts`) — pure TypeScript, zero Angular imports. Guards,
  validation, and step definitions live here. Can be tested in isolation or reused
  across frameworks.
- **Adapter** — `pw-shell` wires up the progress bar, Next/Previous/Cancel buttons,
  and step rendering. Each step component uses `injectPath()` for signal-based access.

## Running locally

```bash
npm install
npm start
```

Open [http://localhost:4200](http://localhost:4200).

