# Issue 3.1 Analysis: `createFormPath()` Helper

## TL;DR: **Recommend closing as "Won't Fix" with documentation improvements**

The proposed `createFormPath()` helper adds minimal value and goes against Pathwrite's design philosophy. With recent improvements (items 1.1, 1.2, 2.2, 2.3), single-step forms already "just work" with minimal configuration. Better to document the pattern than create a new API.

---

## The Proposal

```typescript
function createFormPath<T>(config: {
  id: string;
  initialData: T;
  validate: (data: T) => string[];
}): PathDefinition<T>
```

Aims to reduce boilerplate for developers using Pathwrite as a form engine.

---

## Why This Doesn't Make Sense

### 1. **The API is Already Outdated**

The proposal uses `validate: (data) => string[]`, which maps to the old `validationMessages` API. We've since added `fieldMessages: Record<string, string>` (item 1.1), which is:
- Field-keyed for inline error display
- Auto-derives `canMoveNext` when not explicitly set
- Used by all four adapter shells for automatic error rendering

Any helper created today would need to use `fieldMessages`, not flat string arrays.

### 2. **Minimal Boilerplate Savings**

**Current code** (with all improvements from items 1.1, 1.2, 2.2, 2.3):
```typescript
const formPath: PathDefinition = {
  id: "contact-form",
  steps: [{
    id: "contact",
    fieldMessages: ({ data }) => ({
      name: !data.name ? "Required" : undefined,
      email: !isValidEmail(data.email) ? "Invalid email" : undefined,
      message: !data.message ? "Required" : undefined
    })
  }]
};

// Usage:
<PathShell 
  path={formPath} 
  initialData={{ name: "", email: "", message: "" }}
  onComplete={(data) => submitForm(data)}
/>
```

**With proposed helper:**
```typescript
const formPath = createFormPath({
  id: "contact-form",
  initialData: { name: "", email: "", message: "" },
  validate: (data) => /* ??? what format? */ 
});

// Usage: same
<PathShell path={formPath} onComplete={(data) => submitForm(data)} />
```

**Savings:** You're eliminating `steps: [{ id: "contact" }]` — that's **2 lines**.

But you're adding:
- A new API to learn
- A new import (`createFormPath`)
- Confusion about when to use it vs. the standard API

### 3. **Hides Useful Features**

Even "simple forms" often need:
- **`onEnter`** to set defaults, fetch initial data, or populate from URL params
- **`onLeave`** to transform/clean data before submission
- **`title`** for the step header
- **`meta`** for custom metadata (e.g., analytics tracking)

Example:
```typescript
steps: [{
  id: "contact",
  title: "Contact Us",
  onEnter: async () => {
    const user = await fetchCurrentUser();
    return { name: user.name, email: user.email }; // Pre-fill from session
  },
  fieldMessages: ({ data }) => ({ /* ... */ })
}]
```

A helper that abstracts away the `steps` array makes these features harder to discover and use.

### 4. **Forms Already "Just Work"**

With recent improvements, single-step forms require **zero special configuration**:

✅ **Auto-hidden progress** (item 1.2)
- `stepCount === 1 && nestingLevel === 0` → progress indicator hidden
- No manual `hideProgress` needed

✅ **Auto-form footer layout** (item 2.3)
- Same condition → `footerLayout: "form"` (Cancel left, Submit right)
- No Back button clutter

✅ **Auto-derived canMoveNext** (item 1.1)
- When `fieldMessages` is defined but `canMoveNext` isn't, the engine automatically blocks navigation when any field has an error
- No manual guard needed

✅ **Smart error display timing** (item 2.2)
- Shells gate `fieldMessages` rendering with `hasAttemptedNext`
- "Punish late, reward early" behavior is automatic

**The developer experience is already great:**
```typescript
// Define form
const form: PathDefinition = {
  id: "contact",
  steps: [{
    id: "main",
    fieldMessages: ({ data }) => ({
      name: !data.name ? "Required" : undefined,
      email: !isValidEmail(data.email) ? "Invalid email" : undefined
    })
  }]
};

// Use it
<PathShell path={form} initialData={{}} onComplete={submit} />

// That's it! You automatically get:
// - Hidden progress
// - Form-style footer
// - Blocked submit when invalid
// - Errors shown after first attempt
// - Field-labeled error display
```

### 5. **Goes Against Design Philosophy**

Pathwrite's strength is its **small, composable API**:
- One `PathDefinition` type for everything (forms, wizards, workflows)
- One `PathEngine` for all use cases
- Framework adapters add zero concepts, just UI bindings

Adding `createFormPath()` means:
- Developers have to learn when to use it vs. `PathDefinition`
- Two ways to do the same thing (bad DX)
- More API surface to document and maintain
- Temptation to add `createWizard()`, `createWorkflow()`, etc.

**Better:** Keep one API, document patterns.

---

## What to Do Instead

### Option A: Expand the "Forms" Section in Existing Docs

Update `docs/guides/BEYOND_WIZARDS.md` section on "Single-Page Forms" to:

1. **Show the current best practice** with `fieldMessages`
2. **Explain auto-detection**: progress, footer layout, canMoveNext
3. **Common patterns**:
   - Default values (`onEnter`)
   - Async validation (move to `canMoveNext`)
   - Conditional fields (show/hide based on data)
   - Multi-section forms (still single-step, but organized)
4. **Complete example** with TypeScript types and all four frameworks

### Option B: Create a Dedicated "Forms Guide"

New file: `docs/guides/FORMS_WITH_PATHWRITE.md`

Structure:
```markdown
# Forms with Pathwrite

## Why Use Pathwrite for Forms?
- Type-safe data binding
- Auto-persistence (crash recovery)
- Field-level validation with auto-rendering
- Event streaming for analytics
- Consistent API across frameworks

## Quick Start

[Complete example with fieldMessages, auto-detection explained]

## Patterns

### Default Values
### Async Validation
### Conditional Fields
### Multi-Section Forms
### Integration with Existing Form Libraries

## Framework Examples

[React, Vue, Svelte, Angular tabs]

## FAQs

- When to use Pathwrite vs. React Hook Form / Formik / VeeValidate?
- How do I integrate with my backend validation?
- Can I use Pathwrite with my existing forms?
```

### Option C: Add to Each Adapter README

Each adapter README gets a "Forms" section showing the idiomatic pattern for that framework.

---

## Recommendation

**Close issue 3.1 as "Won't Fix"** with these actions:

1. **Update `BEYOND_WIZARDS.md`** (30 min)
   - Replace old `validationMessages` example with `fieldMessages`
   - Add callouts for auto-detection features
   - Expand common patterns section

2. **Add "Forms" section to Developer Guide** (1 hour)
   - Show complete form example
   - Explain auto-detection magic
   - Link to demos

3. **Update each adapter README** (2 hours total)
   - Add "Using as a Form" quick-start
   - Framework-specific tips

**Total effort:** ~3.5 hours of documentation vs. implementing, testing, and maintaining a new API that saves 2 lines of code.

---

## If You Still Want a Helper...

If after all this you still want programmatic convenience, here's a better design:

```typescript
/**
 * Creates a single-step PathDefinition with sensible defaults for forms.
 * This is a thin convenience wrapper — you can still use PathDefinition directly.
 */
function formPath<T extends PathData>(config: {
  id: string;
  title?: string;
  fieldMessages?: (ctx: PathStepContext<T>) => FieldErrors;
  onEnter?: (ctx: PathStepContext<T>) => Partial<T> | void | Promise<Partial<T> | void>;
  onLeave?: (ctx: PathStepContext<T>) => Partial<T> | void | Promise<Partial<T> | void>;
}): PathDefinition<T> {
  return {
    id: config.id,
    steps: [{
      id: "main",
      title: config.title,
      fieldMessages: config.fieldMessages,
      onEnter: config.onEnter,
      onLeave: config.onLeave
    }]
  };
}

// Usage:
const form = formPath({
  id: "contact",
  fieldMessages: ({ data }) => ({
    name: !data.name ? "Required" : undefined,
    email: !isValidEmail(data.email) ? "Invalid" : undefined
  })
});
```

But honestly? This still doesn't save enough to justify the cognitive overhead.

---

## Conclusion

**The problem that motivated this issue has been solved** by items 1.1, 1.2, 2.2, and 2.3. Forms are now first-class citizens with:
- Automatic UI adaptations
- Field-level validation
- Smart error timing
- Clean, simple API

Better documentation is the path forward, not a new API.

