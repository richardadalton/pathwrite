---
"@daltonr/pathwrite-svelte": patch
---

`PathShellActions` is exported and is the type of the second argument of a custom `footer` snippet (`{#snippet footer(snap, actions)}`), which was typed `object`. Same shape as the other adapters' `PathShellActions`.
