---
"@daltonr/pathwrite-svelte": patch
"@daltonr/pathwrite-angular": patch
---

`usePathContext()` now exposes the full action surface in every adapter. Svelte's `PathContext` lacked `start`, `startSubPath` and `validate`, so a step component could not launch a sub-path through the context; it now extends `UsePathReturn`, and `<PathShell>` provides all three. Angular's `UsePathContextReturn` lacked `validate()`; it is now derived from `PathFacade` (`Pick<PathFacade, FacadeContextMethod>`) and forwards `validate()`. Both were hand-written copies of the hook / facade surface that fell behind when `validate()` was added; each adapter now has a type-level test asserting the context matches its hook or facade, so this cannot recur silently.
