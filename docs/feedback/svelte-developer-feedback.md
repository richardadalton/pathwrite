# Svelte Developer Feedback — Building the Onboarding Demo

**Date:** March 22, 2026  
**Context:** Built `demo-svelte-onboarding` — a 4-step onboarding wizard using `@daltonr/pathwrite-svelte`, `@daltonr/pathwrite-store-http`, and the `PathShell` component. This document records every friction point, learning curve issue, and idiomatic concern encountered during the process, written from the perspective of a Svelte developer picking up Pathwrite for the first time.

---

## 🔴 Bugs / Blockers

### 1. `PathShell` was not exported from the package

**Severity:** Critical  
**What happened:** `import { PathShell } from '@daltonr/pathwrite-svelte'` threw a "No matching export" error at runtime. The `PathShell.svelte` component existed in `src/` but was never re-exported from `src/index.ts`.

**Fix applied:** Added `export { default as PathShell } from "./PathShell.svelte"` to the end of `index.ts`.

**What a Svelte developer expects:** If the README says `import { PathShell } from '@daltonr/pathwrite-svelte'`, it should work. This would be a hard blocker for any new adopter.

---

### 2. Dynamic slot names are not supported in Svelte

**Severity:** Critical  
**What happened:** `PathShell.svelte` used `<slot name={snap.stepId}>` to render the current step's content. Svelte simply does not support dynamic slot names — the compiler rejects it with "slot name cannot be dynamic".

**Fix applied:** Changed `PathShell` to accept a `steps` prop — a `Record<string, ComponentType>` map — and renders the current step using `<svelte:component this={steps[snap.stepId]} />`.

**Impact:** This is a fundamental API change for the Svelte adapter. It means the usage pattern is completely different from Vue and React:

```svelte
<!-- What you'd write in Vue (slots): -->
<PathShell :path="path">
  <template #personal><PersonalStep /></template>
</PathShell>

<!-- What you must write in Svelte (component map): -->
<PathShell {engine} steps={{ personal: PersonalStep, preferences: PreferencesStep }} />
```

This works, but it's a surprising divergence. See the "Idiomatic Svelte" section for thoughts on a better solution.

---

### 3. `getPathContext()` vs `getContext('pathContext')` — silent failure

**Severity:** High  
**What happened:** Step components called `getContext('pathContext')` (a plain string key, copied from an earlier version of the API). `PathShell` sets context using `setPathContext()`, which uses a `Symbol` key internally. The context lookup returned `undefined`, and destructuring it threw a runtime error that only appeared after the component mounted.

**Fix applied:** Changed all step components to use `import { getPathContext } from '@daltonr/pathwrite-svelte'`.

**What made this hard to diagnose:** There was no warning at import time, no TypeScript error — it failed silently as `undefined` until the component tried to destructure it. The error message ("Cannot destructure property 'snapshot' of `getContext(...)` as it is undefined") did not point to the real cause.

**Suggestion:** `getPathContext()` already throws a helpful error if called outside a PathShell — that's good. But the export should be more prominent in the README with a clear "step components must use `getPathContext()`" callout, not buried in JSDoc.

---

### 4. `createPersistedEngine` no longer exists

**Severity:** High  
**What happened:** Both the Svelte demo (being written) and the existing Vue demo imported `createPersistedEngine` from `@daltonr/pathwrite-store-http`. This function has been replaced by `restoreOrStart` + `httpPersistence`, but:
- The Vue demo still used the old API
- No deprecation warning, no re-export stub
- The only indication it was gone was a runtime "No matching export" error

**Fix applied:** Updated both demos to use the new API pattern.

**Note:** This is covered in more depth in `storage-feedback.md`. Worth flagging here because a Svelte developer starting fresh from the README would hit this immediately.

---

### 5. Build script silently failed when `dist/` did not exist

**Severity:** Medium  
**What happened:** The `npm run build` script in `svelte-adapter` is:
```
tsc -p tsconfig.json && cp ../shell.css dist/index.css && cp src/PathShell.svelte dist/PathShell.svelte
```
When `tsc` ran for the first time after a clean checkout (no prior `dist/`), it created the folder fine. But on subsequent runs where a stale `tsconfig.tsbuildinfo` existed, `tsc` did nothing (incremental build detected no changes) and the `cp` then failed because `dist/` had been manually deleted. The error message was `cp: dist/index.css: No such file or directory` — not obvious.

**Fix suggestion:** Change the build script to `mkdir -p dist && tsc ...` to make it resilient to missing dist folder.

---

## 🟡 Learning Curve Issues

### 1. The initialisation pattern is more complex than expected

Setting up a persisted wizard requires three separate imports and a fairly verbose construction:

```javascript
import { HttpStore, restoreOrStart, httpPersistence } from '@daltonr/pathwrite-store-http';

const store = new HttpStore({ baseUrl: '...' });
const key = 'user:onboarding';

const { engine, restored } = await restoreOrStart({
  store,
  key,
  path: myWizard,
  initialData,
  observers: [
    httpPersistence({ store, key, strategy: 'onNext' })
  ]
});
```

Compare this to the equivalent in a typical Svelte library like SvelteKit's form actions, where persistence is handled by the framework with almost no boilerplate. The pattern is explicit and composable, which is good, but the barrier to "getting something working" is higher than it needs to be.

**Suggestion:** A convenience wrapper specifically for the common case — one import, one call — would dramatically reduce the time-to-first-working-demo:

```javascript
// Hypothetical simpler API:
const { engine, restored } = await usePersistedPath({
  url: 'http://localhost:3001/api/wizard',
  key: 'user:onboarding',
  path: myWizard,
  initialData,
  strategy: 'onNext'
});
```

The current composable pattern is the right foundation — it just needs a convenience layer on top.

---

### 2. The `steps` prop pattern needs a dedicated example in the README

The Vue README shows named slot usage. The Svelte README (before the demo was built) showed the now-impossible `<svelte:fragment slot="...">` pattern. A new Svelte developer would follow that example, hit the dynamic slot error, and have no obvious path forward.

The `steps` prop pattern needs:
- A clear example in the README
- An explanation of *why* it's different from Vue/React (dynamic slots aren't a Svelte feature)
- A note that step components access data via `getPathContext()`, not props

---

### 3. The relationship between `engine`, `path`, and `PathShell` props is not immediately clear

`PathShell` accepts both a `path` prop (for self-managed engines) and an `engine` prop (for externally managed engines). These are mutually exclusive, but there's nothing in the TypeScript types or runtime behaviour to enforce that or guide you toward the right choice.

When should you pass `path` vs `engine`? The answer ("pass `engine` when you need persistence, pass `path` for simple cases") is important but buried. A Svelte developer will likely try `path` first, get it working, then wonder how to add persistence — and discover they need to switch to `engine` and redo the setup.

**Suggestion:** Consider making this distinction explicit in the README as a "simple vs persisted" section, or use TypeScript overloads to make the two modes mutually exclusive at the type level.

---

## 🟢 What Felt Good

### 1. `$snapshot` is natural Svelte

The reactive `snapshot` store works exactly as a Svelte developer would expect. `$snapshot` in templates, reactive declarations with `$: data = $snapshot?.data || {}` — it's idiomatic and requires no explanation. This is the best-feeling part of the adapter.

### 2. `on:complete` event dispatch is correct Svelte idiom

`PathShell` dispatching `on:complete` and `on:cancel` as Svelte events (rather than callback props like React) is the right call. It composes naturally with Svelte's event system.

### 3. `setData` in step components is clean

Calling `setData('name', value)` from within a step component is simple and explicit. There's no mutation of shared state, no confusing two-way binding across component boundaries — it's clear that data flows through the engine.

### 4. The progress indicator and navigation buttons work out of the box

`PathShell` delivering a styled, accessible progress bar and Next/Previous/Complete buttons without any configuration is genuinely useful. Svelte developers building a quick prototype can be productive immediately.

---

## 💡 Idiomatic Svelte — Broader Thoughts

### The `steps` prop vs slots

The current `steps` prop approach works, but it isn't idiomatic Svelte. Svelte developers think in terms of slots and composition, not component maps. Passing a dictionary of component constructors feels more like a React pattern than a Svelte one.

The real fix here is **Svelte 5 snippets**. Svelte 5 replaces slots with `{#snippet}` blocks, which *can* be passed as props and rendered dynamically:

```svelte
<!-- Svelte 5 — possible future API: -->
<PathShell {engine} on:complete={handleComplete}>
  {#snippet personal()}
    <PersonalStep />
  {/snippet}
  {#snippet preferences()}
    <PreferencesStep />
  {/snippet}
</PathShell>
```

This would be idiomatic, composable, and avoid the component-map pattern entirely. The adapter should plan to migrate to snippets as Svelte 5 adoption grows.

### Context vs props for step data

The `getPathContext()` approach (using Svelte's context API) is reasonable for deeply nested components. However, for shallow step components that are direct children of `PathShell`, passing data as props via `<svelte:component this={Step} {snapshot} {setData} />` would be more explicit and easier to test. 

Worth considering a hybrid: PathShell passes `snapshot` and `setData` as props to step components when using the `steps` map, as a simpler alternative to context for users who prefer it.

### The CSS variable theming is excellent

The `--pw-*` custom property system is framework-agnostic and works perfectly in Svelte. Theming is trivial. This approach is better than scoped component styles for a design system that needs to be consistent across frameworks.

---

## 📋 Summary of Requested Changes

| Priority | Change | Reason |
|----------|--------|--------|
| ✅ Done | Export `PathShell` from package index by default | Fixed — added re-export to `index.ts` |
| ✅ Done | Update README to show snippet syntax | Fixed — main README shows Svelte 5 `{#snippet}` usage |
| ✅ Done | Prominent callout for `getPathContext()` in README | Fixed — dedicated ⚠️ section with ✅/❌ examples |
| ✅ Done | Fix build script to `mkdir -p dist && tsc ...` | Fixed — build script now creates dist/ first |
| 🟡 High | Add a convenience wrapper for the common persisted case | Reduces boilerplate significantly |
| ✅ Done | "Simple vs persisted" section in README | Fixed — dedicated section with examples for both modes |
| ✅ Done | Migrate to Svelte 5 snippets for step composition | Implemented — `{#snippet stepId()}` replaces `steps` prop |
| ✅ Done | Update demos to use `restoreOrStart` + `httpPersistence` | Fixed — both Svelte and Vue demos updated |
| 🟢 Future | Option to receive `snapshot`/`setData` as props in step components | Alternative to context for simpler cases |






