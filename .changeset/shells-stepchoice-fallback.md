---
"@daltonr/pathwrite-angular": patch
"@daltonr/pathwrite-solid": patch
---

`PathShell` now falls back from a `StepChoice`'s inner step id (`formId`) to the slot's own `stepId` when looking up step content, as the React, Vue and Svelte shells already did. A choice registered under its own id (`steps={{ type: ... }}` / `<ng-template pwStep="type">`) rendered blank in Angular and Solid; content registered under the inner id still takes precedence.
