# @daltonr/pathwrite-angular

Angular `@Injectable` facade over `@daltonr/pathwrite-core`. Exposes path state and events as RxJS observables that work seamlessly with Angular signals, the `async` pipe, and `takeUntilDestroyed`.

## Setup

Provide `PathFacade` at the component level so each component gets its own isolated path instance, and Angular handles cleanup automatically via `ngOnDestroy`.

```typescript
@Component({
  // ...
  providers: [PathFacade]
})
export class MyComponent {
  protected readonly facade = inject(PathFacade);

  // Reactive snapshot — updates whenever the path state changes
  public readonly snapshot = toSignal(this.facade.state$, { initialValue: null });

  constructor() {
    // Automatically unsubscribes when the component is destroyed
    this.facade.events$.pipe(takeUntilDestroyed()).subscribe((event) => {
      console.log(event);
    });
  }
}
```

## PathFacade API

### Observables and signals

| Member | Type | Description |
|--------|------|-------------|
| `state$` | `Observable<PathSnapshot \| null>` | Current snapshot. `null` when no path is active. Backed by a `BehaviorSubject` — late subscribers receive the current value immediately. |
| `stateSignal` | `Signal<PathSnapshot \| null>` | Signal version of `state$`. Same value, updated synchronously. Use directly in signal-based components without `toSignal()`. |
| `events$` | `Observable<PathEvent>` | All engine events: `stateChanged`, `completed`, `cancelled`, `resumed`. |

### Methods

| Method | Description |
|--------|-------------|
| `start(definition, data?)` | Start or re-start a path. |
| `restart(definition, data?)` | Tear down any active path (without firing hooks) and start the given path fresh. Safe to call at any time. Use for "Start over" / retry flows. |
| `startSubPath(definition, data?, meta?)` | Push a sub-path. Requires an active path. `meta` is returned unchanged to `onSubPathComplete` / `onSubPathCancel`. |
| `next()` | Advance one step. Completes the path on the last step. |
| `previous()` | Go back one step. No-op when already on the first step of a top-level path. |
| `cancel()` | Cancel the active path (or sub-path). |
| `setData(key, value)` | Update a single data value; emits `stateChanged`. When `TData` is specified, `key` and `value` are type-checked against your data shape. |
| `goToStep(stepId)` | Jump directly to a step by ID. Calls `onLeave`/`onEnter`; bypasses guards and `shouldSkip`. |
| `goToStepChecked(stepId)` | Jump to a step by ID, checking `canMoveNext` (forward) or `canMovePrevious` (backward) first. Blocked if the guard returns false. |
| `snapshot()` | Synchronous read of the current `PathSnapshot \| null`. |

`PathFacade` accepts an optional generic `PathFacade<TData>`. Because Angular's DI cannot carry generics at runtime, narrow it with a cast at the injection site:

```typescript
protected readonly facade = inject(PathFacade) as PathFacade<MyData>;
facade.snapshot()?.data.name; // typed as string (or whatever MyData defines)
```

---

## Angular Forms integration — `syncFormGroup`

`syncFormGroup` eliminates the boilerplate of manually wiring an Angular
`FormGroup` to the path engine. Call it once (typically in `ngOnInit`) and every
form value change is automatically propagated to the engine via `setData`, keeping
`canMoveNext` guards reactive without any manual plumbing.

```typescript
import { PathFacade, syncFormGroup } from "@daltonr/pathwrite-angular";

@Component({
  providers: [PathFacade],
  template: `
    <form [formGroup]="form">
      <input formControlName="name" />
      <input formControlName="email" />
    </form>
    <button [disabled]="!(snapshot()?.canMoveNext)" (click)="facade.next()">Next</button>
  `
})
export class DetailsStepComponent implements OnInit {
  protected readonly facade  = inject(PathFacade);
  protected readonly snapshot = toSignal(this.facade.state$, { initialValue: null });

  protected readonly form = new FormGroup({
    name:  new FormControl('', Validators.required),
    email: new FormControl('', [Validators.required, Validators.email]),
  });

  async ngOnInit() {
    await this.facade.start(myPath, { name: '', email: '' });
    // Immediately syncs current form values and keeps them in sync on every change.
    // Cleanup is automatic when the component is destroyed.
    syncFormGroup(this.facade, this.form, inject(DestroyRef));
  }
}
```

The corresponding path definition can now use a clean `canMoveNext` guard with no
manual sync code in the template:

```typescript
const myPath: PathDefinition = {
  id: 'registration',
  steps: [
    {
      id: 'details',
      canMoveNext: (ctx) =>
        typeof ctx.data.name  === 'string' && ctx.data.name.trim().length > 0 &&
        typeof ctx.data.email === 'string' && ctx.data.email.includes('@'),
    },
    { id: 'review' },
  ],
};
```

### `syncFormGroup` signature

```typescript
function syncFormGroup(
  facade:     PathFacade,
  formGroup:  FormGroupLike,
  destroyRef?: DestroyRef
): () => void
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `facade` | `PathFacade` | The facade to write values into. |
| `formGroup` | `FormGroupLike` | Any Angular `FormGroup` (or any object satisfying the duck interface). |
| `destroyRef` | `DestroyRef` *(optional)* | Pass `inject(DestroyRef)` to auto-unsubscribe on component destroy. |
| **returns** | `() => void` | Cleanup function — call manually if not using `DestroyRef`. |

#### Behaviour details

- **Immediate sync** — current `getRawValue()` is written on the first call, so
  guards evaluate against the real form state from the first snapshot.
- **Disabled controls included** — uses `getRawValue()` (not `formGroup.value`)
  so disabled controls are always synced.
- **Safe before `start()`** — if no path is active when a change fires, the call
  is silently ignored (no error).
- **`FormGroupLike` duck interface** — `@angular/forms` is not a required import;
  any object with `getRawValue()` and `valueChanges` works.

### Lifecycle

`PathFacade` implements `OnDestroy`. When Angular destroys the providing component, `ngOnDestroy` is called automatically, which:
- Unsubscribes from the internal `PathEngine`
- Completes `state$` and `events$`

## Using with signals (Angular 16+)

`PathFacade` ships a pre-wired `stateSignal` so no manual `toSignal()` call is
needed:

```typescript
@Component({ providers: [PathFacade] })
export class MyComponent {
  protected readonly facade = inject(PathFacade);

  // Use stateSignal directly — no toSignal() required
  protected readonly snapshot = this.facade.stateSignal;

  // Derive computed values
  public readonly isActive    = computed(() => this.snapshot() !== null);
  public readonly currentStep = computed(() => this.snapshot()?.stepId ?? null);
  public readonly canAdvance  = computed(() => this.snapshot()?.canMoveNext ?? false);
}
```

If you prefer the Observable-based approach, `toSignal()` still works as before:

```typescript
public readonly snapshot = toSignal(this.facade.state$, { initialValue: null });
```

## Using with the async pipe

```html
<ng-container *ngIf="facade.state$ | async as s">
  <p>{{ s.pathId }} / {{ s.stepId }}</p>
</ng-container>
```

## Peer dependencies

| Package | Version |
|---------|---------|
| `@angular/core` | `>=16.0.0` |
| `rxjs` | `>=7.0.0` |

---

## Default UI — `<pw-shell>`

The Angular adapter ships an optional shell component that renders a complete progress indicator, step content area, and navigation buttons out of the box. You only need to define the per-step content.

The shell lives in a separate entry point so that headless-only usage does not pull in the Angular compiler:

```typescript
import {
  PathShellComponent,
  PathStepDirective,
  PathShellHeaderDirective,
  PathShellFooterDirective,
} from "@daltonr/pathwrite-angular/shell";
```

### Usage

```typescript
@Component({
  imports: [PathShellComponent, PathStepDirective],
  template: `
    <pw-shell [path]="myPath" [initialData]="{ name: '' }" (completed)="onDone($event)">
      <ng-template pwStep="details"><app-details-form /></ng-template>
      <ng-template pwStep="review"><app-review-panel /></ng-template>
    </pw-shell>
  `
})
export class MyComponent {
  protected myPath = coursePath;
  protected onDone(data: PathData) { console.log("Done!", data); }
}
```

Each `<ng-template pwStep="<stepId>">` is rendered when the active step matches `stepId`. The shell handles all navigation internally.

### Context sharing

`PathShellComponent` provides a `PathFacade` instance in its own `providers` array
and passes its component-level `Injector` to every step template via
`ngTemplateOutletInjector`. Step components can therefore resolve the shell's
`PathFacade` directly via `inject()` — no extra provider setup required:

```typescript
// Step component — inject(PathFacade) resolves the shell's instance automatically
@Component({
  template: `
    <input [value]="snapshot()?.data?.['name'] ?? ''"
           (input)="facade.setData('name', $event.target.value)" />
  `
})
export class DetailsFormComponent {
  protected readonly facade   = inject(PathFacade);
  protected readonly snapshot = this.facade.stateSignal;
}
```

The parent component hosting `<pw-shell>` does **not** need its own
`PathFacade` provider. To access the facade from the parent, use `@ViewChild`:

```typescript
@Component({
  imports: [PathShellComponent, PathStepDirective],
  template: `
    <pw-shell #shell [path]="myPath" (completed)="onDone($event)">
      <ng-template pwStep="details"><app-details-form /></ng-template>
    </pw-shell>
  `
})
export class MyComponent {
  @ViewChild('shell', { read: PathShellComponent }) shell!: PathShellComponent;
  protected onDone(data: PathData) { console.log('done', data); }
}
```

### Inputs

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `path` | `PathDefinition` | *required* | The path definition to drive. |
| `initialData` | `PathData` | `{}` | Initial data passed to `facade.start()`. |
| `autoStart` | `boolean` | `true` | Start the path automatically on `ngOnInit`. |
| `backLabel` | `string` | `"Back"` | Back button label. |
| `nextLabel` | `string` | `"Next"` | Next button label. |
| `finishLabel` | `string` | `"Finish"` | Finish button label (last step). |
| `cancelLabel` | `string` | `"Cancel"` | Cancel button label. |
| `hideCancel` | `boolean` | `false` | Hide the Cancel button. |
| `hideProgress` | `boolean` | `false` | Hide the progress indicator. |

### Outputs

| Output | Payload | Description |
|--------|---------|-------------|
| `(completed)` | `PathData` | Emitted when the path finishes naturally. |
| `(cancelled)` | `PathData` | Emitted when the path is cancelled. |
| `(pathEvent)` | `PathEvent` | Emitted for every engine event. |

### Customising the header and footer

Use `pwShellHeader` and `pwShellFooter` directives to replace the built-in progress bar or navigation buttons with your own templates. Both are declared on `<ng-template>` elements inside the shell.

**`pwShellHeader`** — receives the current `PathSnapshot` as the implicit template variable:

```typescript
@Component({
  imports: [PathShellComponent, PathStepDirective, PathShellHeaderDirective],
  template: `
    <pw-shell [path]="myPath">
      <ng-template pwShellHeader let-s>
        <p>Step {{ s.stepIndex + 1 }} of {{ s.stepCount }} — {{ s.stepTitle }}</p>
      </ng-template>
      <ng-template pwStep="details"><app-details-form /></ng-template>
      <ng-template pwStep="review"><app-review-panel /></ng-template>
    </pw-shell>
  `
})
export class MyComponent { ... }
```

**`pwShellFooter`** — receives the snapshot as the implicit variable and an `actions` variable with all navigation callbacks:

```typescript
@Component({
  imports: [PathShellComponent, PathStepDirective, PathShellFooterDirective],
  template: `
    <pw-shell [path]="myPath">
      <ng-template pwShellFooter let-s let-actions="actions">
        <button (click)="actions.previous()" [disabled]="s.isFirstStep || s.isNavigating">Back</button>
        <button (click)="actions.next()"     [disabled]="!s.canMoveNext || s.isNavigating">
          {{ s.isLastStep ? 'Finish' : 'Next' }}
        </button>
      </ng-template>
      <ng-template pwStep="details"><app-details-form /></ng-template>
    </pw-shell>
  `
})
export class MyComponent { ... }
```

`actions` (`PathShellActions`) contains: `next`, `previous`, `cancel`, `goToStep`, `goToStepChecked`, `setData`, `restart`. All return `Promise<void>`.

`restart()` restarts the shell's own `[path]` input with its own `[initialData]` input — useful for a "Start over" button in a custom footer.

Both directives can be combined. Only the sections you override are replaced — a custom header still shows the default footer, and vice versa.

---

## Styling

Import the optional stylesheet for sensible default styles. All visual values are CSS custom properties (`--pw-*`) so you can theme without overriding selectors.

### In `angular.json` (recommended)

```json
"styles": [
  "src/styles.css",
  "node_modules/@daltonr/pathwrite-angular/dist/index.css"
]
```

### In a global stylesheet

```css
@import "@daltonr/pathwrite-angular/styles.css";
```

### Theming

Override any `--pw-*` variable to customise the appearance:

```css
:root {
  --pw-color-primary: #8b5cf6;
  --pw-shell-radius: 12px;
}
```
