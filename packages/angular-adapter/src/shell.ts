import {
  Component,
  Directive,
  TemplateRef,
  Input,
  Output,
  EventEmitter,
  ContentChild,
  ContentChildren,
  QueryList,
  OnInit,
  OnDestroy,
  inject,
  Injector,
  ChangeDetectionStrategy
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";
import {
  PathData,
  PathDefinition,
  PathEvent,
  PathSnapshot
} from "@daltonr/pathwrite-core";
import { PathFacade } from "./index";

// ---------------------------------------------------------------------------
// PathShellActions
// ---------------------------------------------------------------------------

/**
 * Navigation actions passed as template context to custom `pwShellFooter`
 * templates. Mirrors what React's `renderFooter` and Vue's `#footer` slot
 * receive, using promises so it is consistent with the Angular facade.
 */
export interface PathShellActions {
  next: () => Promise<void>;
  previous: () => Promise<void>;
  cancel: () => Promise<void>;
  goToStep: (stepId: string) => Promise<void>;
  goToStepChecked: (stepId: string) => Promise<void>;
  setData: (key: string, value: unknown) => Promise<void>;
  /** Restart the shell's current path with its current `initialData`. */
  restart: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// PathStepDirective
// ---------------------------------------------------------------------------

/**
 * Structural directive that associates a template with a step ID.
 * Used inside `<pw-shell>` to define per-step content.
 *
 * ```html
 * <pw-shell [path]="myPath">
 *   <ng-template pwStep="details"><app-details-form /></ng-template>
 *   <ng-template pwStep="review"><app-review-panel /></ng-template>
 * </pw-shell>
 * ```
 */
@Directive({ selector: "[pwStep]", standalone: true })
export class PathStepDirective {
  @Input({ required: true, alias: "pwStep" }) stepId!: string;
  public constructor(public readonly templateRef: TemplateRef<unknown>) {}
}

// ---------------------------------------------------------------------------
// PathShellHeaderDirective
// ---------------------------------------------------------------------------

/**
 * Replaces the default progress header inside `<pw-shell>`.
 * The template receives the current `PathSnapshot` as the implicit context.
 *
 * ```html
 * <pw-shell [path]="myPath">
 *   <ng-template pwShellHeader let-s>
 *     <my-custom-progress [snapshot]="s" />
 *   </ng-template>
 *   <ng-template pwStep="details"><app-details-form /></ng-template>
 * </pw-shell>
 * ```
 */
@Directive({ selector: "[pwShellHeader]", standalone: true })
export class PathShellHeaderDirective {
  public constructor(
    public readonly templateRef: TemplateRef<{ $implicit: PathSnapshot }>
  ) {}
}

// ---------------------------------------------------------------------------
// PathShellFooterDirective
// ---------------------------------------------------------------------------

/**
 * Replaces the default navigation footer inside `<pw-shell>`.
 * The template receives the current `PathSnapshot` as the implicit context
 * and a `actions` variable containing all navigation actions.
 *
 * ```html
 * <pw-shell [path]="myPath">
 *   <ng-template pwShellFooter let-s let-actions="actions">
 *     <button (click)="actions.previous()" [disabled]="s.isFirstStep">Back</button>
 *     <button (click)="actions.next()" [disabled]="!s.canMoveNext">Next</button>
 *   </ng-template>
 *   <ng-template pwStep="details"><app-details-form /></ng-template>
 * </pw-shell>
 * ```
 */
@Directive({ selector: "[pwShellFooter]", standalone: true })
export class PathShellFooterDirective {
  public constructor(
    public readonly templateRef: TemplateRef<{ $implicit: PathSnapshot; actions: PathShellActions }>
  ) {}
}

// ---------------------------------------------------------------------------
// PathShellComponent
// ---------------------------------------------------------------------------

/**
 * Default UI shell component. Renders a progress indicator, step content,
 * and navigation buttons.
 *
 * ```html
 * <pw-shell [path]="myPath" [initialData]="{ name: '' }" (completed)="onDone($event)">
 *   <ng-template pwStep="details"><app-details-form /></ng-template>
 *   <ng-template pwStep="review"><app-review-panel /></ng-template>
 * </pw-shell>
 * ```
 */
@Component({
  selector: "pw-shell",
  standalone: true,
  imports: [CommonModule],
  providers: [PathFacade],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    <!-- Empty state -->
    <div class="pw-shell" *ngIf="!(facade.state$ | async)">
      <div class="pw-shell__empty" *ngIf="!started">
        <p>No active path.</p>
        <button *ngIf="!autoStart" type="button" class="pw-shell__start-btn" (click)="doStart()">Start</button>
      </div>
    </div>

    <!-- Active path -->
    <div class="pw-shell" *ngIf="facade.state$ | async as s">
      <!-- Header — custom or default progress indicator -->
      <ng-container *ngIf="customHeader; else defaultHeader">
        <ng-container *ngTemplateOutlet="customHeader.templateRef; context: { $implicit: s }"></ng-container>
      </ng-container>
      <ng-template #defaultHeader>
        <div class="pw-shell__header" *ngIf="!hideProgress && (s.stepCount > 1 || s.nestingLevel > 0)">
          <div class="pw-shell__steps">
            <div
              *ngFor="let step of s.steps; let i = index"
              class="pw-shell__step"
              [ngClass]="'pw-shell__step--' + step.status"
            >
              <span class="pw-shell__step-dot">{{ step.status === 'completed' ? '✓' : (i + 1) }}</span>
              <span class="pw-shell__step-label">{{ step.title ?? step.id }}</span>
            </div>
          </div>
          <div class="pw-shell__track">
            <div class="pw-shell__track-fill" [style.width.%]="s.progress * 100"></div>
          </div>
        </div>
      </ng-template>

      <!-- Body — step content -->
      <div class="pw-shell__body">
        <ng-container *ngFor="let stepDir of stepDirectives">
          <ng-container *ngIf="stepDir.stepId === s.stepId">
            <ng-container *ngTemplateOutlet="stepDir.templateRef; injector: shellInjector"></ng-container>
          </ng-container>
        </ng-container>
      </div>

      <!-- Validation messages — labeled by field name -->
      <ul class="pw-shell__validation" *ngIf="fieldEntries(s).length > 0">
        <li *ngFor="let entry of fieldEntries(s)" class="pw-shell__validation-item">
          <span *ngIf="entry[0] !== '_'" class="pw-shell__validation-label">{{ formatFieldKey(entry[0]) }}</span>{{ entry[1] }}
        </li>
      </ul>

      <!-- Footer — custom or default navigation buttons -->
      <ng-container *ngIf="customFooter; else defaultFooter">
        <ng-container *ngTemplateOutlet="customFooter.templateRef; context: { $implicit: s, actions: shellActions }"></ng-container>
      </ng-container>
      <ng-template #defaultFooter>
        <div class="pw-shell__footer">
          <div class="pw-shell__footer-left">
            <button
              *ngIf="!s.isFirstStep"
              type="button"
              class="pw-shell__btn pw-shell__btn--back"
              [disabled]="s.isNavigating || !s.canMovePrevious"
              (click)="facade.previous()"
            >{{ backLabel }}</button>
          </div>
          <div class="pw-shell__footer-right">
            <button
              *ngIf="!hideCancel"
              type="button"
              class="pw-shell__btn pw-shell__btn--cancel"
              [disabled]="s.isNavigating"
              (click)="facade.cancel()"
            >{{ cancelLabel }}</button>
            <button
              type="button"
              class="pw-shell__btn pw-shell__btn--next"
              [disabled]="s.isNavigating || !s.canMoveNext"
              (click)="facade.next()"
            >{{ s.isLastStep ? completeLabel : nextLabel }}</button>
          </div>
        </div>
      </ng-template>
    </div>
  `
})
export class PathShellComponent implements OnInit, OnDestroy {
  /** The path definition to run. Required. */
  @Input({ required: true }) path!: PathDefinition<any>;
  /** Initial data merged into the path engine on start. */
  @Input() initialData: PathData = {};
  /** Start the path automatically on ngOnInit. Set to false to call doStart() manually. */
  @Input() autoStart = true;
  /** Label for the Back navigation button. */
  @Input() backLabel = "Previous";
  /** Label for the Next navigation button. */
  @Input() nextLabel = "Next";
  /** Label for the Next button when on the last step. */
  @Input() completeLabel = "Complete";
  /** Label for the Cancel button. */
  @Input() cancelLabel = "Cancel";
  /** Hide the Cancel button entirely. */
  @Input() hideCancel = false;
  /** Hide the step progress indicator in the header. Also hidden automatically when the path has only one step. */
  @Input() hideProgress = false;

  @Output() completed = new EventEmitter<PathData>();
  @Output() cancelled = new EventEmitter<PathData>();
  @Output() pathEvent = new EventEmitter<PathEvent>();

  @ContentChildren(PathStepDirective) stepDirectives!: QueryList<PathStepDirective>;
  @ContentChild(PathShellHeaderDirective) customHeader?: PathShellHeaderDirective;
  @ContentChild(PathShellFooterDirective) customFooter?: PathShellFooterDirective;

  public readonly facade = inject(PathFacade);
  /** The shell's own component-level injector. Passed to ngTemplateOutlet so that
   *  step components can resolve PathFacade (provided by this shell) via inject(). */
  protected readonly shellInjector = inject(Injector);
  public started = false;

  /** Navigation actions passed to custom `pwShellFooter` templates. */
  protected readonly shellActions: PathShellActions = {
    next: () => this.facade.next(),
    previous: () => this.facade.previous(),
    cancel: () => this.facade.cancel(),
    goToStep: (id) => this.facade.goToStep(id),
    goToStepChecked: (id) => this.facade.goToStepChecked(id),
    setData: (key, value) => this.facade.setData(key, value as never),
    restart: () => this.facade.restart(this.path, this.initialData),
  };

  private readonly destroy$ = new Subject<void>();

  public ngOnInit(): void {
    this.facade.events$.pipe(takeUntil(this.destroy$)).subscribe((event) => {
      this.pathEvent.emit(event);
      if (event.type === "completed") this.completed.emit(event.data);
      if (event.type === "cancelled") this.cancelled.emit(event.data);
    });

    if (this.autoStart) {
      this.doStart();
    }
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public doStart(): void {
    this.started = true;
    this.facade.start(this.path, this.initialData);
  }

  /** Returns Object.entries(s.fieldMessages) for use in *ngFor. */
  protected fieldEntries(s: PathSnapshot): [string, string][] {
    return Object.entries(s.fieldMessages) as [string, string][];
  }

  /** Converts a camelCase or lowercase field key to a display label.
   *  e.g. "firstName" → "First Name", "email" → "Email" */
  protected formatFieldKey(key: string): string {
    return key.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase()).trim();
  }
}
