# @daltonr/pathwrite-angular

Angular `@Injectable` facade over `@daltonr/pathwrite-core`. Exposes path state and events as RxJS observables that work seamlessly with Angular signals, the `async` pipe, and `takeUntilDestroyed`.

## Installation

```bash
npm install @daltonr/pathwrite-core @daltonr/pathwrite-angular
```

## Exported Types

For convenience, this package re-exports core types so you don't need to import from `@daltonr/pathwrite-core`:

```typescript
import { 
  PathFacade,           // Angular-specific
  PathEngine,           // Re-exported from core (value + type)
  PathData,             // Re-exported from core
  PathDefinition,       // Re-exported from core
  PathEvent,            // Re-exported from core
  PathSnapshot,         // Re-exported from core
  PathStep,             // Re-exported from core
  PathStepContext,      // Re-exported from core
  SerializedPathState   // Re-exported from core
} from "@daltonr/pathwrite-angular";
```

---

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
| `adoptEngine(engine)` | Adopt an externally-managed `PathEngine` (e.g. from `PathEngineWithStore.getEngine()`). The facade immediately reflects the engine's current state and forwards all subsequent events. The caller is responsible for the engine's lifecycle. |
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

## Sub-Paths

Sub-paths allow you to nest multi-step workflows. Common use cases include:
- Running a child workflow per collection item (e.g., approve each document)
- Conditional drill-down flows (e.g., "Add payment method" modal)
- Reusable wizard components

### Basic Sub-Path Flow

When a sub-path is active:
- The shell switches to show the sub-path's steps
- The progress bar displays sub-path steps (not main path steps)
- Pressing Back on the first sub-path step **cancels** the sub-path and returns to the parent
- The `PathFacade` (and thus `state$`, `stateSignal`) reflects the **sub-path** snapshot, not the parent's

### Complete Example: Approver Collection

```typescript
import { PathData, PathDefinition, PathFacade } from "@daltonr/pathwrite-angular";

// Sub-path data shape
interface ApproverReviewData extends PathData {
  decision: "approve" | "reject" | "";
  comments: string;
}

// Main path data shape
interface ApprovalWorkflowData extends PathData {
  documentTitle: string;
  approvers: string[];
  approvals: Array<{ approver: string; decision: string; comments: string }>;
}

// Define the sub-path (approver review wizard)
const approverReviewPath: PathDefinition<ApproverReviewData> = {
  id: "approver-review",
  steps: [
    { id: "review", title: "Review Document" },
    {
      id: "decision",
      title: "Make Decision",
      canMoveNext: ({ data }) =>
        data.decision === "approve" || data.decision === "reject",
      validationMessages: ({ data }) =>
        !data.decision ? ["Please select Approve or Reject"] : []
    },
    { id: "comments", title: "Add Comments" }
  ]
};

// Define the main path
const approvalWorkflowPath: PathDefinition<ApprovalWorkflowData> = {
  id: "approval-workflow",
  steps: [
    {
      id: "setup",
      title: "Setup Approval",
      canMoveNext: ({ data }) =>
        (data.documentTitle ?? "").trim().length > 0 &&
        data.approvers.length > 0
    },
    {
      id: "run-approvals",
      title: "Collect Approvals",
      // Block "Next" until all approvers have completed their reviews
      canMoveNext: ({ data }) =>
        data.approvals.length === data.approvers.length,
      validationMessages: ({ data }) => {
        const remaining = data.approvers.length - data.approvals.length;
        return remaining > 0
          ? [`${remaining} approver(s) pending review`]
          : [];
      },
      // When an approver finishes their sub-path, record the result
      onSubPathComplete(subPathId, subPathData, ctx, meta) {
        const approverName = meta?.approverName as string;
        const result = subPathData as ApproverReviewData;
        return {
          approvals: [
            ...ctx.data.approvals,
            {
              approver: approverName,
              decision: result.decision,
              comments: result.comments
            }
          ]
        };
      },
      // If an approver cancels (presses Back on first step), you can track it
      onSubPathCancel(subPathId, subPathData, ctx, meta) {
        console.log(`${meta?.approverName} cancelled their review`);
        // Optionally return data changes, or just log
      }
    },
    { id: "summary", title: "Summary" }
  ]
};

// Component
@Component({
  selector: 'app-approval-workflow',
  standalone: true,
  imports: [PathShellComponent, PathStepDirective],
  providers: [PathFacade],
  template: `
    <pw-shell [path]="approvalWorkflowPath" [initialData]="initialData">
      <!-- Main path steps -->
      <ng-template pwStep="setup">
        <input [(ngModel)]="facade.snapshot()!.data.documentTitle" placeholder="Document title" />
        <!-- approver selection UI here -->
      </ng-template>

      <ng-template pwStep="run-approvals">
        <h3>Approvers</h3>
        <ul>
          @for (approver of facade.snapshot()!.data.approvers; track $index) {
            <li>
              {{ approver }}
              @if (!hasApproval(approver)) {
                <button (click)="launchReviewForApprover(approver, $index)">
                  Start Review
                </button>
              } @else {
                <span>✓ {{ getApproval(approver)?.decision }}</span>
              }
            </li>
          }
        </ul>
      </ng-template>

      <ng-template pwStep="summary">
        <h3>All Approvals Collected</h3>
        <ul>
          @for (approval of facade.snapshot()!.data.approvals; track approval.approver) {
            <li>{{ approval.approver }}: {{ approval.decision }}</li>
          }
        </ul>
      </ng-template>

      <!-- Sub-path steps (must be co-located in the same pw-shell) -->
      <ng-template pwStep="review">
        <p>Review the document: "{{ facade.snapshot()!.data.documentTitle }}"</p>
      </ng-template>

      <ng-template pwStep="decision">
        <label><input type="radio" value="approve" [(ngModel)]="facade.snapshot()!.data.decision" /> Approve</label>
        <label><input type="radio" value="reject" [(ngModel)]="facade.snapshot()!.data.decision" /> Reject</label>
      </ng-template>

      <ng-template pwStep="comments">
        <textarea [(ngModel)]="facade.snapshot()!.data.comments" placeholder="Optional comments"></textarea>
      </ng-template>
    </pw-shell>
  `
})
export class ApprovalWorkflowComponent {
  protected readonly facade = inject(PathFacade) as PathFacade<ApprovalWorkflowData>;
  protected readonly approvalWorkflowPath = approvalWorkflowPath;
  protected readonly initialData = { documentTitle: '', approvers: [], approvals: [] };

  protected launchReviewForApprover(approverName: string, index: number): void {
    // Pass correlation data via `meta` — it's echoed back to onSubPathComplete
    void this.facade.startSubPath(
      approverReviewPath,
      { decision: "", comments: "" },
      { approverName, approverIndex: index }
    );
  }

  protected hasApproval(approver: string): boolean {
    return this.facade.snapshot()!.data.approvals.some(a => a.approver === approver);
  }

  protected getApproval(approver: string) {
    return this.facade.snapshot()!.data.approvals.find(a => a.approver === approver);
  }
}
```

### Key Notes

**1. Sub-path steps must be co-located with main path steps**  
All `pwStep` templates (main path + sub-path steps) live in the same `<pw-shell>`. When a sub-path is active, the shell renders the sub-path's step templates. This means:
- Parent and sub-path step IDs **must not collide** (e.g., don't use `summary` in both)
- The shell matches step IDs from the current path only (main or sub), but all templates are registered globally

**2. The `meta` correlation field**  
`startSubPath` accepts an optional third argument (`meta`) that is returned unchanged to `onSubPathComplete` and `onSubPathCancel`. Use it to correlate which collection item triggered the sub-path:

```typescript
facade.startSubPath(subPath, initialData, { itemIndex: 3, itemId: "abc" });

// In the parent step:
onSubPathComplete(subPathId, subPathData, ctx, meta) {
  const itemIndex = meta?.itemIndex; // 3
}
```

**3. Progress bar switches during sub-paths**  
When `snapshot.nestingLevel > 0`, you're in a sub-path. The `steps` array in the snapshot contains the sub-path's steps, not the main path's. The default PathShell progress bar shows sub-path progress. You can check `nestingLevel` to show a breadcrumb or "back to main flow" indicator.

**4. Accessing parent path data from sub-path components**  
There is currently no way to inject a "parent facade" in sub-path step components. If a sub-path step needs parent data (e.g., the document title), pass it via `initialData` when calling `startSubPath`:

```typescript
facade.startSubPath(approverReviewPath, {
  decision: "",
  comments: "",
  documentTitle: facade.snapshot()!.data.documentTitle // copy from parent
});
```

---

## Guards and Lifecycle Hooks

### Defensive Guards (Important!)

**Guards and `validationMessages` are evaluated *before* `onEnter` runs on first entry.**

If you access fields in a guard that `onEnter` is supposed to initialize, the guard will throw a `TypeError` on startup. Write guards defensively using nullish coalescing:

```typescript
// ✗ Unsafe — crashes if data.name is undefined
canMoveNext: ({ data }) => data.name.trim().length > 0

// ✓ Safe — handles undefined gracefully
canMoveNext: ({ data }) => (data.name ?? "").trim().length > 0
```

Alternatively, pass `initialData` to `start()` / `<pw-shell>` so all fields are present from the first snapshot:

```typescript
<pw-shell [path]="myPath" [initialData]="{ name: '', age: 0 }" />
```

If a guard throws, the engine catches it, logs a warning, and returns `true` (allow navigation) as a safe default.

### Async Guards and Validation Messages

Guards and `validationMessages` must be **synchronous** for inclusion in snapshots. Async functions are detected and warned about:
- Async `canMoveNext` / `canMovePrevious` default to `true` (optimistic)
- Async `validationMessages` default to `[]`

The async version is still enforced during actual navigation (when you call `next()` / `previous()`), but the snapshot won't reflect the pending state. If you need async validation, perform it in the guard and store the result in `data` so the guard can read it synchronously.

### `isFirstEntry` Flag

The `PathStepContext` passed to all hooks includes an `isFirstEntry: boolean` flag. It's `true` the first time a step is visited, `false` on re-entry (e.g., after navigating back then forward again).

Use it to distinguish initialization from re-entry:

```typescript
{
  id: "details",
  onEnter: ({ isFirstEntry, data }) => {
    if (isFirstEntry) {
      // Only pre-fill on first visit, not when returning via Back
      return { name: "Default Name" };
    }
  }
}
```

**Important:** `onEnter` fires every time you enter the step. If you want "initialize once" behavior, either:
1. Use `isFirstEntry` to conditionally return data
2. Provide `initialData` to `start()` instead of using `onEnter`

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

### Available CSS Custom Properties

**Layout:**
- `--pw-shell-max-width` — Maximum width of the shell (default: `720px`)
- `--pw-shell-padding` — Internal padding (default: `24px`)
- `--pw-shell-gap` — Gap between header, body, footer (default: `20px`)
- `--pw-shell-radius` — Border radius for cards (default: `10px`)

**Colors:**
- `--pw-color-bg` — Background color (default: `#ffffff`)
- `--pw-color-border` — Border color (default: `#dbe4f0`)
- `--pw-color-text` — Primary text color (default: `#1f2937`)
- `--pw-color-muted` — Muted text color (default: `#5b677a`)
- `--pw-color-primary` — Primary/accent color (default: `#2563eb`)
- `--pw-color-primary-light` — Light primary for backgrounds (default: `rgba(37, 99, 235, 0.12)`)
- `--pw-color-btn-bg` — Button background (default: `#f8fbff`)
- `--pw-color-btn-border` — Button border (default: `#c2d0e5`)

**Validation:**
- `--pw-color-error` — Error text color (default: `#dc2626`)
- `--pw-color-error-bg` — Error background (default: `#fef2f2`)
- `--pw-color-error-border` — Error border (default: `#fecaca`)

**Progress Indicator:**
- `--pw-dot-size` — Step dot size (default: `32px`)
- `--pw-dot-font-size` — Font size inside dots (default: `13px`)
- `--pw-track-height` — Progress track height (default: `4px`)

**Buttons:**
- `--pw-btn-padding` — Button padding (default: `8px 16px`)
- `--pw-btn-radius` — Button border radius (default: `6px`)

