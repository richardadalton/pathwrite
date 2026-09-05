# @daltonr/pathwrite-angular

Angular adapter for `@daltonr/pathwrite-core` — `PathFacade` injectable service with RxJS observables, Angular signals, and an optional `<pw-shell>` UI component.

## Installation

```bash
npm install @daltonr/pathwrite-core @daltonr/pathwrite-angular
```

Peer dependencies: Angular 17+, RxJS 7+.

## Quick start

```typescript
// job-application.component.ts
import { Component } from "@angular/core";
import {
  PathShellComponent,
  PathStepDirective,
} from "@daltonr/pathwrite-angular/shell";
import { PathFacade } from "@daltonr/pathwrite-angular";
import type { PathData } from "@daltonr/pathwrite-angular";
import { applicationPath } from "./application-path";
import { DetailsStepComponent } from "./details-step.component";
import { ReviewStepComponent } from "./review-step.component";

@Component({
  standalone: true,
  providers: [PathFacade],
  imports: [PathShellComponent, PathStepDirective, DetailsStepComponent, ReviewStepComponent],
  template: `
    <pw-shell
      [path]="path"
      [initialData]="{ name: '', email: '' }"
      (complete)="onDone($event)"
    >
      <ng-template pwStep="details">
        <app-details-step />
      </ng-template>
      <ng-template pwStep="review">
        <app-review-step />
      </ng-template>
    </pw-shell>
  `
})
export class JobApplicationComponent {
  protected readonly path = applicationPath;
  protected onDone(data: PathData): void {
    console.log("Submitted:", data);
  }
}
```

```typescript
// details-step.component.ts
import { Component } from "@angular/core";
import { usePathContext } from "@daltonr/pathwrite-angular";

@Component({
  selector: "app-details-step",
  standalone: true,
  template: `
    @if (path.snapshot(); as s) {
      <input
        [value]="s.data['name'] ?? ''"
        (input)="path.setData('name', $any($event.target).value)"
        placeholder="Name"
      />
      <input
        type="email"
        [value]="s.data['email'] ?? ''"
        (input)="path.setData('email', $any($event.target).value)"
        placeholder="Email"
      />
    }
  `
})
export class DetailsStepComponent {
  protected readonly path = usePathContext();
}
```

## PathFacade

`PathFacade` must be provided at the **component level** (not root) so each wizard gets its own isolated engine instance and Angular destroys it automatically when the component is destroyed.

```typescript
@Component({ providers: [PathFacade] })
export class MyWizardComponent { }
```

### Observables and signals

| Member | Type | Description |
|--------|------|-------------|
| `state$` | `Observable<PathSnapshot \| null>` | Current snapshot. Backed by a `BehaviorSubject` — late subscribers receive the current value immediately. |
| `stateSignal` | `Signal<PathSnapshot \| null>` | Pre-wired signal version of `state$`. Use directly without `toSignal()`. |
| `events$` | `Observable<PathEvent>` | All engine events: `stateChanged`, `completed`, `cancelled`, `resumed`. |

### Methods

| Method | Description |
|--------|-------------|
| `snapshot()` | Synchronous read of the current `PathSnapshot \| null`. |
| `start(definition, data?)` | Start or re-start a path. |
| `restart()` | Tear down any active path (without firing hooks) and restart the root path with the `initialData` from the original `start()`. Takes no arguments; rejects if nothing has been started. |
| `next()` | Advance one step. Completes the path on the last step. |
| `previous()` | Go back one step. No-op on the first step of a top-level path. |
| `cancel()` | Cancel the active path (or sub-path). |
| `goToStep(stepId)` | Jump to a step by ID. Calls `onLeave`/`onEnter`; bypasses guards. |
| `goToStepChecked(stepId)` | Jump to a step by ID, checking the current step's guard first. |
| `setData(key, value)` | Update a single data field. Type-safe when `TData` is specified. |
| `resetStep()` | Restore the current step's data to what it was when the step was entered. Emits `stateChanged` with cause `"resetStep"`; no hooks run. |
| `retry()` | Re-run the operation that set `snapshot().error`. Increments `retryCount` on repeated failure. No-op when there is no pending error. |
| `suspend()` | Pause the path with intent to return. Emits `suspended`; all state and data are preserved. |
| `startSubPath(definition, data?, meta?)` | Push a sub-path. `meta` is returned to `onSubPathComplete`/`onSubPathCancel`. |
| `adoptEngine(engine)` | Adopt an externally-managed `PathEngine` (e.g. from `restoreOrStart()`). |
| `validate()` | Set `snapshot().hasValidated` without navigating. Triggers all inline field errors simultaneously. Used to validate all tabs in a nested shell at once. |

## `<pw-shell>` inputs/outputs

Step content is provided via `<ng-template pwStep="stepId">` directives inside `<pw-shell>`. The `pwStep` string must exactly match the step's `id`.

### Inputs

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `path` | `PathDefinition` | — | Path definition to drive. Required unless `engine` is provided. |
| `initialData` | `PathData` | `{}` | Initial data passed to `facade.start()`. Overridden by the stored snapshot when `restoreKey` is set. |
| `engine` | `PathEngine` | — | Externally-managed engine (e.g. from `restoreOrStart()`). Suppresses `autoStart`. |
| `autoStart` | `boolean` | `true` | Start the path on `ngOnInit`. Ignored when `engine` is provided. |
| `validationDisplay` | `"summary" \| "inline" \| "both"` | `"summary"` | Where `fieldErrors` are rendered. Use `"inline"` so step components render their own errors. |
| `loadingLabel` | `string` | `undefined` | Label for the Next/Complete button while an async operation is in progress. When unset, the button keeps its label and shows a CSS spinner. |
| `layout` | `"wizard" \| "form" \| "auto" \| "tabs"` | `"auto"` | `"wizard"`: Back on left, Cancel+Submit on right. `"form"`: Cancel on left, Submit on right, no Back. `"tabs"`: No progress header or footer — for tabbed interfaces. `"auto"` picks `"form"` for single-step paths. |
| `progressLayout` | `"merged" \| "split" \| "rootOnly" \| "activeOnly"` | `"merged"` | How the root and sub-path progress bars are arranged while a sub-path is active. |
| `hideProgress` | `boolean` | `false` | Hide the progress indicator. Also hidden automatically for single-step paths. |
| `hideFooter` | `boolean` | `false` | Hide the footer (navigation buttons). The error panel is still shown on async failure. |
| `backLabel` | `string` | `"Previous"` | Previous button label. |
| `nextLabel` | `string` | `"Next"` | Next button label. |
| `completeLabel` | `string` | `"Complete"` | Complete button label (last step). |
| `cancelLabel` | `string` | `"Cancel"` | Cancel button label. |
| `hideCancel` | `boolean` | `false` | Hide the Cancel button. |
| `services` | `unknown` | `null` | Arbitrary services object available to step components via `usePathContext<TData, TServices>().services`. |
| `validateWhen` | `boolean` | `false` | When `true` (including already at mount), calls `validate()` on the facade so all steps show inline errors at once. Bind to the outer snapshot's `hasAttemptedNext` when this shell is nested inside a step of an outer shell. |
| `restoreKey` | `string` | — | When set, the shell automatically saves its full state (data + active step) into the nearest outer `<pw-shell>`'s data under this key on every change, and restores from it on remount. No-op on a top-level shell. |

### Outputs

| Output | Payload | Description |
|--------|---------|-------------|
| `(complete)` | `PathData` | Emitted when the path finishes naturally. |
| `(cancel)` | `PathData` | Emitted when the path is cancelled. |
| `(event)` | `PathEvent` | Emitted for every engine event. |

### Custom header and footer

Use `pwShellHeader` and `pwShellFooter` templates (`PathShellHeaderDirective`, `PathShellFooterDirective`) to replace the built-in sections. The header template receives the `PathSnapshot` as implicit context and is shown even for single-step paths (hidden under `hideProgress` or `layout="tabs"`). The footer template receives the snapshot plus `actions` (`PathShellActions`: `next`, `previous`, `cancel`, `goToStep`, `goToStepChecked`, `setData`, `restart`, `retry`, `suspend`, all returning `Promise<void>`):

```html
<pw-shell [path]="path">
  <ng-template pwShellHeader let-s>
    <p>Step {{ s.stepIndex + 1 }} of {{ s.stepCount }} — {{ s.stepTitle }}</p>
  </ng-template>
  <ng-template pwShellFooter let-s let-actions="actions">
    <button (click)="actions.previous()" [disabled]="s.isFirstStep || s.status !== 'idle'">Back</button>
    <button (click)="actions.next()" [disabled]="s.status !== 'idle'">{{ s.isLastStep ? 'Submit' : 'Continue' }}</button>
  </ng-template>
  <ng-template pwStep="details"><app-details-step /></ng-template>
</pw-shell>
```

The component also exposes `restart()` for template references (`<pw-shell #shell>` … `shell.restart()`), which restarts the path with its original `initialData` without destroying the component.

### Completion content

When `completionBehaviour` is `"stayOnFinal"` (the default), `<pw-shell>` renders a completion panel once `snapshot.status === "completed"`. Use the `[pwShellCompletion]` directive to replace the default "All done." panel with a custom template. The template receives the completed snapshot as its implicit context:

```typescript
import { PathShellCompletionDirective } from "@daltonr/pathwrite-angular/shell";

@Component({
  imports: [PathShellComponent, PathStepDirective, PathShellCompletionDirective],
  template: `
    <pw-shell #shell [path]="path" [initialData]="{ name: '' }">
      <ng-template pwShellCompletion let-s>
        <div class="done-panel">
          <h2>Thanks, {{ s.data.name }}!</h2>
          <button (click)="shell.restart()">Start over</button>
        </div>
      </ng-template>
      <ng-template pwStep="details"><app-details-form /></ng-template>
    </pw-shell>
  `
})
export class MyWizardComponent {
  protected readonly path = myPath;
}
```

## `usePathContext()`

`usePathContext()` is the preferred API for step components and forms rendered inside `<pw-shell>`. It resolves the `PathFacade` from the nearest injector in the tree and returns a signal-based interface typed with optional `TData` and `TServices` generics — no `providers: [PathFacade]` needed in step components.

```typescript
import { usePathContext } from "@daltonr/pathwrite-angular";

export class DetailsStepComponent {
  protected readonly path = usePathContext<ApplicationData>();
  // path.snapshot() — Signal<PathSnapshot | null>
  // path.setData(key, value) — type-safe with TData
  // path.next(), path.previous(), path.cancel(), path.resetStep(), path.restart(), path.retry(), path.suspend()
  // path.services — typed as TServices
}
```

`validate()` is not on this object — bind the shell's `[validateWhen]` input, or call `inject(PathFacade).validate()` directly.

### Passing services to step components

Use the `[services]` input on `<pw-shell>` to provide shared dependencies (API clients, feature flags, etc.) to all step components without prop-drilling:

```typescript
// In the wizard host component:
@Component({
  template: `
    <pw-shell [path]="path" [services]="svc">
      <ng-template pwStep="details"><app-details /></ng-template>
    </pw-shell>
  `
})
export class WizardComponent {
  protected readonly svc: HiringServices = { api: inject(HiringApi) };
}

// In a step component:
export class DetailsStepComponent {
  protected readonly path = usePathContext<HiringData, HiringServices>();
  // this.path.services — typed as HiringServices
}
```

### Nested shells and `validateWhen`

When `<pw-shell>` is nested inside a step of an outer shell, bind `[validateWhen]` to the outer snapshot's `hasAttemptedNext`. This triggers `validate()` on the inner engine when the outer shell's user attempts to proceed, surfacing all inner field errors at once:

```typescript
@Component({
  selector: "app-contact-step",
  standalone: true,
  imports: [PathShellComponent, PathStepDirective],
  template: `
    <pw-shell
      [path]="contactTabsPath"
      [layout]="'tabs'"
      [validateWhen]="outerSnap()?.hasAttemptedNext ?? false"
    >
      <ng-template pwStep="name"><app-name-tab /></ng-template>
      <ng-template pwStep="address"><app-address-tab /></ng-template>
    </pw-shell>
  `
})
export class ContactStepComponent {
  protected readonly outerPath = usePathContext<ApplicationData>();
  protected readonly outerSnap = this.outerPath.snapshot;
  protected readonly contactTabsPath = contactTabsPath;
}
```

> **Do NOT add `providers: [PathFacade]` to step components.** Doing so creates a second, disconnected `PathFacade` instance scoped to that component — `snapshot()` will always be `null` inside it. `usePathContext()` resolves the shell's instance automatically via DI; no extra provider needed.

## Reactive forms — `syncFormGroup()`

`syncFormGroup(facade, formGroup, destroyRef?)` mirrors every control of an Angular `FormGroup` into the engine via `setData`, so guards and `fieldErrors` evaluate against the live form state. It writes `getRawValue()` immediately (disabled controls included), re-applies it on every `valueChanges` emission, skips writes while no path is active, and returns a cleanup function — pass a `DestroyRef` to unsubscribe automatically.

```typescript
import { DestroyRef, inject } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { PathFacade, syncFormGroup } from "@daltonr/pathwrite-angular";

export class DetailsStepComponent implements OnInit {
  private readonly facade = inject(PathFacade) as PathFacade<MyData>;
  protected readonly form = new FormGroup({
    name:  new FormControl("", Validators.required),
    email: new FormControl(""),
  });

  ngOnInit() {
    syncFormGroup(this.facade, this.form, inject(DestroyRef));
  }
}
```

Only `getRawValue()` and `valueChanges` are required (the `FormGroupLike` interface), so the adapter does not import `@angular/forms` itself.

## Further reading

- [Angular getting started guide](../../docs/getting-started/frameworks/angular.md)
- [Navigation & guards](../../docs/developer-guide/04-navigation.md)
- [Full documentation](../../docs/README.md)

---

© 2026 Devjoy Ltd. MIT License.
