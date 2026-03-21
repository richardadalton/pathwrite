# Persistence Strategy Behavior - Detailed Analysis

This document explains exactly when saves occur with different persistence strategies and configurations.

---

## Scenario: User Types "Hello" and Clicks Next

Let's trace through what happens when a user:
1. Types "H" → "He" → "Hel" → "Hell" → "Hello" (5 keystrokes)
2. Clicks the "Next" button

### Strategy: `onEveryChange` (No Debouncing)

```typescript
const wrapper = new PathEngineWithStore({
  key: "user:123:wizard",
  store,
  persistenceStrategy: "onEveryChange",
  debounceMs: 0, // No debouncing
});
```

**What happens:**
1. User types "H" → `setData("name", "H")` → `stateChanged` event → **Save #1**
2. User types "e" → `setData("name", "He")` → `stateChanged` event → **Save #2**
3. User types "l" → `setData("name", "Hel")` → `stateChanged` event → **Save #3**
4. User types "l" → `setData("name", "Hell")` → `stateChanged` event → **Save #4**
5. User types "o" → `setData("name", "Hello")` → `stateChanged` event → **Save #5**
6. User clicks Next → `next()` → `stateChanged` event → **Save #6**

**Total: 6 saves** ❌ Inefficient for text input

---

### Strategy: `onEveryChange` (With 500ms Debouncing)

```typescript
const wrapper = new PathEngineWithStore({
  key: "user:123:wizard",
  store,
  persistenceStrategy: "onEveryChange",
  debounceMs: 500, // 500ms debounce
});
```

**What happens:**
1. User types "H" → `setData("name", "H")` → Save timer starts (500ms)
2. User types "e" (100ms later) → `setData("name", "He")` → Timer resets (500ms)
3. User types "l" (100ms later) → `setData("name", "Hel")` → Timer resets (500ms)
4. User types "l" (100ms later) → `setData("name", "Hell")` → Timer resets (500ms)
5. User types "o" (100ms later) → `setData("name", "Hello")` → Timer resets (500ms)
6. *User stops typing*
7. ... 500ms pass with no changes ...
8. Timer fires → **Save #1** (with "Hello")
9. User clicks Next → `next()` → `stateChanged` event → Timer starts
10. ... 500ms would pass, but navigation completes ...
11. **Save #2** (with navigation to step 2)

**Total: 2 saves** ✅ Much better!

---

### Strategy: `onNext`

```typescript
const wrapper = new PathEngineWithStore({
  key: "user:123:wizard",
  store,
  persistenceStrategy: "onNext",
  debounceMs: 0, // Debouncing not needed
});
```

**What happens:**
1. User types "H" → `setData("name", "H")` → `stateChanged` event → ❌ No save (onNext ignores setData)
2. User types "e" → `setData("name", "He")` → `stateChanged` event → ❌ No save
3. User types "l" → `setData("name", "Hel")` → `stateChanged` event → ❌ No save
4. User types "l" → `setData("name", "Hell")` → `stateChanged` event → ❌ No save
5. User types "o" → `setData("name", "Hello")` → `stateChanged` event → ❌ No save
6. User clicks Next → `next()` → `stateChanged` event → **Save #1**

**Total: 1 save** ✅ Ideal for text-heavy forms!

**Risk**: If browser crashes before clicking Next, typed data is lost.

---

### Strategy: `manual`

```typescript
const wrapper = new PathEngineWithStore({
  key: "user:123:wizard",
  store,
  persistenceStrategy: "manual",
});
```

**What happens:**
1. User types "H" → `setData("name", "H")` → ❌ No save
2. User types "e" → `setData("name", "He")` → ❌ No save
3. User types "l" → `setData("name", "Hel")` → ❌ No save
4. User types "l" → `setData("name", "Hell")` → ❌ No save
5. User types "o" → `setData("name", "Hello")` → ❌ No save
6. User clicks Next → `next()` → ❌ No save

**Total: 0 saves** (unless developer calls `wrapper.save()` explicitly)

---

## Performance Comparison

### API Calls per User Action

| User Action | onEveryChange (no debounce) | onEveryChange (500ms) | onNext | manual |
|---|---|---|---|---|
| Types 1 character | 1 save | Timer starts/resets | 0 | 0 |
| Types 5 characters | 5 saves | Timer resets 5x → 1 save after 500ms | 0 | 0 |
| Clicks Next | 1 save | 1 save | 1 save | 0 |
| Selects dropdown | 1 save | 1 save (or debounced) | 0 | 0 |
| Checks checkbox | 1 save | 1 save (immediate, usually) | 0 | 0 |

---

## Real-World Form Example

**Wizard with 3 text fields:**
- Name (user types 10 characters)
- Email (user types 20 characters)  
- Company (user types 15 characters)
- User clicks Next

### Without Debouncing (`onEveryChange`)
- **45 saves** (10 + 20 + 15) during typing
- **1 save** on Next
- **Total: 46 saves** ❌

### With 500ms Debouncing (`onEveryChange` + `debounceMs: 500`)
- **3 saves** (1 per field after user stops typing)
- **1 save** on Next
- **Total: 4 saves** ✅

### With `onNext` Strategy
- **0 saves** during typing
- **1 save** on Next
- **Total: 1 save** ✅

---

## Recommendations by Wizard Type

### Text-Heavy Forms (Name, Email, Address, etc.)

**Best Choice: `onNext` (Default)** ✅
```typescript
const wrapper = new PathEngineWithStore({
  key: "user:123:wizard",
  store,
  // persistenceStrategy defaults to "onNext" - no need to specify!
});
```

**Why?** 
- Minimizes API calls (1 save per step)
- No debouncing needed
- Users don't lose progress if they navigate away
- Simple and intuitive behavior

**Alternative: `onEveryChange` + Debouncing** (for crash protection)
```typescript
const wrapper = new PathEngineWithStore({
  key: "user:123:wizard",
  store,
  persistenceStrategy: "onEveryChange",
  debounceMs: 500, // REQUIRED with text inputs!
});
```

**Why?** Provides crash protection even before clicking Next. But generates more API calls than `onNext`.

---

### Dropdowns/Checkboxes Only

**Best Choice: `onNext` (Default)** ✅
```typescript
const wrapper = new PathEngineWithStore({
  key: "user:123:wizard",
  store,
});
```

**Why?** Simple, efficient, works great for all input types.

**Alternative: `onEveryChange` (no debouncing needed)**
```typescript
const wrapper = new PathEngineWithStore({
  key: "user:123:wizard",
  store,
  persistenceStrategy: "onEveryChange",
});
```

**Why?** Each change is deliberate (not rapid typing), so immediate saves are fine. Use if you want instant persistence.

---

### Mixed: Text + Dropdowns

**Best Choice: `onNext` (Default)** ✅
```typescript
const wrapper = new PathEngineWithStore({
  key: "user:123:wizard",
  store,
});
```

**Why?** Works perfectly for all input types without any configuration.

**Alternative: `onEveryChange` + Debouncing** (if crash protection needed)
```typescript
const wrapper = new PathEngineWithStore({
  key: "user:123:wizard",
  store,
  persistenceStrategy: "onEveryChange",
  debounceMs: 500, // Required for text inputs!
});
```

---

### Long Multi-Step Wizard

**Best Choice: `onNext` (Default)** ✅
```typescript
const wrapper = new PathEngineWithStore({
  key: "user:123:wizard",
  store,
});
```

**Why?** Users expect to save when moving between pages. Minimal server load. Perfect fit.

---

### Record-Keeping (Audit Trail)

**Best Choice: `onComplete`**
```typescript
const wrapper = new PathEngineWithStore({
  key: "user:123:wizard",
  store,
  persistenceStrategy: "onComplete",
});
```

**Why?** Only saves the final submitted data as a record. No intermediate states saved.

---

## Key Takeaways

1. **`onNext` is the default and best choice for most wizards** ✅ - 1 save per step, no debouncing needed.

2. **`onEveryChange` without debouncing = ❌** Triggers save on every keystroke. Only use with dropdowns/checkboxes or with `debounceMs: 500`.

3. **`onEveryChange` + `debounceMs: 500` = ⚠️** Use only if you need crash protection before clicking Next. More API calls than `onNext`.

4. **Always add `debounceMs: 500`** if using `onEveryChange` with text inputs.

5. **Default behavior** (`onNext`) balances safety and performance perfectly for most use cases.

---

## Testing Your Configuration

Add this to see exactly when saves occur:

```typescript
const wrapper = new PathEngineWithStore({
  key: "user:123:wizard",
  store,
  persistenceStrategy: "onEveryChange",
  debounceMs: 500,
  
  onSaveSuccess: () => {
    console.log(`[${new Date().toISOString()}] Save successful`);
  },
});
```

Then type in a field and watch the console. You should see one save **after** you stop typing for 500ms, not during typing.



