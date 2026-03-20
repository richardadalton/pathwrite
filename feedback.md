# Pathwrite Package Feedback

Feedback based on building a six-step document review workflow using
`@daltonr/pathwrite-react@0.1.1` and `@daltonr/pathwrite-core@0.1.1`.

---

## 1. The Main Problem: `PathShell` Cannot Share Context with Step Children

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

