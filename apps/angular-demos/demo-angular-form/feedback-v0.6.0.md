# Angular Form Demo - Feedback (v0.6.0)

Updated: March 22, 2026  
Package version: `@daltonr/pathwrite-angular@0.6.0`

## Summary

Version 0.6.0 introduces **`injectPath()`**, a signal-based API that dramatically improves the Angular developer experience. The demo has been updated to showcase this new approach.

---

## Key Improvements in v0.6.0

### 1. `injectPath()` API ✨ **Game Changer**

**Before** (v0.5.0 - template reference pattern):
```html
<pw-shell #shell [path]="myPath">
  <ng-template pwStep="contact">
    <input (input)="shell.facade.setData('name', $any($event.target).value)" />
  </ng-template>
</pw-shell>
```

**After** (v0.6.0 - `injectPath()` pattern):
```typescript
@Component({
  providers: [PathFacade],
  template: `
    <input (input)="updateName($any($event.target).value)" />
    <button (click)="path.next()">Next</button>
  `
})
export class ContactStepComponent {
  protected readonly path = injectPath<ContactData>();

  protected updateName(value: string): void {
    this.path.setData("name", value);  // ← Clean, no template ref!
  }
}
```

**Benefits:**
- ✅ **No template references** (`#shell`) required
- ✅ **Signal-native** - `path.snapshot()` returns the reactive signal directly
- ✅ **Type-safe** - Generic parameter flows through to all methods
- ✅ **Cleaner templates** - Business logic stays in the component class
- ✅ **Framework-consistent** - Matches React's `usePathContext()` and Vue's `usePath()`

### 2. Improved Documentation

The README now includes:
- ⚠️ Prominent callout explaining `pwStep` values must match step IDs
- Clear examples with ✅/❌ indicators
- Tips for using IDE features to avoid typos

This addresses discoverability issues raised in the v0.5.0 feedback.

### 3. CSS Import Compatibility

No changes needed - Angular doesn't use Vite, so the CSS export fix doesn't affect this demo. The import still works via `angular.json` configuration.

---

## Developer Experience Assessment

### What Works Well

**1. `injectPath()` feels Angular-native**
- Uses familiar `inject()` pattern
- Returns signals (Angular 16+ standard)
- No RxJS required for basic usage
- Follows the "progressive complexity" principle

**2. Component isolation**
- Each step can be a separate component with its own `providers: [PathFacade]`
- Clean separation of concerns
- Easy to test in isolation

**3. Type safety**
```typescript
const path = injectPath<ContactData>();
path.setData("name", "Jane");  // ✅ OK
path.setData("foo", 123);      // ❌ Type error
```

**4. Signal reactivity**
```typescript
@if (path.snapshot(); as s) {
  <span>{{ (s.data.message || '').length }} chars</span>
}
```
Character count updates automatically as user types - no manual subscription management.

### Potential Pain Points (Minor)

**1. Provider requirement**
Must remember to add `providers: [PathFacade]` to the component or a parent. The error message is helpful:
```
injectPath() requires PathFacade to be provided.
Add 'providers: [PathFacade]' to your component or a parent component.
```

**2. Template ref pattern still needed for complex cases**
If you need to access navigation methods from the parent component hosting `<pw-shell>`, you still need `@ViewChild`. But this is a rare use case.

**3. Double instantiation gotcha**
If both parent and step component provide `PathFacade`, you get two separate engines. The documentation could emphasize the "provide high, inject low" pattern more clearly.

---

## Comparison to Other Frameworks

| Feature | Angular v0.6.0 | React | Vue | Svelte |
|---------|----------------|-------|-----|--------|
| **Access pattern** | `injectPath()` | `usePathContext()` | `usePath()` | `getPathContext()` |
| **Reactivity** | Signals | `useSyncExternalStore` | Refs | Runes |
| **Type safety** | ✅ Generic | ✅ Generic | ✅ Generic | ✅ Generic |
| **Feels native?** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |

**Consistency achieved!** All four adapters now have a similar ergonomic API that feels native to their respective frameworks.

---

## Migration Notes (v0.5.0 → v0.6.0)

### Step 1: Update dependencies
```json
{
  "dependencies": {
    "@daltonr/pathwrite-core": "^0.6.0",
    "@daltonr/pathwrite-angular": "^0.6.0"
  }
}
```

### Step 2: Create step components using `injectPath()`
```typescript
import { injectPath, PathFacade } from "@daltonr/pathwrite-angular";

@Component({
  providers: [PathFacade],  // ← Add this
  template: `...`
})
export class MyStepComponent {
  protected readonly path = injectPath<MyData>();  // ← Use this
}
```

### Step 3: Remove template references
```diff
- <pw-shell #shell ...>
-   <ng-template pwStep="contact">
-     <input (input)="shell.facade.setData(...)" />
-   </ng-template>
- </pw-shell>

+ <pw-shell ...>
+   <ng-template pwStep="contact">
+     <app-contact-step />
+   </ng-template>
+ </pw-shell>
```

**Breaking changes:** None! The old pattern still works if you prefer it.

---

## Recommendations for v0.7.0

### 1. Enhanced Type Inference for `pwStep`
Could TypeScript infer the required step IDs from the path definition?
```typescript
// Dream syntax:
<pw-shell [path]="myPath">
  <ng-template pwStep="contact">  <!-- ← IDE autocomplete? -->
```
Probably not feasible with current Angular template type system, but worth exploring.

### 2. `syncFormGroup()` with `injectPath()`
The `syncFormGroup()` helper currently takes a `PathFacade`. Could it also accept the return value of `injectPath()`?

```typescript
// Current:
const facade = inject(PathFacade);
syncFormGroup(facade, this.form);

// Proposed:
const path = injectPath<MyData>();
syncFormGroup(path, this.form);  // ← Accept InjectPathReturn?
```

### 3. Documentation: "Provide high, inject low" pattern
Add a prominent callout explaining that `PathFacade` should be provided at the shell level (or higher), not in each step component. This prevents accidental double-engine creation.

---

## Overall Assessment

**Rating: 9/10** (up from 6/10 in v0.5.0)

**Before v0.6.0:** Angular felt like the "verbose outlier" compared to React/Vue/Svelte.

**After v0.6.0:** Angular is on par with the other frameworks. `injectPath()` makes the DX feel modern, clean, and Angular-native.

The only reason it's not 10/10 is the minor "provider requirement" learning curve, but the error message makes this discoverable enough.

**Would recommend:** ✅ Definitely! This is now the recommended pattern for Angular + Pathwrite.

---

## Code Quality Notes

- Character count feature works seamlessly with signals
- No manual subscription cleanup needed
- TypeScript catches typos at compile time
- Template is clean and focused on presentation
- Business logic clearly separated in component methods

---

## Conclusion

Version 0.6.0 delivers on the promise of **feature parity with framework-native DX**. Angular developers can now use Pathwrite without feeling like they're working against the framework.

The migration from v0.5.0 is smooth (no breaking changes), and the improvements are immediately noticeable. This release addresses the main pain point from the previous feedback: verbosity and non-idiomatic patterns.

**Next steps:** Update real-world Angular projects to v0.6.0 and enjoy the improved developer experience! 🎉

