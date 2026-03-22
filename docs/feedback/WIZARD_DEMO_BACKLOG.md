# Wizard Demo Backlog

Consolidated from feedback recorded across all four wizard demos:
`demo-angular-wizard`, `demo-react-wizard`, `demo-vue-wizard`, `demo-svelte-wizard` (v0.6.2).

Each item notes which demos raised it and where the change would live.

---

## Priority 1 — Raised by all four demos

### 1.1 `validationDisplay` prop on PathShell

**Problem:**
When `fieldMessages` is defined on a step and the developer also renders inline per-field
errors in the step template, the shell's auto-generated summary list (`.pw-shell__validation`)
duplicates every error. The only way to suppress it is to add a CSS override:

```css
.pw-shell__validation { display: none; }
```

This is not discoverable. Every developer who implements inline field-level errors will
encounter the duplicate on first use, then have to find and apply the CSS workaround. In the
Angular wizard, this caused a bug that required a separate commit to fix after the demo was
otherwise complete.

**Raised by:** Angular · React · Vue · Svelte

**Proposed change:**
Add a `validationDisplay` prop to all four `PathShell` components:

```html
<!-- Angular -->
<pw-shell validationDisplay="inline">

<!-- React -->
<PathShell validationDisplay="inline" />

<!-- Vue -->
<PathShell validation-display="inline" />

<!-- Svelte -->
<PathShell validationDisplay="inline" />
```

| Value | Behaviour |
|-------|-----------|
| `"summary"` | Show the shell's auto-generated summary box (current default behaviour) |
| `"inline"` | Suppress the summary box — developer handles errors in the step template |
| `"both"` | Show both summary and whatever the step template renders |

Default should remain `"summary"` for backward compatibility.

**Where:** All four adapter `PathShell` components

---

### 1.2 `snapshot.data` returns `unknown` for every field — typed accessor needed

**Problem:**
`PathData = Record<string, unknown>` means all field access on `snapshot.data` returns
`unknown`, forcing type casts in every step component. The friction varies by framework:

- **Angular:** Template expressions don't support `as` syntax — `s.data.experience as string`
  is a compile error. Workaround: bracket notation + `unknown` method params.
- **React:** Less painful in TSX but still requires `data.firstName as string` or a
  fallback cast (`snapshot?.data ?? {} as OnboardingData`).
- **Vue:** Bracket notation required (`:value="snapshot.data['firstName']"`), noisy in templates.
- **Svelte:** `as string` casts work in `{expressions}` but add visual noise.

**Raised by:** Angular (explicitly) · Vue (explicitly) · React (implicitly) · Svelte (implicitly)

**Proposed change:**
Investigate adding a typed accessor to `PathSnapshot<TData>`:

```typescript
snapshot.data.experience         // unknown (existing — backward compatible)
snapshot.typedData.experience    // string (narrowed via TData generic)
```

Alternatively, change `snapshot.data` to return `TData` directly when a generic is provided.
This would be a breaking change but would eliminate casts across all four frameworks.

**Where:** `packages/core` (`PathSnapshot` type definition)

---

## Priority 2 — Raised by multiple demos

### 2.1 Angular: back-navigation requires manual state restoration in every step

**Problem:**
When a user navigates back to a previous step, Angular destroys and recreates the step
component. Any local component state (field values bound to `[value]="..."`) resets. The
developer must explicitly restore from the snapshot in `ngOnInit`:

```typescript
ngOnInit(): void {
  const data = this.path.snapshot()?.data;
  if (data) {
    this.firstName = (data.firstName as string) ?? "";
    this.email     = (data.email     as string) ?? "";
  }
}
```

This pattern is required in every step component of every multi-step wizard. It is not
documented, and the bug is silent — the engine data is preserved but the UI shows blank fields.

React, Vue, and Svelte do not have this problem because their step components read directly
from the reactive context/snapshot rather than syncing to local state.

**Raised by:** Angular (directly) · React, Vue, Svelte (all noted the contrast as an advantage)

**Proposed change (option A — docs):**
Add a "Restoring step state on back-navigation" section to the Angular developer guide with
the `ngOnInit` pattern as the recommended approach.

**Proposed change (option B — API):**
Add a `useStepData()` helper to the Angular adapter that returns a `WritableSignal` pre-seeded
from `snapshot.data`:

```typescript
protected readonly firstName = useStepData<OnboardingData, 'firstName'>('firstName', '');
// Returns a WritableSignal seeded from snapshot.data.firstName — no ngOnInit needed
```

**Where:** `packages/angular-adapter` + Developer Guide

---

### 2.2 Svelte: hyphenated step IDs are incompatible with component props

**Problem:**
Svelte 5 requires component props to be valid JavaScript identifiers. Hyphens are not
permitted. This forces Svelte to use camelCase step IDs (`personalInfo`, `aboutYou`) while
Angular, React, and Vue use kebab-case (`personal-info`, `about-you`).

The path definitions are not interchangeable across frameworks, which undermines the
"same core, different adapters" story — the core selling point of Pathwrite.

**Raised by:** Svelte (directly)

**Proposed change:**
Add a `steps` prop to the Svelte `PathShell` as an alternative to individual component props:

```svelte
<PathShell
  path={onboardingPath}
  steps={{ "personal-info": PersonalInfoStep, "about-you": AboutYouStep }}
/>
```

This matches React's `steps` record pattern and removes the identifier constraint entirely.
The existing prop-per-step pattern would continue to work for camelCase IDs.

**Where:** `packages/svelte-adapter/src/PathShell.svelte`

---

### 2.3 `useStepData<T>()` hook / helper to eliminate null-check boilerplate

**Problem:**
`snapshot` can be `null` before the engine starts. Every step component must handle this:

```tsx
// React
const data = snapshot?.data ?? {} as OnboardingData;

// Vue
v-if="snapshot"

// Angular
const data = this.path.snapshot()?.data;
if (data) { ... }
```

This is one line per step but consistently required across all four frameworks.

**Raised by:** React (explicitly) · Angular (implicitly, via the ngOnInit pattern)

**Proposed change:**
A framework-specific helper that always returns a typed data object:

```tsx
// React
const data = useStepData<OnboardingData>();
// Returns OnboardingData — never null, falls back to empty record

// Angular
protected readonly data = useStepData<OnboardingData>();
// Returns Signal<OnboardingData> — pre-seeded from snapshot
```

**Where:** Each adapter package

---

## Priority 3 — Smaller scope / documentation

### 3.1 Document `fieldMessages` auto-deriving `canMoveNext`

**Problem:**
When `fieldMessages` is defined without an explicit `canMoveNext`, the engine auto-derives
`canMoveNext` as `true` when all messages are `undefined`. This is elegant but not obvious.
A developer might define `fieldMessages` expecting the shell to show errors, not realising
that the guard is also being derived and will block navigation.

**Raised by:** Angular

**Proposed change:**
Add a clear callout to the `fieldMessages` API docs:

> **Auto-derived guard:** When `fieldMessages` is defined and `canMoveNext` is not, the engine
> automatically blocks navigation when any field message is non-empty. You only need an explicit
> `canMoveNext` if your guard logic differs from "all fields valid".

**Where:** Core API docs + Developer Guide

---

### 3.2 Document `string & keyof TData` pattern for Angular

**Problem:**
Passing `field: keyof OnboardingData` to `setData()` produces a TypeScript error because
`keyof` includes `number | symbol`. The fix — `field: string & keyof OnboardingData` — is
correct but non-obvious.

**Raised by:** Angular

**Proposed change:**
Add the `string & keyof TData` pattern to the Angular developer guide as the idiomatic way
to write reusable data-update methods in step components.

**Where:** Developer Guide (Angular section)

---

### 3.3 Document React lazy step evaluation pattern

**Problem:**
React's `steps` prop evaluates all step JSX eagerly when `<PathShell>` renders. For lightweight
components this is negligible, but for heavy components with expensive renders it could matter.

**Raised by:** React

**Proposed change:**
Document a lazy-evaluation pattern (wrapping step content in a function: `() => <HeavyStep />`)
if the `PathShell` supports or plans to support it. If not, note the eager evaluation as a
known characteristic.

**Where:** React adapter README + Developer Guide

---

### 3.4 Cross-adapter event naming documentation

**Problem:**
The completion/cancellation callback naming differs across frameworks:

| Framework | Complete | Cancel |
|-----------|----------|--------|
| Angular | `(completed)` | `(cancelled)` |
| React | `onComplete` | `onCancel` |
| Vue | `@complete` | `@cancel` |
| Svelte | `oncomplete` | `oncancel` |

Each follows its framework's idiomatic convention, which is correct. But developers moving
between frameworks or comparing demos side-by-side may find the inconsistency confusing.

**Raised by:** Vue

**Proposed change:**
Add a cross-adapter comparison table to the Developer Guide showing the equivalent API for
each framework, covering shell props, events, and context access patterns.

**Where:** Developer Guide

---

## Not actionable — positive observations

These items are not bugs or feature requests but were called out as strengths across the
wizard demos. They confirm that the current architecture is working well.

| Observation | Raised by |
|-------------|-----------|
| `injectPath()` is a major Angular DX improvement | Angular |
| Core vs Adapter separation is natural and compelling | Angular |
| `pw-shell` inputs cover all common cases out of the box | Angular |
| No back-navigation boilerplate needed (reactive binding) | React · Vue · Svelte |
| `usePathContext()` is the cleanest engine access API | React |
| Named slots are the most readable step-wiring pattern | Vue |
| `usePathContext()` composable fits naturally in `<script setup>` | Vue |
| `$derived` for errors is the most concise reactive pattern | Svelte |
| `{@const}` enables clean data aliasing in templates | Svelte |
| All four frameworks built cleanly with no runtime errors | React · Vue · Svelte |

---

## Summary

| # | Item | Impact | Scope | Demos |
|---|------|--------|-------|-------|
| 1.1 | `validationDisplay` prop on PathShell | Medium | All 4 shells | All 4 |
| 1.2 | Typed `snapshot.data` accessor | Medium | core | All 4 |
| 2.1 | Angular back-nav state restore (docs + optional helper) | High (Angular) | angular-adapter + docs | Angular |
| 2.2 | Svelte `steps` record prop for hyphenated IDs | High (Svelte) | svelte-adapter | Svelte |
| 2.3 | `useStepData<T>()` helper to eliminate null checks | Low | All 4 adapters | React · Angular |
| 3.1 | Document `fieldMessages` auto-deriving `canMoveNext` | Low | docs | Angular |
| 3.2 | Document `string & keyof TData` Angular pattern | Low | docs | Angular |
| 3.3 | Document React lazy step evaluation | Low | docs | React |
| 3.4 | Cross-adapter event naming comparison table | Low | docs | Vue |

