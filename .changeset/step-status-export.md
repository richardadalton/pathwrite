---
"@daltonr/pathwrite-react": patch
"@daltonr/pathwrite-react-native": patch
"@daltonr/pathwrite-vue": patch
"@daltonr/pathwrite-svelte": patch
"@daltonr/pathwrite-solid": patch
"@daltonr/pathwrite-angular": patch
---

Every adapter re-exports the `StepStatus` type (`"completed" | "current" | "upcoming"`, the `status` of each entry in `snapshot.steps`) alongside the other core types, so custom headers need not import it from core directly.
