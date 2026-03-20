# @pathwrite/angular-adapter

Angular `@Injectable` facade over `@pathwrite/core`. Exposes path state and events as RxJS observables that work seamlessly with Angular signals, the `async` pipe, and `takeUntilDestroyed`.

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
