---
"@daltonr/pathwrite-react-native": patch
---

`PathShell` catches up with the other shells: a `progressLayout` prop (`"merged"` default, `"rootOnly"`, `"activeOnly"`) and the root path's progress bar shown above the active path's dots while a sub-path runs; warnings are no longer rendered when `validationDisplay` is `"inline"` (step components render them, like errors); the completion panel keeps the progress header above it (all steps ticked) unless progress is hidden; and `PathEngine` is re-exported as a value, so `new PathEngine()` needs no second import.
