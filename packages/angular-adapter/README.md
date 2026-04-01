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
import { injectPath } from "@daltonr/pathwrite-angular";

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
  protected readonly path = injectPath();
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
| `restart(definition, data?)` | Tear down any active path and start fresh. Safe to call at any time. |
| `next()` | Advance one step. Completes the path on the last step. |
| `previous()` | Go back one step. No-op on the first step of a top-level path. |
| `cancel()` | Cancel the active path (or sub-path). |
| `goToStep(stepId)` | Jump to a step by ID. Calls `onLeave`/`onEnter`; bypasses guards. |
| `goToStepChecked(stepId)` | Jump to a step by ID, checking the current step's guard first. |
| `setData(key, value)` | Update a single data field. Type-safe when `TData` is specified. |
| `startSubPath(definition, data?, meta?)` | Push a sub-path. `meta` is returned to `onSubPathComplete`/`onSubPathCancel`. |
| `adoptEngine(engine)` | Adopt an externally-managed `PathEngine` (e.g. from `restoreOrStart()`). |

## `<pw-shell>` inputs/outputs

Step content is provided via `<ng-template pwStep="stepId">` directives inside `<pw-shell>`. The `pwStep` string must exactly match the step's `id`.

### Inputs

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `path` | `PathDefinition` | required | Path definition to drive. Mutually exclusive with `engine`. |
| `initialData` | `PathData` | `{}` | Initial data passed to `facade.start()`. |
| `engine` | `PathEngine` | — | Externally-managed engine (e.g. from `restoreOrStart()`). Suppresses `autoStart`. |
| `autoStart` | `boolean` | `true` | Start the path on `ngOnInit`. Ignored when `engine` is provided. |
| `validationDisplay` | `"summary" \| "inline" \| "both"` | `"summary"` | Where `fieldErrors` are rendered. Use `"inline"` so step components render their own errors. |
| `loadingLabel` | `string` | — | Label shown while the path is navigating. |
| `layout` | `"wizard" \| "form" \| "auto" \| "tabs"` | `"auto"` | `"wizard"`: Back on left, Cancel+Submit on right. `"form"`: Cancel on left, Submit on right, no Back. `"tabs"`: No progress header or footer — for tabbed interfaces. `"auto"` picks `"form"` for single-step paths. |
| `hideProgress` | `boolean` | `false` | Hide the progress indicator. Also hidden automatically for single-step paths. |
| `backLabel` | `string` | `"Previous"` | Previous button label. |
| `nextLabel` | `string` | `"Next"` | Next button label. |
| `completeLabel` | `string` | `"Complete"` | Complete button label (last step). |
| `cancelLabel` | `string` | `"Cancel"` | Cancel button label. |
| `hideCancel` | `boolean` | `false` | Hide the Cancel button. |
| `services` | `unknown` | `null` | Arbitrary services object available to step components via `usePathContext<TData, TServices>().services`. |

### Outputs

| Output | Payload | Description |
|--------|---------|-------------|
| `(complete)` | `PathData` | Emitted when the path finishes naturally. |
| `(cancel)` | `PathData` | Emitted when the path is cancelled. |
| `(event)` | `PathEvent` | Emitted for every engine event. |

### Completion content

When `completionBehaviour` is `"stayOnFinal"` (the default), `<pw-shell>` renders a completion panel once `snapshot.status === "completed"`. Use the `[pwShellCompletion]` directive to replace the default "All done." panel with a custom template. The template receives the completed snapshot as its implicit context:

```typescript
import { PathShellCompletionDirective } from "@daltonr/pathwrite-angular/shell";

@Component({
  imports: [PathShellComponent, PathStepDirective, PathShellCompletionDirective],
  template: `
    <pw-shell [path]="path" [initialData]="{ name: '' }">
      <ng-template pwShellCompletion let-s>
        <div class="done-panel">
          <h2>Thanks, {{ s.data.name }}!</h2>
          <button (click)="facade.restart()">Start over</button>
        </div>
      </ng-template>
      <ng-template pwStep="details"><app-details-form /></ng-template>
    </pw-shell>
  `
})
export class MyWizardComponent {
  protected readonly path = myPath;
  protected readonly facade = usePathContext();
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
  // path.next(), path.previous(), path.cancel(), etc.
  // path.services — typed as TServices
}
```

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

## Further reading

- [Angular getting started guide](../../docs/getting-started/frameworks/angular.md)
- [Navigation & guards](../../docs/guides/navigation.md)
- [Full documentation](../../docs/README.md)

---

© 2026 Devjoy Ltd. MIT License.
