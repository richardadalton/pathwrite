---
"@daltonr/pathwrite-angular": patch
"@daltonr/pathwrite-solid": patch
"@daltonr/pathwrite-react-native": patch
---

Custom shell headers follow one rule in every shell: shown whenever progress is not hidden (`hideProgress`, `layout="tabs"`), including for a single-step path; only the default progress header additionally hides for one step. Angular's `pwShellHeader` ignored `hideProgress` and `layout="tabs"`; Solid's `renderHeader` and React Native's `renderHeader` were hidden for single-step paths.
