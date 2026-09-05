---
"@daltonr/pathwrite-store": patch
---

`restoreOrStart` no longer rejects when saved state cannot be used. A failing `store.load` (corrupt JSON, network), an unsupported `version`, or a path id no longer present in `pathDefinitions` (a renamed path) used to reject the whole call, leaving the app unable to start until storage was cleared by hand. The error is now reported through the new `onRestoreError` option (or `console.warn` when absent), the record is deleted on a best-effort basis, and the path starts fresh with `restored: false`.
