# Issue 3.4 Analysis: Svelte Snippet Type Safety

## Question
Should we add TypeScript type safety to enforce that Svelte snippet prop names match step IDs?

## Current Behavior

In Svelte, step content is passed as props where the prop name **must** match the step ID:

```svelte
<PathShell
  path={myPath}
  contact={ContactStep}  <!-- "contact" must match a step ID in myPath -->
/>
```

**Current type definition:**
```typescript
interface Props {
  // ... other props
  [key: string]: Snippet | any;  // ← No type checking
}
```

**Runtime behavior:** If the prop name doesn't match, the shell renders:  
`<p>No content for step "contact"</p>`

---

## Proposed Type Safety

Add a generic parameter that extracts step IDs from the PathDefinition:

```typescript
type ExtractStepIds<T> = T extends PathDefinition<any> 
  ? T['steps'][number]['id'] 
  : never;

type StepSnippets<T extends PathDefinition<any>> = {
  [K in ExtractStepIds<T>]?: Snippet;
};

interface Props<T extends PathDefinition<any> = PathDefinition<any>> {
  path: T;
  // ... other props
} & Partial<StepSnippets<T>>;
```

**Usage:**
```typescript
const myPath = {
  id: 'form',
  steps: [{ id: 'contact' }, { id: 'review' }]
} as const;  // ← "as const" required for literal type inference

<PathShell
  path={myPath}
  contact={ContactStep}  // ✅ OK
  review={ReviewStep}    // ✅ OK  
  foo={FooStep}          // ❌ Type error: "foo" not in ["contact", "review"]
/>
```

---

## Comparison to Other Adapters

| Framework | Pattern | Type Safety | Notes |
|-----------|---------|-------------|-------|
| **React** | `steps={{ contact: <C /> }}` | ❌ No | `Record<string, ReactNode>` - any string key allowed |
| **Vue** | `<template #contact>` | ❌ No | Slots are runtime constructs, no TS checking |
| **Angular** | `pwStep="contact"` | ❌ No | String attribute, no type relationship to path |
| **Svelte (current)** | `contact={ContactStep}` | ❌ No | Props use `[key: string]: Snippet \| any` |
| **Svelte (proposed)** | `contact={ContactStep}` | ✅ **Yes** | Props typed from PathDefinition generic |

**Key insight:** Adding type safety would make Svelte the **only** adapter with compile-time validation of step content mapping.

---

## Trade-offs

### ✅ Benefits

1. **Catch typos at compile time**  
   `conatct={Step}` would fail TypeScript checking immediately
   
2. **IDE autocomplete**  
   When typing `<PathShell path={myPath} |`, the IDE would suggest valid step IDs
   
3. **Refactoring safety**  
   Renaming a step ID would cause TS errors everywhere the old name is used

4. **Documentation as code**  
   The type signature itself documents which step IDs are expected

### ❌ Downsides

1. **Requires `as const` assertion**  
   Users must write `const myPath = { ... } as const;` or the step IDs won't be literal types
   
2. **More complex types**  
   The PathShell component signature becomes harder to read/understand
   
3. **Different from other adapters**  
   Breaks the "consistent patterns" principle across React/Vue/Angular/Svelte
   
4. **Limited real-world benefit**  
   The runtime error message `"No content for step X"` already pinpoints the issue clearly
   
5. **Learning curve**  
   Users would need to understand TypeScript generics, `as const`, and conditional types

6. **Dynamic paths**  
   If steps are built dynamically (e.g., from API data), the type system can't help anyway

---

## Recommendation

**Do NOT implement type safety for Svelte snippets.**

### Rationale

1. **Consistency > Framework-specific magic**  
   All four adapters currently have the same DX: runtime errors if step content is missing. Adding compile-time checking to only Svelte creates an inconsistent mental model across the library.

2. **Simplicity**  
   The current `[key: string]: Snippet | any` is easy to understand. Generic-based type extraction requires advanced TypeScript knowledge.

3. **Marginal benefit**  
   The runtime error is already clear and actionable. Catching it 30 seconds earlier at compile time doesn't justify the complexity cost.

4. **Dynamic paths are common**  
   Many real-world apps build step arrays dynamically (conditional steps, API-driven flows). Type safety doesn't help these cases.

### Alternative: Documentation Improvement (All Adapters)

Instead of type safety, **add prominent callouts** in **all four adapter READMEs** explaining the mapping convention clearly:

#### Svelte README:

````markdown
## Important: Snippet Prop Names Must Match Step IDs

When passing step content to `<PathShell>`, the **prop name must exactly match the step's `id`**:

```typescript
const myPath: PathDefinition = {
  id: 'onboarding',
  steps: [
    { id: 'welcome' },    // ← Step ID
    { id: 'profile' },    // ← Step ID  
  ]
};
```

```svelte
<PathShell
  path={myPath}
  welcome={WelcomeStep}   <!-- ✅ Matches "welcome" step -->
  profile={ProfileStep}   <!-- ✅ Matches "profile" step -->
  foo={FooStep}           <!-- ❌ No step with id "foo" — will show error message -->
/>
```

If a prop name doesn't match any step ID, the shell will render:  
`No content for step "foo"`

**Tip:** Use your IDE's "Go to Definition" on the step ID in your path definition, then copy-paste the exact string when creating the snippet prop. This ensures perfect matching.
````

---

## Decision Summary

| Approach | Consistency | Simplicity | Type Safety | Recommended |
|----------|-------------|------------|-------------|-------------|
| **No type checking** (current) | ✅ Same as React/Vue/Angular | ✅ Simple | ❌ Runtime only | ✅ **YES** |
| **Generic-based types** | ❌ Svelte-only feature | ❌ Complex | ✅ Compile-time | ❌ No |
| **Documentation callout** | ✅ Same DX, better docs | ✅ No code change | ❌ Runtime only | ✅ **YES** |

**Final recommendation:** Mark issue 3.4 as resolved with **documentation improvement across all adapters**. While Svelte raised this, all four adapters have the same discoverability issue. Add clear callouts to each adapter's README:

- **Svelte**: Explain prop name = step ID convention
- **React**: Clarify that `steps` object keys must match step IDs  
- **Vue**: Document that slot names must match step IDs
- **Angular**: Confirm `pwStep` string value must match step ID

Each should include examples and tips for avoiding typos (e.g., copy-paste from path definition).




