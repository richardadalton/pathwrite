# Pathwrite Package Feedback

Feedback based on building a six-step document review workflow.
Testing was done across two versions:

- **v0.1.1** — `@daltonr/pathwrite-react` + `@daltonr/pathwrite-core` (first attempt)
- **v0.1.2** — `@daltonr/pathwrite-react` only (v0.1.2 bundles core as a dependency)

---

## Fixed in v0.1.2 ✅

### 1. `PathShell` now shares context with step components

In v0.1.1, `PathShell` did not wrap step content in a `PathContext.Provider`,
so step components could not call `usePathContext()`. This made `PathShell`
unusable for any real data-driven workflow and forced a full custom shell
to be written from scratch.

In v0.1.2, `PathShell` wraps everything in `PathContext.Provider`, so
`usePathContext()` works correctly inside step components. This was the single
most impactful fix.

### 2. `canMoveNext` / `canMovePrevious` now exposed on the snapshot

In v0.1.1, guard results were not surfaced on the snapshot, so the Next button
could not be reactively disabled. In v0.1.2 both `snapshot.canMoveNext` and
`snapshot.canMovePrevious` are available and the default `PathShell` footer
uses them correctly. Guards now give immediate visual feedback with no extra
code from the consumer.

---

## Breaking change in v0.1.2 — `PathStep` removed, `steps` object prop added

In v0.1.1 the API used `<PathStep>` children inside `<PathShell>`:

```jsx
<PathShell path={myPath}>
  <PathStep id="details"><DetailsForm /></PathStep>
  <PathStep id="review"><ReviewPanel /></PathStep>
</PathShell>
```

In v0.1.2, `PathStep` is **not exported**. `PathShell` now accepts a `steps`
prop — a plain object mapping step ID to JSX:

```jsx
<PathShell
  path={myPath}
  steps={{
    details: <DetailsForm />,
    review: <ReviewPanel />,
  }}
/>
```

The new API is cleaner and easier to work with. However:

- The `PathStep` type still appears in `index.d.ts`, but the component is never
  exported from `index.js` — this will cause a runtime `undefined` component
  error if a consumer follows the old README examples or the type declarations.
- The README still shows the old `<PathStep>` syntax. It needs updating to
  match the v0.1.2 `steps` object prop.

---

## Remaining Issues

### 3. 🔴 `PathShell` ships with no CSS — consumers must style all `pw-shell__*` classes themselves

The package distributes only `dist/index.js` and `dist/index.d.ts`. There is
no bundled stylesheet. `PathShell` renders a full component tree of `pw-shell__*`
class names that are **completely unstyled** out of the box:

```
pw-shell
pw-shell__header
pw-shell__steps / pw-shell__step / pw-shell__step-dot / pw-shell__step-label
pw-shell__step--current / pw-shell__step--completed / pw-shell__step--upcoming
pw-shell__track / pw-shell__track-fill
pw-shell__body
pw-shell__footer / pw-shell__footer-left / pw-shell__footer-right
pw-shell__btn / pw-shell__btn--back / pw-shell__btn--cancel / pw-shell__btn--next
pw-shell__empty / pw-shell__start-btn
```

This means the shell renders as an unstyled block — no visible buttons, no
progress indicator, no layout. A consumer cannot tell if the library is working
at all until they have written ~150 lines of CSS for classes they shouldn't
have to know about.

This was the first problem encountered, before any logic issues surfaced. It
creates a very poor first-run experience.

#### Workaround used in this project

All `pw-shell__*` styles were written manually in `workflow.css` with a comment
marking them as a workaround. This should not be required of the consumer.

#### Suggested fix

Bundle a default stylesheet and document a single import line:

```
dist/
  index.js
  index.d.ts
  index.css      ← add this
```

```js
// Consumer adds one line:
import "@daltonr/pathwrite-react/dist/index.css";
```

Alternatively, inject a `<style>` tag at runtime. Either approach eliminates
the blank-screen problem on first use and is the standard approach taken by
component libraries (React Select, React DatePicker, etc.).

---

### 4. README still shows old `<PathStep>` API (stale after v0.1.2)

The README `PathShell` example still uses `<PathStep>` children, which no
longer works. A new user following the docs will immediately see:

> Element type is invalid: expected a string (for built-in components)
> or a class/function but got: undefined.

The README must be updated to show the `steps` object prop.

---

### 5. README table formatting is broken

The markdown tables (usePath API, lifecycle hooks, events) are missing the
header-separator row (`|---|---|`), so they render as plain paragraphs on npm
and GitHub rather than as formatted tables.

#### Suggested fix

```markdown
| Property | Type | Description |
|---|---|---|
| `snapshot` | `PathSnapshot \| null` | … |
```

---

### 6. No data-binding example in the docs

Both README examples show structural/navigation usage but neither shows how a
step component reads and writes data (`snapshot.data` / `setData`). This is
the most important pattern to document for a form wizard library.

#### Suggested addition

```jsx
function DetailsStep() {
  const { snapshot, setData } = usePathContext();
  return (
    <input
      value={snapshot?.data.name ?? ""}
      onChange={e => setData("name", e.target.value)}
    />
  );
}

const myPath = {
  id: "example",
  steps: [{ id: "details", canMoveNext: ctx => ctx.data.name?.trim().length > 0 }],
};

<PathShell path={myPath} initialData={{ name: "" }} steps={{ details: <DetailsStep /> }} />
```

---

### 7. `setData` not typed against `TData` in the React adapter

`setData(key, value)` accepts `key: string` and `value: unknown`. The generic
`PathDefinition<TData>` exists on the core but doesn't flow through to `setData`
in `UsePathReturn`, so TypeScript users get no autocomplete or type-checking on
data keys.

#### Suggested fix

```ts
interface UsePathReturn<TData extends PathData = PathData> {
  snapshot: PathSnapshot<TData> | null;
  setData: <K extends keyof TData>(key: K, value: TData[K]) => void;
}
```

---

## Summary

| # | Issue | Status | Severity |
|---|---|---|---|
| 1 | `PathShell` didn't expose context to step children | ✅ Fixed in v0.1.2 | Was 🔴 critical |
| 2 | `canMoveNext` result not in snapshot | ✅ Fixed in v0.1.2 | Was 🟠 medium |
| 3 | No CSS bundled — shell completely unstyled on first use | 🔴 Open | High |
| 4 | README still shows removed `<PathStep>` API | 🔴 Open | High |
| 5 | README table formatting broken | 🟡 Open | Low |
| 6 | No data-binding example in docs | 🟠 Open | Medium |
| 7 | `setData` not typed against `TData` | 🟢 Open | Minor |

The core engine design and the v0.1.2 context fix are both solid. The two most
impactful remaining changes are **bundling a default stylesheet** (issue 3) and
**updating the README** to match the new `steps` prop API (issue 4). Both are
low-effort and would significantly reduce friction for new users.


This was the single biggest obstacle. `PathShell` creates its own internal
`usePath()` engine instance and **does not** wrap step content in a
`PathProvider`. As a result, step components rendered inside `<PathStep>`
have no way to call `usePathContext()` — which means they cannot read
`snapshot.data` or call `setData()`.

For a real data-driven workflow (which is the primary use case for a wizard
library), every step needs to both read and write path data. With `PathShell`
alone that is impossible. The README presents three usage patterns — `usePath`,
`PathProvider`/`usePathContext`, and `PathShell` — but does not mention that
`PathShell` is **incompatible** with `usePathContext()` inside step children.

### What I had to do instead

I had to abandon `PathShell` entirely and write a custom `WorkflowShell`
component from scratch that:

1. Wraps everything in `PathProvider` so step components can use `usePathContext()`
2. Manually replicates the progress indicator, step content resolution, and
   nav button layout that `PathShell` already provides

This was a significant amount of boilerplate for something that should be
handled by the library out of the box.

### Suggested fix

`PathShell` should wrap step body content in a `PathProvider` (or re-use the
same engine via context). The simplest change would be:

```jsx
// Inside PathShell, wrap the body in a provider using the same pathReturn instance
<PathContext.Provider value={pathReturn}>
  <div className="pw-shell__body">{stepContent}</div>
</PathContext.Provider>
```

This one change would make `PathShell` + `usePathContext()` work together and
eliminate the need to write a custom shell for any workflow with data binding.

---

## 2. `canMoveNext` Guards Give No Visual Feedback

The `canMoveNext` guard on a step correctly blocks navigation when it returns
`false`, but the **Next button remains fully enabled** — nothing in the UI
signals to the user that they cannot proceed. They click Next, nothing happens,
and there is no explanation why.

The `snapshot.isNavigating` flag is only `true` during async guard/hook
execution, so it cannot be used to disable the button for a synchronous guard
that always blocks.

### Suggested fix

Add a `canAdvance` boolean to `PathSnapshot` that reflects the *current* result
of `canMoveNext` for the active step (evaluated lazily/synchronously when data
changes). The shell and any custom UI could then use it to disable or style the
Next button:

```ts
interface PathSnapshot {
  // ...existing fields...
  canAdvance: boolean;   // current result of canMoveNext, or true if no guard
  canGoBack:  boolean;   // current result of canMovePrevious, or true if no guard
}
```

`setData` already triggers a `stateChanged` event and re-render, so this could
be re-evaluated at that point cheaply.

---

## 3. `PathStep` Always Returns `null` — Silently Breaks Outside `PathShell`

The docs say `PathStep` "wraps step content" and "only renders its children
when the current step matches `id`". In practice it unconditionally returns
`null`; the rendering logic lives entirely inside `PathShell`. Using `PathStep`
outside a `PathShell` (e.g., in a custom shell) silently renders nothing with
no warning.

When building the custom `WorkflowShell` I had to copy `PathShell`'s internal
`resolveStepContent` logic to make `PathStep` children work as expected.

### Suggested fix

Either:
- Document clearly that `PathStep` is a **metadata-only marker** and only works
  inside `PathShell`, or
- Expose the `resolveStepContent` utility as a named export so custom shells
  can reuse it without copying internal code.

---

## 4. README Table Formatting is Broken

The markdown tables in the README (`usePath` API, `PathStep` props, lifecycle
hooks, events) are missing the header-separator row (`|---|---|`), so they
render as plain paragraphs rather than formatted tables in most Markdown
viewers (npm, GitHub). This makes the API reference significantly harder to
scan.

Example — the `usePath` return value table renders as:

> Property Type Description
> snapshot PathSnapshot \ null Current snapshot…

Rather than a proper table.

### Suggested fix

Add the standard separator row after each table header:

```markdown
| Property | Type | Description |
|---|---|---|
| `snapshot` | `PathSnapshot \| null` | … |
```

---

## 5. No Working Data-Binding Example in the Docs

Both README examples show structural/navigation usage (start a path, click
Next/Back) but neither shows how a step component should **read and write data**
(`snapshot.data` / `setData`). For a multi-step form wizard — the primary use
case — this is the most important pattern to document.

### Suggested addition

A short end-to-end example showing:

```jsx
// In a step component
function DetailsStep() {
  const { snapshot, setData } = usePathContext();
  return (
    <input
      value={snapshot.data.name ?? ""}
      onChange={e => setData("name", e.target.value)}
    />
  );
}

// Path definition using that data in a guard
const myPath = {
  id: "example",
  steps: [
    {
      id: "details",
      canMoveNext: ctx => ctx.data.name?.trim().length > 0,
    },
  ],
};

// Wiring it together
<PathProvider>
  <MyShell path={myPath} initialData={{ name: "" }}>
    <PathStep id="details"><DetailsStep /></PathStep>
  </MyShell>
</PathProvider>
```

---

## 6. Minor: `PathData` Key Is Always `string` — Could Be Typed Per-Step

`setData(key, value)` accepts `key: string` and `value: unknown`. For
TypeScript users, there is no way to get autocomplete or type-checking on
data keys without casting. The generic `PathDefinition<TData>` type exists on
the core, but it does not flow through to `setData` in the React adapter's
`UsePathReturn`.

### Suggested fix

Make `UsePathReturn` generic:

```ts
interface UsePathReturn<TData extends PathData = PathData> {
  snapshot: PathSnapshot<TData> | null;
  setData: <K extends keyof TData>(key: K, value: TData[K]) => void;
  // ...
}
```

---

## Summary Table

| # | Issue | Severity | Effort to Fix |
|---|---|---|---|
| 1 | `PathShell` doesn't expose context to step children | 🔴 High | Low — one `PathContext.Provider` wrap |
| 2 | `canMoveNext` result not in snapshot; Next button never disables | 🟠 Medium | Medium — add `canAdvance` to snapshot |
| 3 | `PathStep` returns null outside `PathShell` with no warning | 🟡 Low | Low — add console.warn or export helper |
| 4 | README tables don't render correctly | 🟡 Low | Low — formatting fix |
| 5 | No data-binding example in docs | 🟠 Medium | Low — add one code example |
| 6 | `setData` not typed against `TData` in React adapter | 🟢 Minor | Medium — generics threading |

---

Overall the core engine design is clean and the event model is well thought
out. The sub-path / stack concept is particularly well designed. The main
friction is all at the integration layer — specifically the gap between
`PathShell` (which is a great convenience component) and `usePathContext`
(which is required for data binding). Closing that gap would make the
library significantly easier to adopt for real-world form wizard use cases
with minimal code.

