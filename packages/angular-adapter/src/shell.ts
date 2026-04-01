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
  OnChanges,
  OnDestroy,
  SimpleChanges,
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
  PathEngine,
  PathEvent,
  PathSnapshot,
  ProgressLayout,
  RootProgress,
  formatFieldKey,
  errorPhaseMessage,
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
  goToStep: (stepId: string, options?: { validateOnLeave?: boolean }) => Promise<void>;
  goToStepChecked: (stepId: string, options?: { validateOnLeave?: boolean }) => Promise<void>;
  setData: (key: string, value: unknown) => Promise<void>;
  /** Restart the shell's current path with its current `initialData`. */
  restart: () => Promise<void>;
  /** Re-run the operation that set `snapshot.error`. */
  retry: () => Promise<void>;
  /** Pause with intent to return, preserving all state. Emits `suspended`. */
  suspend: () => Promise<void>;
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
// PathShellCompletionDirective
// ---------------------------------------------------------------------------

/**
 * Replaces the default completion panel inside `<pw-shell>` when
 * `snapshot.status === "completed"` (`completionBehaviour: "stayOnFinal"`).
 * The template receives the current `PathSnapshot` as the implicit context.
 *
 * ```html
 * <pw-shell [path]="myPath">
 *   <ng-template pwShellCompletion let-s>
 *     <my-completion-screen [data]="s.data" />
 *   </ng-template>
 *   <ng-template pwStep="details"><app-details-form /></ng-template>
 * </pw-shell>
 * ```
 */
@Directive({ selector: "[pwShellCompletion]", standalone: true })
export class PathShellCompletionDirective {
  public constructor(
    public readonly templateRef: TemplateRef<{ $implicit: PathSnapshot }>
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
 * <pw-shell [path]="myPath" [initialData]="{ name: '' }" (complete)="onDone($event)">
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
    <div class="pw-shell" [ngClass]="progressLayout !== 'merged' ? 'pw-shell--progress-' + progressLayout : ''" *ngIf="facade.state$ | async as s">
      <!-- Root progress — persistent top-level bar visible during sub-paths -->
      <div class="pw-shell__root-progress" *ngIf="!effectiveHideProgress && s.rootProgress && progressLayout !== 'activeOnly'">
        <div class="pw-shell__steps">
          <div
            *ngFor="let step of s.rootProgress!.steps; let i = index"
            class="pw-shell__step"
            [ngClass]="'pw-shell__step--' + step.status"
          >
            <span class="pw-shell__step-dot">{{ step.status === 'completed' ? '✓' : (i + 1) }}</span>
            <span class="pw-shell__step-label">{{ step.title ?? step.id }}</span>
          </div>
        </div>
        <div class="pw-shell__track">
          <div class="pw-shell__track-fill" [style.width.%]="s.rootProgress!.progress * 100"></div>
        </div>
      </div>

      <!-- Header — custom or default progress indicator -->
      <ng-container *ngIf="customHeader; else defaultHeader">
        <ng-container *ngTemplateOutlet="customHeader.templateRef; context: { $implicit: s }"></ng-container>
      </ng-container>
      <ng-template #defaultHeader>
        <div class="pw-shell__header" *ngIf="!effectiveHideProgress && (s.stepCount > 1 || s.nestingLevel > 0) && progressLayout !== 'rootOnly'">
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

      <!-- Completion panel — shown when path finishes with stayOnFinal -->
      <ng-container *ngIf="s.status === 'completed'; else activeContent">
        <ng-container *ngIf="customCompletion; else defaultCompletion">
          <ng-container *ngTemplateOutlet="customCompletion.templateRef; context: { $implicit: s }"></ng-container>
        </ng-container>
        <ng-template #defaultCompletion>
          <div class="pw-shell__completion">
            <p class="pw-shell__completion-message">All done.</p>
            <button type="button" class="pw-shell__completion-restart" (click)="facade.restart()">Start over</button>
          </div>
        </ng-template>
      </ng-container>

      <!-- Active step content -->
      <ng-template #activeContent>
        <!-- Body — step content -->
        <div class="pw-shell__body">
          <ng-container *ngFor="let stepDir of stepDirectives">
            <!-- Match by formId first (inner step of a StepChoice), then stepId -->
            <ng-container *ngIf="stepDir.stepId === (s.formId ?? s.stepId)">
              <ng-container *ngTemplateOutlet="stepDir.templateRef; injector: shellInjector"></ng-container>
            </ng-container>
          </ng-container>
        </div>

        <!-- Validation messages — suppressed when validationDisplay="inline" -->
        <ul class="pw-shell__validation" *ngIf="validationDisplay !== 'inline' && (s.hasAttemptedNext || s.hasValidated) && fieldEntries(s).length > 0">
          <li *ngFor="let entry of fieldEntries(s)" class="pw-shell__validation-item">
            <span *ngIf="entry[0] !== '_'" class="pw-shell__validation-label">{{ formatFieldKey(entry[0]) }}</span>{{ entry[1] }}
          </li>
        </ul>

        <!-- Warning messages — non-blocking, shown immediately (no hasAttemptedNext gate) -->
        <ul class="pw-shell__warnings" *ngIf="validationDisplay !== 'inline' && warningEntries(s).length > 0">
          <li *ngFor="let entry of warningEntries(s)" class="pw-shell__warnings-item">
            <span *ngIf="entry[0] !== '_'" class="pw-shell__warnings-label">{{ formatFieldKey(entry[0]) }}</span>{{ entry[1] }}
          </li>
        </ul>

        <!-- Blocking error — guard returned { allowed: false, reason } -->
        <p class="pw-shell__blocking-error"
           *ngIf="validationDisplay !== 'inline' && (s.hasAttemptedNext || s.hasValidated) && s.blockingError">
          {{ s.blockingError }}
        </p>

        <!-- Error panel — replaces footer when an async operation has failed -->
        <div class="pw-shell__error" *ngIf="s.status === 'error' && s.error; else footerOrCustom">
          <div class="pw-shell__error-title">{{ s.error!.retryCount >= 2 ? 'Still having trouble.' : 'Something went wrong.' }}</div>
          <div class="pw-shell__error-message">{{ errorPhaseMessage(s.error!.phase) }}{{ s.error!.message ? ' ' + s.error!.message : '' }}</div>
          <div class="pw-shell__error-actions">
            <button
              *ngIf="s.error!.retryCount < 2"
              type="button"
              class="pw-shell__btn pw-shell__btn--retry"
              (click)="facade.retry()"
            >Try again</button>
            <button
              *ngIf="s.hasPersistence"
              type="button"
              [class]="'pw-shell__btn ' + (s.error!.retryCount >= 2 ? 'pw-shell__btn--retry' : 'pw-shell__btn--suspend')"
              (click)="facade.suspend()"
            >Save and come back later</button>
            <button
              *ngIf="s.error!.retryCount >= 2 && !s.hasPersistence"
              type="button"
              class="pw-shell__btn pw-shell__btn--retry"
              (click)="facade.retry()"
            >Try again</button>
          </div>
        </div>
        <!-- Footer — custom or default navigation buttons -->
        <ng-template #footerOrCustom>
          <ng-container *ngIf="!effectiveHideFooter">
            <ng-container *ngIf="customFooter; else defaultFooter">
              <ng-container *ngTemplateOutlet="customFooter.templateRef; context: { $implicit: s, actions: shellActions }"></ng-container>
            </ng-container>
          </ng-container>
        </ng-template>
      </ng-template>
      <ng-template #defaultFooter>
        <div class="pw-shell__footer">
          <div class="pw-shell__footer-left">
            <!-- Form mode: Cancel on the left -->
            <button
              *ngIf="getResolvedLayout(s) === 'form' && !hideCancel"
              type="button"
              class="pw-shell__btn pw-shell__btn--cancel"
              [disabled]="s.status !== 'idle'"
              (click)="facade.cancel()"
            >{{ cancelLabel }}</button>
            <!-- Wizard mode: Back on the left -->
            <button
              *ngIf="getResolvedLayout(s) === 'wizard' && !s.isFirstStep"
              type="button"
              class="pw-shell__btn pw-shell__btn--back"
              [disabled]="s.status !== 'idle' || !s.canMovePrevious"
              (click)="facade.previous()"
            >{{ backLabel }}</button>
          </div>
          <div class="pw-shell__footer-right">
            <!-- Wizard mode: Cancel on the right -->
            <button
              *ngIf="getResolvedLayout(s) === 'wizard' && !hideCancel"
              type="button"
              class="pw-shell__btn pw-shell__btn--cancel"
              [disabled]="s.status !== 'idle'"
              (click)="facade.cancel()"
            >{{ cancelLabel }}</button>
            <!-- Both modes: Submit on the right -->
            <button
              type="button"
              class="pw-shell__btn pw-shell__btn--next"
              [class.pw-shell__btn--loading]="s.status !== 'idle'"
              [disabled]="s.status !== 'idle'"
              (click)="facade.next()"
            >{{ s.status !== 'idle' && loadingLabel ? loadingLabel : s.isLastStep ? completeLabel : nextLabel }}</button>
          </div>
        </div>
      </ng-template>
    </div>
  `
})
export class PathShellComponent implements OnInit, OnChanges, OnDestroy {
  /** The path definition to run. Required unless [engine] is provided. */
  @Input() path?: PathDefinition<any>;
  /**
   * An externally-managed `PathEngine` to adopt — for example, the engine
   * returned by `restoreOrStart()` from `@daltonr/pathwrite-store`.
   *
   * When provided the shell skips `autoStart` and immediately reflects the
   * engine's current state. Gate the shell's existence on the engine being
   * ready using `@if (engine)` so the input is always non-null on mount:
   *
   * ```html
   * @if (engine) {
   *   <pw-shell [engine]="engine" [path]="myPath" ...></pw-shell>
   * }
   * ```
   */
  @Input() engine?: PathEngine;
  /** Initial data merged into the path engine on start. Used on first visit; overridden by stored snapshot when `restoreKey` is set. */
  @Input() initialData: PathData = {};
  /**
   * When set, this shell automatically saves its state into the nearest outer `pw-shell`'s
   * data under this key on every change, and restores from that stored state on remount.
   * No-op when used on a top-level shell with no outer `pw-shell` ancestor.
   */
  @Input() restoreKey?: string;
  /** Start the path automatically on ngOnInit. Set to false to call doStart() manually. */
  @Input() autoStart = true;
  /** Label for the Back navigation button. */
  @Input() backLabel = "Previous";
  /** Label for the Next navigation button. */
  @Input() nextLabel = "Next";
  /** Label for the Next button when on the last step. */
  @Input() completeLabel = "Complete";
  /** Label shown on the Next/Complete button while an async operation is in progress. When undefined, the button keeps its label and shows a CSS spinner only. */
  @Input() loadingLabel?: string;
  /** Label for the Cancel button. */
  @Input() cancelLabel = "Cancel";
  /** Hide the Cancel button entirely. */
  @Input() hideCancel = false;
  /** Hide the step progress indicator in the header. Also hidden automatically when the path has only one step. */
  @Input() hideProgress = false;
  /** Hide the footer (navigation buttons). The error panel is still shown on async failure regardless of this input. */
  @Input() hideFooter = false;
  /** When true, calls `validate()` on the facade so all steps show inline errors simultaneously. Useful when this shell is nested inside a step of an outer shell: bind to the outer snapshot's `hasAttemptedNext`. */
  @Input() validateWhen = false;
  /**
   * Arbitrary services object made available to all step components via
   * `usePathContext<TData, TServices>().services`. Pass API clients, feature
   * flags, or any shared dependency without prop-drilling through each step.
   */
  @Input() services: unknown = null;
  /**
   * Shell layout mode:
   * - "auto" (default): Uses "form" for single-step top-level paths, "wizard" otherwise.
   * - "wizard": Progress header + Back button on left, Cancel and Submit together on right.
   * - "form": Progress header + Cancel on left, Submit alone on right. Back button never shown.
   * - "tabs": No progress header, no footer. Use for tabbed interfaces with a custom tab bar inside the step body.
   */
  @Input() layout: "wizard" | "form" | "auto" | "tabs" = "auto";
  /**
   * Controls whether the shell renders its auto-generated field-error summary box.
   * - `"summary"` (default): Shell renders the labeled error list below the step body.
   * - `"inline"`: Suppress the summary — handle errors inside the step template instead.
   * - `"both"`: Render the shell summary AND whatever the step template renders.
   */
  @Input() validationDisplay: "summary" | "inline" | "both" = "summary";
  /**
   * Controls how progress bars are arranged when a sub-path is active.
   * - "merged" (default): Root and sub-path bars in one card.
   * - "split": Root and sub-path bars as separate cards.
   * - "rootOnly": Only the root bar — sub-path bar hidden.
   * - "activeOnly": Only the active (sub-path) bar — root bar hidden.
   */
  @Input() progressLayout: ProgressLayout = "merged";

  @Output() complete = new EventEmitter<PathData>();
  @Output() cancel = new EventEmitter<PathData>();
  @Output() event = new EventEmitter<PathEvent>();

  @ContentChildren(PathStepDirective) stepDirectives!: QueryList<PathStepDirective>;
  @ContentChild(PathShellHeaderDirective) customHeader?: PathShellHeaderDirective;
  @ContentChild(PathShellFooterDirective) customFooter?: PathShellFooterDirective;
  @ContentChild(PathShellCompletionDirective) customCompletion?: PathShellCompletionDirective;

  public readonly facade = inject(PathFacade);
  /** The shell's own component-level injector. Passed to ngTemplateOutlet so that
   *  step components can resolve PathFacade (provided by this shell) via inject(). */
  protected readonly shellInjector = inject(Injector);
  /** Outer shell's PathFacade — present when this shell is nested inside another pw-shell. */
  private readonly outerFacade = inject(PathFacade, { skipSelf: true, optional: true });
  public started = false;

  /** Navigation actions passed to custom `pwShellFooter` templates. */
  protected readonly shellActions: PathShellActions = {
    next: () => this.facade.next(),
    previous: () => this.facade.previous(),
    cancel: () => this.facade.cancel(),
    goToStep: (id, options) => this.facade.goToStep(id, options),
    goToStepChecked: (id, options) => this.facade.goToStepChecked(id, options),
    setData: (key, value) => this.facade.setData(key, value as never),
    restart: () => this.facade.restart(),
    retry: () => this.facade.retry(),
    suspend: () => this.facade.suspend(),
  };

  private readonly destroy$ = new Subject<void>();

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['engine'] && this.engine) {
      this.facade.adoptEngine(this.engine);
    }
    if (changes['validateWhen'] && this.validateWhen) {
      this.facade.validate();
    }
    if (changes['services']) {
      this.facade.services = this.services;
    }
  }

  public ngOnInit(): void {
    this.facade.services = this.services;
    this.facade.events$.pipe(takeUntil(this.destroy$)).subscribe((event) => {
      this.event.emit(event);
      if (event.type === "completed") this.complete.emit(event.data);
      if (event.type === "cancelled") this.cancel.emit(event.data);
      if (this.restoreKey && this.outerFacade && event.type === "stateChanged") {
        this.outerFacade.setData(this.restoreKey as any, (event as any).snapshot as any);
      }
    });

    if (this.autoStart && !this.engine) {
      this.doStart();
    }
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public doStart(): void {
    if (!this.path) throw new Error('[pw-shell] [path] is required when no [engine] is provided');
    this.started = true;
    let startData: PathData = this.initialData;
    let restoreStepId: string | undefined;
    if (this.restoreKey && this.outerFacade) {
      const stored = this.outerFacade.snapshot()?.data[this.restoreKey] as PathSnapshot | undefined;
      if (stored != null && typeof stored === "object" && "stepId" in stored) {
        startData = stored.data as PathData;
        if (stored.stepIndex > 0) restoreStepId = stored.stepId as string;
      }
    }
    this.facade.start(this.path, startData).then(() => {
      if (restoreStepId) this.facade.goToStep(restoreStepId!);
    });
  }

  /**
   * Restart the active path from step 1 with the original `initialData`,
   * without unmounting the shell. Call this via a `#shell` template reference:
   *
   * ```html
   * <pw-shell #shell [path]="myPath" ...></pw-shell>
   * <button (click)="shell.restart()">Try Again</button>
   * ```
   */
  public restart(): Promise<void> {
    return this.facade.restart();
  }

  /** Returns Object.entries(s.fieldErrors) for use in *ngFor. */
  protected fieldEntries(s: PathSnapshot): [string, string][] {
    return Object.entries(s.fieldErrors) as [string, string][];
  }

  /** Returns Object.entries(s.fieldWarnings) for use in *ngFor. */
  protected warningEntries(s: PathSnapshot): [string, string][] {
    return Object.entries(s.fieldWarnings) as [string, string][];
  }

  get effectiveHideProgress(): boolean { return this.hideProgress || this.layout === "tabs"; }
  get effectiveHideFooter(): boolean { return this.hideFooter || this.layout === "tabs"; }

  /** Resolves "auto"/"tabs" layout to "wizard" or "form" for footer button arrangement. */
  protected getResolvedLayout(s: PathSnapshot): "wizard" | "form" {
    return this.layout === "auto" || this.layout === "tabs"
      ? (s.stepCount === 1 && s.nestingLevel === 0 ? "form" : "wizard")
      : this.layout;
  }

  protected errorPhaseMessage = errorPhaseMessage;
  protected formatFieldKey = formatFieldKey;
}
