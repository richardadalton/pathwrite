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

### Observables

| Member | Type | Description |
|--------|------|-------------|
| `state$` | `Observable<PathSnapshot \| null>` | Current snapshot. `null` when no path is active. Backed by a `BehaviorSubject` — late subscribers receive the current value immediately. |
| `events$` | `Observable<PathEvent>` | All engine events: `stateChanged`, `completed`, `cancelled`, `resumed`. |

### Methods

| Method | Description |
|--------|-------------|
| `start(definition, data?)` | Start or re-start a path. |
| `startSubPath(definition, data?)` | Push a sub-path. Requires an active path. |
| `next()` | Advance one step. Completes the path on the last step. |
| `previous()` | Go back one step. Cancels the path from the first step. |
| `cancel()` | Cancel the active path (or sub-path). |
| `setData(key, value)` | Update a single data value; emits `stateChanged`. |
| `goToStep(stepId)` | Jump directly to a step by ID. |
| `snapshot()` | Synchronous read of the current `PathSnapshot \| null`. |

### Lifecycle

`PathFacade` implements `OnDestroy`. When Angular destroys the providing component, `ngOnDestroy` is called automatically, which:
- Unsubscribes from the internal `PathEngine`
- Completes `state$` and `events$`

## Using with signals (Angular 16+)

```typescript
public readonly snapshot = toSignal(this.facade.state$, { initialValue: null });

// Derive computed values from the snapshot signal
public readonly isActive    = computed(() => this.snapshot() !== null);
public readonly currentStep = computed(() => this.snapshot()?.stepId ?? null);
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
import { PathShellComponent, PathStepDirective } from "@daltonr/pathwrite-angular/shell";
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

`PathShellComponent` provides a `PathFacade` instance at the component level.
Step templates are **declared in the parent** component and rendered via
`*ngTemplateOutlet`. Angular resolves DI for embedded views from the *declaring*
component's injector, not the shell's. The recommended pattern is to provide
`PathFacade` in the **parent** that hosts `<pw-shell>`:

```typescript
// Parent component — owns the pw-shell and provides the facade
@Component({
  imports: [PathShellComponent, PathStepDirective],
  providers: [PathFacade],
  template: `
    <pw-shell [path]="myPath" [initialData]="{ name: '' }" (completed)="onDone($event)">
      <ng-template pwStep="details"><app-details-form /></ng-template>
      <ng-template pwStep="review"><app-review-panel /></ng-template>
    </pw-shell>
  `
})
export class MyComponent {
  protected readonly facade = inject(PathFacade);
  protected readonly snapshot = toSignal(this.facade.state$, { initialValue: null });
  protected onDone(data: PathData) { console.log("Done!", data); }
}

// Step component — injects from the same parent provider
@Component({
  template: `
    <input [value]="snapshot()?.data?.['name'] ?? ''"
           (input)="facade.setData('name', $event.target.value)" />
  `
})
export class DetailsFormComponent {
  protected readonly facade = inject(PathFacade);
  protected readonly snapshot = toSignal(this.facade.state$, { initialValue: null });
}
```

> **Note:** Do not add a separate `providers: [PathFacade]` inside the parent
> alongside the `<pw-shell>` — the shell creates its own internal instance.
> Provide `PathFacade` once at the parent level and let both the parent and step
> components inject from that single provider.

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
