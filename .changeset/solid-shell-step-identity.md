---
"@daltonr/pathwrite-solid": patch
---

`PathShell` no longer tears down and re-creates the current step component on every engine event. The step render function used to be called inside a tracked render position that read the `{ equals: false }` snapshot signal, so each `setData` (every keystroke) destroyed the step and rebuilt it — the `<input>` lost its DOM node, focus and local state. The rendered step is now keyed on its identity (path, nesting level, step / form id), created once when the step becomes current and kept until the path moves on. The `snapshot` argument passed to the render function is live: its properties read the current snapshot reactively, so `(snap) => <Step snapshot={snap} />` with `createMemo(() => props.snapshot.data)` inside keeps working. `usePathContext().snapshot()` is unchanged.
