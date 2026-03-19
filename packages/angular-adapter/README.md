# @pathwrite/angular-adapter

Angular `@Injectable` facade over `@pathwrite/core`. Exposes wizard state and events as RxJS observables that work seamlessly with Angular signals, the `async` pipe, and `takeUntilDestroyed`.

## Setup

Provide `WizardFacade` at the component level so each component gets its own isolated wizard instance, and Angular handles cleanup automatically via `ngOnDestroy`.

```typescript
@Component({
  // ...
  providers: [WizardFacade]
})
export class MyComponent {
  protected readonly facade = inject(WizardFacade);

  // Reactive snapshot — updates whenever the wizard state changes
  public readonly snapshot = toSignal(this.facade.state$, { initialValue: null });

  constructor() {
    // Automatically unsubscribes when the component is destroyed
    this.facade.events$.pipe(takeUntilDestroyed()).subscribe((event) => {
      console.log(event);
    });
  }
}
```

## WizardFacade API

### Observables

| Member | Type | Description |
|--------|------|-------------|
| `state$` | `Observable<WizardSnapshot \| null>` | Current snapshot. `null` when no wizard is active. Backed by a `BehaviorSubject` — late subscribers receive the current value immediately. |
| `events$` | `Observable<WizardEngineEvent>` | All engine events: `stateChanged`, `completed`, `cancelled`, `resumed`. |

### Methods

| Method | Description |
|--------|-------------|
| `start(definition, initialArgs?)` | Start or re-start a wizard. |
| `startSubWizard(definition, args?)` | Push a sub-wizard. Requires an active wizard. |
| `next()` | Advance one step. Completes the wizard on the last step. |
| `previous()` | Go back one step. Cancels the wizard from the first step. |
| `cancel()` | Cancel the active wizard (or sub-wizard). |
| `setArg(key, value)` | Update a single arg; emits `stateChanged`. |
| `snapshot()` | Synchronous read of the current `WizardSnapshot \| null`. |

### Lifecycle

`WizardFacade` implements `OnDestroy`. When Angular destroys the providing component, `ngOnDestroy` is called automatically, which:
- Unsubscribes from the internal `WizardEngine`
- Completes `state$` and `events$`

## Using with signals (Angular 16+)

```typescript
public readonly snapshot = toSignal(this.facade.state$, { initialValue: null });

// Derive computed values from the snapshot signal
public readonly isActive = computed(() => this.snapshot() !== null);
public readonly currentStep = computed(() => this.snapshot()?.stepId ?? null);
```

## Using with the async pipe

```html
<ng-container *ngIf="facade.state$ | async as s">
  <p>{{ s.wizardId }} / {{ s.stepId }}</p>
</ng-container>
```

## Peer dependencies

| Package | Version |
|---------|---------|
| `@angular/core` | `>=16.0.0` |
| `rxjs` | `>=7.0.0` |

