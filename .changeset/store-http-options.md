---
"@daltonr/pathwrite-store": patch
---

`HttpStore` accepts `credentials` (sent on every request), `signal` (an `AbortSignal` that cancels every request when aborted) and `timeoutMs` (aborts any single request that runs longer). A timed-out or aborted request rejects and is reported through `onError` like any other failure; the timeout timer is cleared when the request settles.
