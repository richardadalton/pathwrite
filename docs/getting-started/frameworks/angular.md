# Getting Started — Angular

Pathwrite's Angular adapter provides `PathFacade`, an `@Injectable` service that exposes path state and events as RxJS observables and Angular signals. The recommended API for step components is `injectPath()`, which mirrors React's `usePathContext()` and Vue's `usePath()` for a consistent cross-framework experience.

## Installation

```bash
npm install @daltonr/pathwrite-core @daltonr/pathwrite-angular
```

Peer dependencies: `@angular/core >= 16.0.0`, `rxjs >= 7.0.0`.

All core types are re-exported from the Angular package:

```ts
import {
  PathFacade,
  injectPath,
  PathEngine,
  PathDefinition,
  PathData,
  PathSnapshot,
  PathEvent,
} from "@daltonr/pathwrite-angular";
```

The shell component is in a separate entry point so headless-only usage does not pull in the Angular compiler:

```ts
import {
  PathShellComponent,
  PathStepDirective,
  PathShellHeaderDirective,
  PathShellFooterDirective,
} from "@daltonr/pathwrite-angular/shell";
```

---

## `PathFacade` — injectable service

`PathFacade` is the core service. It owns the engine instance, bridges it to RxJS and signals, and handles cleanup via `ngOnDestroy`.

### Gotcha — always provide `PathFacade` at the component level

`PathFacade` **must be provided at the component level** (or a parent component), not in the root injector. This gives each wizard its own isolated engine instance and ensures Angular destroys it automatically when the providing component is destroyed.

```typescript
@Component({
  providers: [PathFacade],   // ← Required here, not in app root
})
export class MyWizardComponent {
  protected readonly facade = inject(PathFacade);
}
```

Providing `PathFacade` in `providers: [PathFacade]` at the root `AppModule` or a lazy-loaded module would share one engine instance across the entire application, which is almost never correct.

### Observables and signals

| Member | Type | Description |
|--------|------|-------------|
| `state$` | `Observable<PathSnapshot \| null>` | Current snapshot. `null` when no path is active. Backed by a `BehaviorSubject` — late subscribers receive the current value immediately. |
| `stateSignal` | `Signal<PathSnapshot \| null>` | Pre-wired signal version of `state$`. No `toSignal()` call needed. Use directly in signal-based components. |
| `events$` | `Observable<PathEvent>` | All engine events: `stateChanged`, `completed`, `cancelled`, `resumed`. |

### Methods

| Method | Description |
|--------|-------------|
| `start(definition, data?)` | Start or re-start a path. |
| `restart(definition, data?)` | Tear down any active path (without firing hooks) and start fresh. Safe to call at any time. |
| `startSubPath(definition, data?, meta?)` | Push a sub-path. Requires an active path. `meta` is returned unchanged to `onSubPathComplete` / `onSubPathCancel` on the parent step. |
| `next()` | Advance one step. Completes the path on the last step. |
| `previous()` | Go back one step. No-op on the first step of a top-level path. |
| `cancel()` | Cancel the active path (or sub-path). |
| `setData(key, value)` | Update a single data value. When `TData` is specified, `key` and `value` are type-checked against your data shape. |
| `goToStep(stepId)` | Jump directly to a step by ID. Calls `onLeave`/`onEnter`; bypasses guards and `shouldSkip`. |
| `goToStepChecked(stepId)` | Jump to a step by ID, checking the current step's guard first. |
| `adoptEngine(engine)` | Adopt an externally-managed `PathEngine`. The facade immediately reflects the engine's current state and forwards all subsequent events. |
| `snapshot()` | Synchronous read of the current `PathSnapshot \| null`. |

### Type parameter

`PathFacade` accepts an optional generic `PathFacade<TData>`. Because Angular's DI cannot carry generics at runtime, narrow it with a cast at the injection site:

```typescript
protected readonly facade = inject(PathFacade) as PathFacade<MyData>;
facade.snapshot()?.data.name; // typed as string (or whatever MyData defines)
```

---

## `injectPath()` — recommended API for step components

`injectPath()` is the recommended way to access the path engine from inside step components and forms. It resolves the `PathFacade` from the nearest injector in the tree and returns a clean, signal-based interface.

```typescript
import { injectPath } from "@daltonr/pathwrite-angular";

@Component({
  selector: "app-details-step",
  standalone: true,
  template: `
    @if (path.snapshot(); as s) {
      <input
        [value]="s.data.firstName ?? ''"
        (input)="path.setData('firstName', $any($event.target).value)"
      />
      @if (s.hasAttemptedNext && s.fieldErrors['firstName']) {
        <p class="error">{{ s.fieldErrors['firstName'] }}</p>
      }
    }
  `
})
export class DetailsStepComponent {
  protected readonly path = injectPath<ApplicationData>();
}
```

### `injectPath()` return value

| Member | Type | Description |
|--------|------|-------------|
| `snapshot` | `Signal<PathSnapshot \| null>` | Current path snapshot as a signal. `null` when no path is active. |
| `start(path, data?)` | `Promise<void>` | Start or restart a path. |
| `restart(path, data?)` | `Promise<void>` | Tear down and restart fresh. |
| `startSubPath(path, data?, meta?)` | `Promise<void>` | Push a sub-path onto the stack. |
| `next()` | `Promise<void>` | Advance one step. |
| `previous()` | `Promise<void>` | Go back one step. |
| `cancel()` | `Promise<void>` | Cancel the active path. |
| `setData(key, value)` | `Promise<void>` | Update a single data field. Type-safe when `TData` is specified. |
| `goToStep(stepId)` | `Promise<void>` | Jump to a step by ID (no guard check). |
| `goToStepChecked(stepId)` | `Promise<void>` | Jump to a step by ID (guard-checked). |

### Reading step data without local state

Rather than maintaining a local copy of form values, read directly from the signal in a computed getter. Angular tracks the signal read during template evaluation and re-renders automatically on any engine update (including back-navigation):

```typescript
export class DetailsStepComponent {
  protected readonly path = injectPath<ApplicationData>();

  protected get data(): ApplicationData {
    return (this.path.snapshot()?.data ?? {}) as ApplicationData;
  }
}
```

### Type-safe `setData` with a key variable

When passing a key as a variable to `setData`, use `string & keyof TData` to match the constraint — `keyof T` includes `number` and `symbol`, which `setData` does not accept:

```typescript
// ❌ Type error: keyof ApplicationData is string | number | symbol
protected update(field: keyof ApplicationData, value: string): void {
  this.path.setData(field, value);
}

// ✅ Correct
protected update(field: string & keyof ApplicationData, value: string): void {
  this.path.setData(field, value);
}
```

Inline string literals are always fine — this pattern only matters when the key is a variable.

---

## `<pw-shell>` — default UI component

The Angular shell component renders a progress indicator, step content area, validation messages, and navigation buttons. Step content is provided via `<ng-template pwStep="<stepId>">` directives.

### Basic usage

```typescript
import { Component } from "@angular/core";
import {
  PathShellComponent,
  PathStepDirective,
} from "@daltonr/pathwrite-angular/shell";
import { applicationPath } from "./application-path";

@Component({
  standalone: true,
  imports: [PathShellComponent, PathStepDirective],
  template: `
    <pw-shell
      [path]="path"
      [initialData]="{ firstName: '', email: '', coverNote: '' }"
      (complete)="onDone($event)"
    >
      <ng-template pwStep="details">
        <app-details-step />
      </ng-template>

      <ng-template pwStep="cover-note">
        <app-cover-note-step />
      </ng-template>
    </pw-shell>
  `
})
export class JobApplicationComponent {
  protected readonly path = applicationPath;
  protected onDone(data: PathData): void {
    console.log("Application submitted:", data);
  }
}
```

Each `<ng-template pwStep="<stepId>">` is instantiated and rendered when the active step matches `stepId`. The `pwStep` string must exactly match the step's `id`.

### Inputs

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `path` | `PathDefinition` | required | The path definition to drive. Required unless `[engine]` is provided. |
| `initialData` | `PathData` | `{}` | Initial data passed to `facade.start()`. |
| `engine` | `PathEngine` | — | An externally-managed engine. When provided, `autoStart` is suppressed. Use `@if (engine)` to gate mounting until the engine is ready. |
| `autoStart` | `boolean` | `true` | Start the path automatically on `ngOnInit`. Ignored when `[engine]` is provided. |
| `backLabel` | `string` | `"Previous"` | Previous button label. |
| `nextLabel` | `string` | `"Next"` | Next button label. |
| `completeLabel` | `string` | `"Complete"` | Complete button label (last step). |
| `cancelLabel` | `string` | `"Cancel"` | Cancel button label. |
| `hideCancel` | `boolean` | `false` | Hide the Cancel button. |
| `hideProgress` | `boolean` | `false` | Hide the progress indicator. Also hidden automatically for single-step top-level paths. |
| `footerLayout` | `"wizard" \| "form" \| "auto"` | `"auto"` | `"wizard"`: Back on left, Cancel+Submit on right. `"form"`: Cancel on left, Submit on right, no Back. `"auto"` picks `"form"` for single-step paths. |
| `validationDisplay` | `"summary" \| "inline" \| "both"` | `"summary"` | Where `fieldErrors` are rendered. `"inline"` suppresses the shell's list so step components render errors themselves. |

### Outputs

| Output | Payload | Description |
|--------|---------|-------------|
| `(complete)` | `PathData` | Emitted when the path finishes naturally. |
| `(cancel)` | `PathData` | Emitted when the path is cancelled. |
| `(event)` | `PathEvent` | Emitted for every engine event. |

### Customising the header and footer

Use `pwShellHeader` and `pwShellFooter` directives on `<ng-template>` elements inside the shell to replace the built-in sections:

```typescript
import {
  PathShellComponent,
  PathStepDirective,
  PathShellHeaderDirective,
  PathShellFooterDirective,
} from "@daltonr/pathwrite-angular/shell";

@Component({
  imports: [PathShellComponent, PathStepDirective, PathShellHeaderDirective, PathShellFooterDirective],
  template: `
    <pw-shell [path]="myPath">
      <ng-template pwShellHeader let-s>
        <p>Step {{ s.stepIndex + 1 }} of {{ s.stepCount }} — {{ s.stepTitle }}</p>
      </ng-template>

      <ng-template pwShellFooter let-s let-actions="actions">
        <button (click)="actions.previous()" [disabled]="s.isFirstStep || s.status !== 'idle'">
          Back
        </button>
        <button (click)="actions.next()" [disabled]="!s.canMoveNext || s.status !== 'idle'">
          {{ s.isLastStep ? 'Submit' : 'Continue' }}
        </button>
      </ng-template>

      <ng-template pwStep="details"><app-details-step /></ng-template>
      <ng-template pwStep="cover-note"><app-cover-note-step /></ng-template>
    </pw-shell>
  `
})
export class MyComponent { }
```

`actions` (`PathShellActions`) contains: `next`, `previous`, `cancel`, `goToStep`, `goToStepChecked`, `setData`, `restart`. All return `Promise<void>`.

### Context sharing inside `<pw-shell>`

`PathShellComponent` provides a `PathFacade` instance in its own `providers` array and passes its component-level `Injector` to every step template via `ngTemplateOutletInjector`. Step components resolve the shell's `PathFacade` via `inject()` — no extra provider setup required:

```typescript
@Component({
  selector: "app-details-step",
  standalone: true,
  template: `
    <input
      [value]="path.snapshot()?.data['firstName'] ?? ''"
      (input)="path.setData('firstName', $any($event.target).value)"
    />
  `
})
export class DetailsStepComponent {
  // injectPath() resolves the shell's PathFacade — no providers: [PathFacade] here
  protected readonly path = injectPath<ApplicationData>();
}
```

The parent component hosting `<pw-shell>` does **not** need its own `PathFacade` provider when using the shell.

---

## Complete example

A two-step job-application form. Step one collects personal details with `fieldErrors` validation. Step two uses `injectPath()` to read and update state.

```typescript
// application-path.ts
import type { PathDefinition, PathData } from "@daltonr/pathwrite-angular";

export interface ApplicationData extends PathData {
  firstName: string;
  email: string;
  coverNote: string;
}

export const applicationPath: PathDefinition<ApplicationData> = {
  id: "job-application",
  steps: [
    {
      id: "details",
      title: "Your Details",
      fieldErrors: ({ data }) => ({
        firstName: (data.firstName ?? "").trim().length < 2
          ? "First name must be at least 2 characters."
          : undefined,
        email: !(data.email ?? "").includes("@")
          ? "A valid email address is required."
          : undefined,
      }),
    },
    {
      id: "cover-note",
      title: "Cover Note",
      fieldErrors: ({ data }) => ({
        coverNote: (data.coverNote ?? "").trim().length < 20
          ? "Cover note must be at least 20 characters."
          : undefined,
      }),
    },
  ],
};
```

```typescript
// details-step.component.ts
import { Component } from "@angular/core";
import { injectPath } from "@daltonr/pathwrite-angular";
import type { ApplicationData } from "./application-path";

@Component({
  selector: "app-details-step",
  standalone: true,
  template: `
    @if (path.snapshot(); as s) {
      <div>
        <label for="firstName">First name</label>
        <input
          id="firstName"
          [value]="s.data['firstName'] ?? ''"
          (input)="path.setData('firstName', $any($event.target).value)"
        />
        @if (s.hasAttemptedNext && s.fieldErrors['firstName']) {
          <p class="error">{{ s.fieldErrors['firstName'] }}</p>
        }
      </div>
      <div>
        <label for="email">Email</label>
        <input
          id="email"
          type="email"
          [value]="s.data['email'] ?? ''"
          (input)="path.setData('email', $any($event.target).value)"
        />
        @if (s.hasAttemptedNext && s.fieldErrors['email']) {
          <p class="error">{{ s.fieldErrors['email'] }}</p>
        }
      </div>
    }
  `
})
export class DetailsStepComponent {
  protected readonly path = injectPath<ApplicationData>();
}
```

```typescript
// cover-note-step.component.ts
import { Component } from "@angular/core";
import { injectPath } from "@daltonr/pathwrite-angular";
import type { ApplicationData } from "./application-path";

@Component({
  selector: "app-cover-note-step",
  standalone: true,
  template: `
    @if (path.snapshot(); as s) {
      <label for="coverNote">Cover note</label>
      <textarea
        id="coverNote"
        rows="6"
        [value]="s.data['coverNote'] ?? ''"
        (input)="path.setData('coverNote', $any($event.target).value)"
        placeholder="Tell us why you're a great fit..."
      ></textarea>
      @if (s.hasAttemptedNext && s.fieldErrors['coverNote']) {
        <p class="error">{{ s.fieldErrors['coverNote'] }}</p>
      }
    }
  `
})
export class CoverNoteStepComponent {
  protected readonly path = injectPath<ApplicationData>();
}
```

```typescript
// job-application.component.ts — host component
import { Component } from "@angular/core";
import {
  PathShellComponent,
  PathStepDirective,
} from "@daltonr/pathwrite-angular/shell";
import type { PathData } from "@daltonr/pathwrite-angular";
import { applicationPath } from "./application-path";
import { DetailsStepComponent } from "./details-step.component";
import { CoverNoteStepComponent } from "./cover-note-step.component";

@Component({
  standalone: true,
  imports: [PathShellComponent, PathStepDirective, DetailsStepComponent, CoverNoteStepComponent],
  template: `
    <pw-shell
      [path]="path"
      [initialData]="{ firstName: '', email: '', coverNote: '' }"
      [validationDisplay]="'inline'"
      (complete)="onDone($event)"
    >
      <ng-template pwStep="details">
        <app-details-step />
      </ng-template>
      <ng-template pwStep="cover-note">
        <app-cover-note-step />
      </ng-template>
    </pw-shell>
  `
})
export class JobApplicationComponent {
  protected readonly path = applicationPath;
  protected onDone(data: PathData): void {
    console.log("Application submitted:", data);
  }
}
```

**What this demonstrates:**

- `fieldErrors` on each step with auto-derived `canMoveNext`.
- `snapshot.hasAttemptedNext` gates inline error display.
- `injectPath()` in step components — resolves the shell's `PathFacade` automatically via DI; no `providers: [PathFacade]` needed in step components.
- `validationDisplay="inline"` suppresses the shell's summary list so step components render their own inline errors.

---

## Resetting the path

**Option 1 — Toggle mount** (simplest):

```typescript
@Component({
  template: `
    @if (isActive) {
      <pw-shell [path]="myPath" (complete)="isActive = false" (cancel)="isActive = false">
        <ng-template pwStep="details"><app-details-step /></ng-template>
      </pw-shell>
    } @else {
      <button (click)="isActive = true">Try Again</button>
    }
  `
})
export class MyComponent {
  protected isActive = true;
}
```

**Option 2 — `@ViewChild` + `restart()`** (in-place, no unmount):

```typescript
@Component({
  imports: [PathShellComponent, PathStepDirective],
  template: `
    <pw-shell #shell [path]="myPath" (complete)="onDone($event)">
      <ng-template pwStep="details"><app-details-step /></ng-template>
    </pw-shell>
    <button (click)="shell.restart()">Start Over</button>
  `
})
export class MyComponent {
  @ViewChild('shell', { read: PathShellComponent }) shell!: PathShellComponent;
}
```

© 2026 Devjoy Ltd. MIT License.
