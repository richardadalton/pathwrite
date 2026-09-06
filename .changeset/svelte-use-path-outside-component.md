---
"@daltonr/pathwrite-svelte": minor
---

**`usePath()` works outside a component again.** It called `onDestroy` unconditionally, which throws `lifecycle_outside_component` when there is no component context, so calling it from a `.svelte.ts` module or from inside your own `$effect.root` crashed immediately. That contradicted the adapter's own code: the watcher is wrapped in `$effect.root` with a comment saying it exists so `usePath()` also works outside a component. The lifecycle hook is now attempted and skipped when there is no component to hook.

Every test file in the package stubbed `onDestroy` out, one of them with a comment explaining that it needed a component context, so the suite could not see this. There is now a test file that deliberately does not mock Svelte's lifecycle, the unnecessary stub has been removed from the client-mode test, and the remaining mock is documented as an instrument for simulating destroy rather than a workaround.

**New `destroy()` on the `usePath()` return.** Inside a component it still runs automatically on destroy and you never need to call it. Outside one there is no lifecycle to hang cleanup on, so this is how you release the engine subscription and the internal effect root. It is idempotent.

`destroy` is deliberately **not** on `PathContext`, so `usePathContext()` in a step component does not expose it: it is the owner's handle on the subscription, and a child must not be able to tear down the one its shell depends on. The context parity type test records that exclusion.
