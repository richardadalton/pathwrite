---
"@daltonr/pathwrite-svelte": patch
---

`.svelte` files are now type-checked: `svelte-check` runs as the first step of the package build (`npm run check`). It found and this release fixes: `PathShell` calling `restart(path, initialData)` against the zero-argument `restart()` (harmless at runtime, but wrong); `PathContext.snapshot` typed non-null while it is `null` with no active path (the README already narrows it with `{#if ctx.snapshot}`); the `path` prop typed optional but passed unguarded to `start()` — the shell now throws a clear error when neither `path` nor `engine` is given; and an `import.meta.env` read that relied on Vite's ambient types.
