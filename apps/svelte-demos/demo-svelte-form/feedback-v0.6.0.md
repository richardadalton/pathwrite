# Svelte Form Demo - Feedback (v0.6.0)

Updated: March 22, 2026  
Package version: `@daltonr/pathwrite-svelte@0.6.0`

## Summary

Version 0.6.0 brings **CSS import compatibility fixes** and **improved documentation**. The Svelte 5 adapter continues to leverage cutting-edge Svelte features while benefiting from cross-framework improvements.

---

## Key Improvements in v0.6.0

### 1. CSS Import Compatibility ✅ **Fixed**

**Problem in v0.5.0:**
```typescript
import "@daltonr/pathwrite-svelte/styles.css";
// ❌ Could fail with: "Rollup failed to resolve import"
```

**Solution in v0.6.0:**
Added explicit `./dist/index.css` export to package.json. Both paths now work:
```typescript
import "@daltonr/pathwrite-svelte/styles.css";       // ✅ Works (documented)
import "@daltonr/pathwrite-svelte/dist/index.css";  // ✅ Works (also valid)
```

**Impact:**
- ✅ Vite builds succeed reliably
- ✅ CSS properly bundled in production
- ✅ No manual workarounds needed

### 2. Improved Documentation ✨ **Critical for Svelte**

The README now includes:
- ⚠️ Prominent callout explaining **snippet names must match step IDs**
- Clear examples with ✅/❌ indicators
- Tips for using IDE "Go to Definition" to avoid typos

**This addresses the main feedback from v0.5.0** - the snippet prop pattern was not self-documenting.

**Example from new docs:**
```typescript
const myPath = {
  id: 'signup',
  steps: [
    { id: 'details' },  // ← Step ID
    { id: 'review' }    // ← Step ID
  ]
};
```

```svelte
<PathShell path={myPath}>
  {#snippet details()}  <!-- ✅ Matches "details" step -->
    <DetailsForm />
  {/snippet}
  {#snippet review()}   <!-- ✅ Matches "review" step -->
    <ReviewPanel />
  {/snippet}
  {#snippet foo()}      <!-- ❌ No step with id "foo" -->
    <FooPanel />
  {/snippet}
</PathShell>
```

**What happens on mismatch:**
```
No content for step "foo"
```

This was identified as a discoverability issue in the original feedback. The new documentation makes it much clearer.

---

## Developer Experience Assessment

### What Works Well

**1. Runes-based API feels Svelte-native**
```typescript
const { snapshot, setData, next, previous } = usePath<ContactData>();

// Use with runes:
let snap = $derived(snapshot);
```

Clean, follows Svelte 5 runes conventions perfectly.

**2. Snippets pattern is powerful**
```svelte
<PathShell path={myPath}>
  {#snippet contact()}
    <ContactStep />
  {/snippet}
</PathShell>
```

Once you understand the naming convention, it's very elegant.

**3. Reactive updates work seamlessly**
```svelte
{#if snap}
  <span>{(snap.data.message || '').length} chars</span>
{/if}
```

Svelte's reactivity system makes this effortless.

**4. TypeScript type safety**
```typescript
const { setData } = usePath<ContactData>();
setData("name", "Jane");  // ✅ OK
setData("foo", 123);      // ❌ Type error
```

**5. Context pattern with getPathContext()**
```svelte
<script>
  import { getPathContext } from "@daltonr/pathwrite-svelte";
  const path = getPathContext<ContactData>();
</script>
```

Works beautifully for step components accessing parent shell context.

**6. CSS import reliability**
Production builds now work consistently.

### Improved Pain Points

**1. Documentation now addresses snippet naming** ✅

**Before v0.6.0:** Had to figure out through trial and error that snippet names must match step IDs.

**After v0.6.0:** Prominently documented with clear examples. Much better discoverability.

**2. Runtime error is helpful**
```
No content for step "foo"
```

Immediate feedback when there's a mismatch. Combined with the new documentation, this is now discoverable enough.

### Remaining Minor Friction

**1. No compile-time validation of snippet names**

TypeScript can't validate that snippet prop names match step IDs (this is a language limitation, not a library issue). But the documentation improvement + runtime error make this acceptable.

**2. Snippet syntax is Svelte 5 specific**

Requires Svelte 5 (which uses snippets instead of slots). This is intentional and well-documented, but worth noting for teams still on Svelte 4.

---

## Comparison to Other Frameworks

| Feature | Svelte v0.6.0 | React | Vue | Angular |
|---------|---------------|-------|-----|---------|
| **Access pattern** | `usePath()` / `getPathContext()` | `usePathContext()` | `usePath()` | `injectPath()` |
| **Step content** | Snippet props | `steps` object | Named slots | `pwStep` directive |
| **Reactivity** | Runes ($derived) | `useSyncExternalStore` | Refs | Signals |
| **CSS import** | ✅ Fixed | ✅ Fixed | ✅ Fixed | N/A |
| **Documentation** | ✅ Improved ⭐ | ✅ Improved | ✅ Improved | ✅ Improved |

The documentation improvement is especially valuable for Svelte because the snippet prop pattern is less obvious than React's `steps` object or Vue's named slots.

---

## Migration Notes (v0.5.0 → v0.6.0)

### Step 1: Update dependencies
```json
{
  "dependencies": {
    "@daltonr/pathwrite-svelte": "^0.6.0"
  },
  "devDependencies": {
    "svelte": "^5.18.2"
  }
}
```

### Step 2: Verify CSS import
```typescript
// This should "just work" now:
import "@daltonr/pathwrite-svelte/styles.css";
```

If you were using a workaround, you can remove it.

### Step 3: Add index signatures to data interfaces

**TypeScript now requires:**
```typescript
interface ContactData {
  name: string;
  email: string;
  [key: string]: unknown;  // ← Add this for PathData constraint
}
```

This makes the type system more robust.

### Step 4: Review snippet naming

With the improved documentation, review your snippet names to ensure they match step IDs. Use the "Go to Definition" tip to copy-paste exact IDs.

**Breaking changes:** None!

---

## Recommendations for v0.7.0

### 1. Type-safe snippet props (exploration)

Is it possible to extract step IDs as literal types and validate snippet props?

```typescript
// Proposed (may not be feasible):
const myPath = {
  id: 'form',
  steps: [{ id: 'contact' }, { id: 'review' }]
} as const;

<PathShell path={myPath} contact={ContactStep} review={ReviewStep} />
// TypeScript validates: "contact" and "review" are valid, "foo" would error
```

**Analysis:**
- Would require advanced conditional types
- May conflict with Svelte's component prop system
- Documentation is probably sufficient (10x simpler)

**Recommendation:** Document the current pattern better (✅ done in v0.6.0) rather than adding type complexity.

### 2. Dev mode warnings

Add dev-only warnings when:
- Snippet prop names don't match any step ID
- Step IDs don't have corresponding snippet props

```typescript
if (import.meta.env.DEV) {
  console.warn(`PathShell: No snippet provided for step "${stepId}"`);
}
```

### 3. Example of dynamic step rendering

Show a pattern for conditionally including steps:

```svelte
<PathShell path={myPath}>
  {#snippet contact()}<ContactStep />{/snippet}
  {#if showOptionalStep}
    {#snippet optional()}<OptionalStep />{/snippet}
  {/if}
  {#snippet review()}<ReviewStep />{/snippet}
</PathShell>
```

---

## Overall Assessment

**Rating: 9/10** (up from 7.5/10 in v0.5.0)

**Before v0.6.0:** Svelte had great runtime DX but documentation gaps made onboarding harder.

**After v0.6.0:** The documentation improvements dramatically improve discoverability. The snippet pattern is now well-explained, making it as approachable as the other frameworks.

The rating increased significantly not because of code changes, but because of **documentation quality**. This shows how important good docs are for developer experience.

**Would recommend:** ✅ Yes! Especially for Svelte 5 projects. The runes-based API feels native and powerful.

---

## Code Quality Notes

- Runes-based reactivity is cutting-edge Svelte 5
- Snippet pattern is elegant once understood
- TypeScript support is excellent
- CSS properly bundled
- No manual cleanup needed (Svelte handles it)
- Context API works seamlessly for step components

---

## Conclusion

Version 0.6.0 proves that **documentation is a feature**. The technical improvements (CSS import fix) are valuable, but the documentation enhancements are transformative for the Svelte adapter.

The snippet naming convention is now well-documented with clear examples, tips, and explanations of what happens when things go wrong. This addresses the main pain point from v0.5.0 feedback.

Svelte 5 + Pathwrite feels like a natural pairing - both embrace modern, compile-time-optimized approaches to reactivity.

**Next steps:** 
- Enjoy the improved build reliability
- Use the enhanced documentation when onboarding
- Explore Svelte 5 runes with Pathwrite's reactive patterns! 🎉

---

## Side Note: Cross-Framework Consistency

It's worth noting that **all four adapters raised the same issue** (step content naming conventions not being obvious), but only Svelte surfaced it in the initial feedback round. Version 0.6.0 addresses this across all adapters with consistent documentation patterns.

This is a great example of how feedback from one framework can improve the entire library ecosystem.

