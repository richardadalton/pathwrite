# Pathwrite Feedback — Document Review Sample

**Package versions tested:** `@daltonr/pathwrite-react@0.1.5` / `@daltonr/pathwrite-core@0.1.5`  
**Framework:** React 18 + Vite (TypeScript)  
**Date:** March 2026

---

## Summary

Building a realistic 5-step document review workflow with `PathShell` and `usePathContext` worked well overall. The core engine is solid: navigation guards gate progression correctly, lifecycle hooks are clean, and the `useSyncExternalStore` integration means step components never re-render unnecessarily. There are, however, several friction points worth addressing.

---

## Issues Encountered

### 1. `PathShell` renders step elements eagerly, not lazily

**Severity: Minor**

`PathShell` accepts `steps` as `Record<string, ReactNode>`. The entire map is evaluated — and all step elements instantiated — when `<PathShell>` is first rendered, before the user reaches those steps.

In practice this is benign (steps are lightweight), but it means any side-effect inside a step component (e.g. a `useEffect` data fetch) fires on mount for *every* step simultaneously rather than only when that step becomes active. Accepting `Record<string, () => ReactNode>` (render functions / factory functions) instead would fix this at no API cost to users who don't care.

---

### 2. No way for a step component to know it is "entering" vs "returning"

**Severity: Minor**

`usePathContext` exposes the snapshot, but the snapshot has no flag indicating whether the user arrived at this step by going *forward* or *backward*. There is also no step-level "first visit" flag.

This makes it awkward to implement common UX patterns such as:
- Pre-filling fields only on first entry (not when the user navigates back)
- Playing an enter animation in the correct direction

The `onEnter` lifecycle hook on the *path definition* does receive this context, but that hook lives in the path definition (not the component), which means the UI component has to read indirect state to infer direction.

**Suggestion:** Add `direction: "forward" | "backward" | "initial"` to `PathSnapshot`, or expose it via a dedicated `useStepTransition()` hook.

---

### 3. `setData` generic type assertion is not enforced at runtime

**Severity: Info**

The README calls this out explicitly ("a type-level assertion, not a runtime guarantee"), so it is a documented limitation rather than a bug. It is still worth noting for users coming from stricter validation libraries: there is no Zod/Yup schema validation layer baked in.

For a production document review workflow you would need to wrap `setData` with your own validation, or validate in `canMoveNext` guards.

---

### 4. No built-in "dirty" / unsaved-changes guard

**Severity: Minor**

`PathShell`'s Cancel button immediately fires `engine.cancel()` with no confirmation prompt. If a user has filled in multiple fields and accidentally hits Cancel, all data is lost.

A `confirmCancel` prop accepting a `() => Promise<boolean>` (or a simple `confirmMessage: string`) would cover the common case without forcing users to reach for `renderFooter`.

---

### 5. `PathShell` `steps` prop has no fallback / unknown-step handling

**Severity: Minor**

If `snapshot.stepId` does not match any key in the `steps` map, `PathShell` renders `null` inside the body without any warning. During development this is easy to debug once you know what to look for, but a console warning ("No step content found for step ID: 'xyz'") would save time.

---

### 6. `hideCancel` hides Cancel but the Back button on step 1 still cancels

**Severity: Minor**

The Back button is hidden on the first step (correct), but this isn't documented explicitly. A user wanting to prevent accidental cancellation via Back on step 1 is already covered, but the relationship between "Back on step 1 = cancel" is not called out in the README.

---

### 7. `autoStart={false}` renders "No active path" with no context

**Severity: Info**

When `autoStart={false}`, the shell shows a plain "No active path." message plus a "Start" button. There is no prop to customise this idle state (e.g. to show a branded landing panel). Users who want a custom pre-start screen currently need to manage the start/idle state themselves outside of `PathShell`.

**Suggestion:** Add an `idleContent?: ReactNode` prop, or expose a `renderIdle` render prop analogous to `renderHeader` / `renderFooter`.

---

### 8. CSS import path requires `exports` map support

**Severity: Info**

The styles are imported as:

```ts
import "@daltonr/pathwrite-react/styles.css";
```

This relies on the `package.json` `exports` field (`"./styles.css": "./dist/index.css"`). This works correctly in Vite (which respects `exports`). Older toolchains (webpack 4, Jest without additional config) that do not resolve `exports` sub-paths will fail on this import. A note in the README about toolchain requirements would be helpful.

---

### 9. Terminal / tooling: Python heredoc caused shell to hang

**Severity: Tooling (not package)**

This is not a package issue — it is a note for this feedback document. When creating files using multi-line shell heredocs in the embedded terminal, the shell entered an unrecoverable heredoc-waiting state. Files had to be created using the IDE's file-creation tool instead. No impact on the runtime app, but worth flagging for reproducibility of this walkthrough.

---

## What Works Well

- **Zero-config `PathShell`** — dropping `<PathShell path={...} steps={{...}} />` into an existing React app takes under five minutes. The default styling is clean and production-usable.
- **`usePathContext()` inside step components** — accessing and updating path data from deep inside a step component with a single hook call is ergonomic. No prop drilling.
- **`canMoveNext` guards** — binding the Next button's disabled state to the engine via snapshot flags (`snapshot.canMoveNext`) is clean and reactive. Fields update the flag as the user types.
- **Referentially stable callbacks** — `next`, `previous`, `setData` etc. are stable across renders, so they are safe in `useCallback` dependency arrays and as event handlers without triggering unwanted re-renders.
- **TypeScript generics** — `usePath<ReviewData>()` and `usePathContext<ReviewData>()` provide full type safety on `snapshot.data` and enforce correct key/value pairs in `setData`.
- **`onLeave` data trimming** — returning a partial patch from `onLeave` to normalise data (e.g. `.trim()`) is a clean pattern that keeps step components free of cleanup logic.
- **Sub-path API** — `startSubPath` / `onSubPathComplete` is a well-thought-out primitive for nested flows (e.g. "add another item" sub-workflows). Not used in this sample but the API is clear.
- **Zero dependencies in core** — `@daltonr/pathwrite-core` has no runtime dependencies, which keeps bundle size minimal.

---

### 9. `PathDefinition<TData>` is not assignable to `PathDefinition<PathData>` — cast required

**Severity: Minor**

`PathShell` declares `path: PathDefinition` (i.e. `PathDefinition<PathData>`). When you define a typed path as `PathDefinition<ReviewData>`, TypeScript rejects the assignment because `PathStep<TData>` is contravariant in `TData` through its guard/hook callbacks.

This means consuming code must cast:

```tsx
path={documentReviewPath as unknown as PathDefinition}
```

The double cast (`as unknown as PathDefinition`) is unsatisfying. Since `PathShell` is the primary entry point for 80% of users, making the `path` prop accept `PathDefinition<any>` (or a `PathDefinition<TData>` generic on `PathShell` itself) would eliminate this friction entirely. The cast is a safe no-op at runtime since the engine handles the type internally, but it is noise that users have to discover for themselves.

---

## Suggestions Summary

| # | Area | Suggestion |
|---|------|-----------|
| 1 | `PathShell` | Accept `() => ReactNode` factories in `steps` for lazy rendering |
| 2 | `PathSnapshot` | Add `direction` field or `useStepTransition()` hook |
| 3 | Data validation | Document recommended pattern for runtime validation (e.g. with Zod) |
| 4 | `PathShell` | Add `confirmCancel` / `confirmMessage` prop |
| 5 | `PathShell` | Warn in dev when a step ID has no matching content |
| 6 | README | Clarify "Back on first step = cancel" behaviour |
| 7 | `PathShell` | Add `idleContent` or `renderIdle` prop for custom pre-start UI |
| 8 | README | Document CSS import toolchain requirements |
| 9 | `PathShell` | Make `path` prop accept `PathDefinition<any>` to eliminate the forced double-cast |

