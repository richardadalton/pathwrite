# Persistence Strategy Guide

This document explains when saves occur with each strategy and which to choose.

---

## Strategies at a glance

| Strategy | Trigger | API calls (5 keystrokes + Next) | Notes |
|---|---|---|---|
| `"onNext"` *(default)* | `next()` settles on a new step | **1** | Best for text-heavy forms |
| `"onEveryChange"` | Any settled `stateChanged` or `resumed` | **6** (or 2 with `debounceMs: 500`) | Add debounce for text inputs |
| `"onSubPathComplete"` | `resumed` event only | depends | Nested sub-path wizards |
| `"onComplete"` | `completed` event | **0** mid-flow, **1** at end | Audit trail / record-keeping |
| `"manual"` | Never | **0** | You call `store.save()` yourself |

---

## `"onNext"` — the default

```typescript
httpPersistence({ store, key: "user:123:wizard" })
// strategy defaults to "onNext"
```

Saves once, after `next()` has finished navigating to the new step. Ignores `setData`, `previous`, `start`, and everything else.

**Trace:** User types "Hello" (5 × `setData`) then clicks Next:
1. "H" → `setData` → ❌ no save
2. "He" → `setData` → ❌ no save
3. "Hel" → `setData` → ❌ no save
4. "Hell" → `setData` → ❌ no save
5. "Hello" → `setData` → ❌ no save
6. Click Next → navigation settles → ✅ **1 save**

**Total: 1 save.** Ideal for multi-step forms.

**Risk:** Data typed before clicking Next is lost if the browser crashes.

---

## `"onEveryChange"` without debounce

```typescript
httpPersistence({ store, key: "user:123:wizard", strategy: "onEveryChange" })
```

Saves on every settled `stateChanged` event — including `setData`. Fires once per `setData` call, once per navigation, once per sub-path completion.

**Trace:** Same scenario:
1–5. Each keystroke → `setData` → ✅ **5 saves**
6. Click Next → ✅ **1 save**

**Total: 6 saves.** Fine for dropdown/checkbox-only steps, but never use with text inputs without a debounce.

---

## `"onEveryChange"` with debounce

```typescript
httpPersistence({
  store,
  key: "user:123:wizard",
  strategy: "onEveryChange",
  debounceMs: 500,
})
```

Collapses rapid saves into one, firing after the user pauses for 500 ms.

**Trace:**
1–5. Each keystroke resets the 500 ms timer → no immediate save
6. User stops typing → 500 ms later → ✅ **1 save**
7. Click Next → ✅ **1 save**

**Total: 2 saves.** Use this when you want crash protection (state saved while typing) without flooding the API.

---

## `"onSubPathComplete"`

```typescript
httpPersistence({ store, key: "user:123:wizard", strategy: "onSubPathComplete" })
```

Saves only when a sub-path finishes and the parent path resumes. Useful for wizards where each sub-flow represents a meaningful checkpoint.

---

## `"onComplete"`

```typescript
httpPersistence({ store, key: "user:123:wizard", strategy: "onComplete" })
```

Saves a final record when the wizard completes. Does **not** delete the record after saving (so it's available for audit/review). Does not save anything mid-flow.

Use when you only care about the final submitted data, not the in-progress state.

---

## `"manual"`

```typescript
httpPersistence({ store, key: "user:123:wizard", strategy: "manual" })
```

Never auto-saves. Call `store.save(key, engine.exportState()!)` yourself at the points you choose.

---

## Choosing a strategy

| Wizard type | Recommended | Why |
|---|---|---|
| Text-heavy forms | `"onNext"` | 1 save per step, no debounce needed |
| Dropdowns / checkboxes | `"onNext"` or `"onEveryChange"` | Each change is deliberate, no rapid-fire |
| Crash-sensitive text input | `"onEveryChange"` + `debounceMs: 500` | Saves while typing without flooding |
| Sub-flow wizards | `"onSubPathComplete"` | Save at meaningful checkpoints |
| Audit trail | `"onComplete"` | Record-keeping only |
| Custom logic | `"manual"` | Full control |

---

## Debugging save timing

Pass `onSaveSuccess` to see exactly when saves happen:

```typescript
httpPersistence({
  store,
  key: "user:123:wizard",
  strategy: "onEveryChange",
  debounceMs: 500,
  onSaveSuccess: () => console.log(`[${new Date().toISOString()}] Saved`),
  onSaveError:   (err) => console.error("Save failed:", err.message),
})
```

Or add a logging observer alongside persistence:

```typescript
const engine = new PathEngine({
  observers: [
    httpPersistence({ store, key: "user:123:wizard" }),
    (event) => console.log(`[wizard] ${event.type}`, 'cause' in event ? event.cause : ""),
  ],
});
```
