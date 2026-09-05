---
"@daltonr/pathwrite-store": patch
---

`HttpStore` no longer drops headers given as a `Headers` instance or as an array of `[name, value]` tuples. The `headers` option is typed `HeadersInit`, but the store spread it into an object literal — which yields nothing for those two forms — so an `Authorization` header supplied that way never reached the request. Headers are now merged through `Headers`, so every `HeadersInit` form works, and user headers override the store's defaults as a plain object always could. Requests now carry a `Headers` object rather than a plain object; a custom `fetch` receives that in `init.headers`.
