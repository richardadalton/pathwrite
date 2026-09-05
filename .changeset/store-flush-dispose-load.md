---
"@daltonr/pathwrite-store": patch
---

`persistence()` now returns a `PersistenceObserver` with `flush()` and `dispose()`. `flush()` saves immediately — cancelling a pending debounce window — and resolves once every queued store operation has landed, for `beforeunload` / unmount handling; with the `"manual"` strategy it is the on-demand save. `dispose()` cancels a pending debounce window and ignores later events, so a timer never outlives the host component. `HttpStore.load()` returns `null` for a `204 No Content` or an empty body instead of throwing, and rejects with a clear message (through `onError`) when the body is not JSON or the JSON is not a `SerializedPathState`, instead of handing arbitrary data to `fromState()`.
