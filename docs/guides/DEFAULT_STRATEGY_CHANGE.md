# Default Persistence Strategy: `"onNext"`

The default persistence strategy is `"onNext"` — saves once after `next()` completes navigation to a new step.

---

## Rationale

`"onNext"` is the right default because:

1. **1 save per step** — typing "Hello" + clicking Next = 1 API call, not 6
2. **No configuration required** — works correctly for text inputs without needing `debounceMs`
3. **Intuitive** — saves match what users expect from a multi-step wizard
4. **Still safe** — progress is saved when the user advances; only a browser crash *before* clicking Next loses typed data (rare)

The previous default (`"onEveryChange"`) generated 46 saves for a typical 3-field form without debouncing, and required developers to configure `debounceMs: 500` to avoid flooding the API.

---

## Default usage

```typescript
httpPersistence({ store, key: "user:123:wizard" })
// strategy defaults to "onNext" — no other config needed
```

or with the convenience factory:

```typescript
const store = new HttpStore({ baseUrl: "/api/wizard" });
const { engine } = await createPersistedEngine({
  store,
  key: "user:123:wizard",
  path: myPath,
  // strategy defaults to "onNext"
});
```

---

## Opting into crash protection

If you need state saved while the user is typing (before clicking Next):

```typescript
httpPersistence({
  store,
  key: "user:123:wizard",
  strategy: "onEveryChange",
  debounceMs: 500,   // required for text inputs
})
```

---

## Performance comparison

| Strategy | Saves for: 3-field form (10+20+15 chars) + Next |
|---|---|
| `"onNext"` (default) | **1 save** ✅ |
| `"onEveryChange"` + `debounceMs: 500` | **4 saves** (1 per field pause + Next) |
| `"onEveryChange"` no debounce | **46 saves** ❌ |

---

## See also

- `PERSISTENCE_STRATEGY_GUIDE.md` — full strategy reference
- `AUTO_PERSISTENCE_SUMMARY.md` — persistence architecture overview
