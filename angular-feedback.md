# Pathwrite — Integration Feedback

Findings from building a document-approval workflow in Angular 21 using
`@daltonr/pathwrite-core@0.1.5` and `@daltonr/pathwrite-angular@0.1.5`.

---

## 🔴 Critical issues

### 1. `@daltonr/pathwrite-angular` is not compiled with the Angular compiler

> ✅ **Fixed.** The build script was changed from `tsc` to `ngc` with
> `compilationMode: "partial"` in `angularCompilerOptions`. The dist now contains
> proper partial-compilation Ivy artefacts (`ɵngDeclareComponent`,
> `ɵngDeclareDirective`, `ɵngDeclareInjectable`) that are compatible with the
> Angular linker for all Angular 14+ consumers regardless of minor version.
> `@angular/compiler` and `@angular/compiler-cli` were added as `devDependencies`.
> The root build pipeline was updated so `tsc -b` handles core/React/Vue, and a
> separate `ngc` call handles the Angular adapter.

**This was a showstopper for any AoT Angular application.**

The package's build script used plain `tsc` instead of Angular's `ngc`:

```json
// package.json in the angular adapter (before fix)
"build": "tsc -p tsconfig.json && cp ../shell.css dist/index.css"
```

As a result the compiled output contained no Angular Ivy metadata — no `ɵcmp`,
`ɵdir`, or `ɵfac` static fields on any of the exported classes. When you follow
the documented usage and add the shell to a component's `imports` array:

```typescript
imports: [PathShellComponent, PathStepDirective]  // as shown in the README
```

Angular's compiler immediately rejects it:

```
✘ NG2012: Component imports must be standalone components, directives, pipes,
  or must be NgModules.
```

**Workaround applied here:** Re-implement `PathFacade`, `PwShellComponent`, and
`PwStepDirective` locally in the consuming app, compiled by the app's own `ngc`.
These local wrappers delegate all engine logic to `@daltonr/pathwrite-core`
(which is plain JS and works perfectly). See `src/app/pathwrite/`.


---

### 2. `inject(PathFacade)` from step components does not work as documented

The README's "Context sharing" section explicitly shows step components calling
`inject(PathFacade)` to access the shell's facade instance:

```typescript
// From the README — presented as working out of the box
export class DetailsFormComponent {
  protected readonly facade = inject(PathFacade);
}
```

This **does not work**. `PwShellComponent` provides `PathFacade` in its own
`providers` array (component-level scope). Step templates are declared in the
*parent* component and are rendered by the shell via `*ngTemplateOutlet`. Angular
resolves DI for embedded views using the **declaring** component's injector, not
the rendering component's injector. The shell's `PathFacade` instance is therefore
invisible to step components.

The result is either a `NullInjectorError` (if `PathFacade` is not provided
anywhere else) or a silently different instance (if the parent also happens to
provide `PathFacade`).

**Workaround applied here:** Access the facade via `@ViewChild(PwShellComponent)`
from the parent component and pass data down through `facade.setData()` calls
triggered by form `(ngModelChange)` events.

**Fix options:**
- Pass the shell's injector to `ngTemplateOutlet` via the `ngTemplateOutletInjector`
  input (available since Angular 14):
  ```html
  <ng-container *ngTemplateOutlet="stepDir.templateRef; injector: shellInjector">
  ```
- Or document the `@ViewChild` pattern as the intended approach and remove the
  misleading example from the README.

---

## 🟠 Significant pain points

### 3. No Angular Forms integration

There is no bridge between Angular's `ReactiveFormsModule` / `FormsModule` and
the engine's `setData()` API. To keep `canMoveNext` guards reactive, every form
field must manually call `facade.setData(key, value)` on each change event:

```html
<input [(ngModel)]="form.title" (ngModelChange)="sync('title', $event)" />
```

This is verbose and error-prone at scale. A `ControlValueAccessor`-based helper
or a utility like `syncFormGroup(facade, formGroup)` would remove most of this
boilerplate.

---

### 4. No generic typing on `PathFacade`

`PathFacade` is not generic. `state$` is typed as
`Observable<PathSnapshot | null>`, where `PathSnapshot.data` is `PathData`
(`Record<string, unknown>`). Type-safe access to step data requires explicit
casts everywhere:

```typescript
// every canMoveNext guard and every step template looks like this
const title = ctx.data['title'] as string;
```

The core package *does* support `PathDefinition<TData>` — but that type
information is lost when you go through `PathFacade`. A generic `PathFacade<TData>`
would propagate type safety through to `state$`, `snapshot()`, and the event
callbacks.

---

### 5. No signal-native API for Angular 16+

`state$` is an RxJS Observable (backed by a `BehaviorSubject`). The README
mentions `toSignal()` as an optional wrapper but doesn't ship it. In Angular 21,
signals are the primary reactive primitive. Providing a `stateSignal` alongside
`state$` — or even as a replacement — would align with the platform direction and
remove one manual wiring step for most consumers.

---

## 🟡 Minor issues and observations

### 6. `previous()` from the first step silently cancels the path

This is briefly noted in the core README but is easy to miss. In a typical
approval workflow, calling `previous()` when already on step 1 triggers a full
`cancelled` event and destroys all path state. There is no `isFirstStep` guard
built into the Back button visibility logic inside the shell (the template does
hide the Back button on `isFirstStep`, which helps) — but if a consumer calls
`facade.previous()` programmatically on step 1, the cancellation is silent.

**Suggestion:** Either throw a descriptive error, return a rejected promise, or
emit a distinct `"noop"` event so consumers can detect and handle the case
explicitly.

---

### 7. `goToStep()` bypasses all guards and `shouldSkip`

Documented as intentional, but worth highlighting for workflow use-cases. In an
approval flow, `goToStep('decide')` would let a reviewer skip the review step
entirely. There is currently no `goToStep` variant that respects guards. Consider
adding `goToStepChecked(stepId)` (or a `{ skipGuards: false }` option) for
consumers who need guard-safe direct navigation.

---

### 8. `autoStart` defaults to `true` with no obvious hint

The shell starts the path immediately on `ngOnInit` by default. This is convenient
but surprising when you expect to control start timing explicitly. The README
documents it in the inputs table, but there is no warning in the code or a visible
"Start" button placeholder to hint at the setting. A brief comment in the shell's
`@Input` declaration would help:

```typescript
/** Start the path automatically on init. Set to false to call doStart() manually. */
@Input() autoStart = true;
```

---

### 9. No inline validation messaging for `canMoveNext` failures

When a `canMoveNext` guard returns `false`, the Next button is disabled — but
there is no mechanism to surface *why*. Consumers must build their own validation
message logic in parallel with the guard. A `validationMessages?: (ctx) => string[]`
hook on `PathStep`, or an `invalidReasons` field on `PathSnapshot`, would let the
shell (or custom UIs) display contextual hints without duplicating guard logic.

---

### 10. Stale CSS comment in `index.css`

> ✅ **Fixed.** The comment in `shell.css` (the shared source stylesheet copied
> into each adapter's `dist/`) was updated to use generic framework descriptions
> rather than naming specific adapter packages. The Angular package no longer
> contains instructions referencing React and Vue.

The published stylesheet included a block comment referencing the React and Vue
packages. In the Angular package it was noise and potentially confusing.

---

## ✅ What works well

| Area | Notes |
|------|-------|
| **`@daltonr/pathwrite-core`** | Solid, zero-dependency engine. Clean API. Sub-path orchestration is genuinely useful. |
| **`canMoveNext` / `canMovePrevious` guards** | Reactive re-evaluation on `setData` works exactly as documented — very ergonomic once the data sync wiring is in place. |
| **Lifecycle hooks** | `onEnter`, `onLeave`, and `onSubPathComplete` cover the most common workflow needs cleanly. The patch-return pattern avoids direct mutation and is easy to follow. |
| **`shouldSkip`** | Elegant way to handle conditional steps without branching the path definition. |
| **Shell CSS custom properties** | `--pw-*` variables make theming straightforward. The default styles are clean and production-ready. |
| **`PathSnapshot` shape** | `isFirstStep`, `isLastStep`, `progress`, `stepCount`, `steps[]` with status — everything you need to build a progress indicator without any extra computation. |
| **`BehaviorSubject` backing `state$`** | Late subscribers immediately get the current state, which removes a whole class of timing bugs. |

---

## Summary

The **core engine is excellent** and ready for production use. The Angular adapter
needs one critical fix (compile with `ngc` / `ng-packagr`) and a correction to the
context-sharing documentation before it can be used without workarounds. The issues
in the 🟠 and 🟡 tiers are quality-of-life gaps rather than blockers, but
addressing them — especially generic typing and a forms bridge — would significantly
reduce the integration boilerplate.

