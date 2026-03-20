import {
  Component,
  Directive,
  TemplateRef,
  Input,
  Output,
  EventEmitter,
  ContentChildren,
  QueryList,
  OnInit,
  OnDestroy,
  inject,
  ChangeDetectionStrategy
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";
import {
  PathData,
  PathDefinition,
  PathEvent
} from "@daltonr/pathwrite-core";
import { PathFacade } from "./index";

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
      <!-- Header — progress indicator -->
      <div class="pw-shell__header" *ngIf="!hideProgress">
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

      <!-- Body — step content -->
      <div class="pw-shell__body">
        <ng-container *ngFor="let stepDir of stepDirectives">
          <ng-container *ngIf="stepDir.stepId === s.stepId">
            <ng-container *ngTemplateOutlet="stepDir.templateRef"></ng-container>
          </ng-container>
        </ng-container>
      </div>

      <!-- Footer — navigation buttons -->
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
          >{{ s.isLastStep ? finishLabel : nextLabel }}</button>
        </div>
      </div>
    </div>
  `
})
export class PathShellComponent implements OnInit, OnDestroy {
  @Input({ required: true }) path!: PathDefinition;
  @Input() initialData: PathData = {};
  @Input() autoStart = true;
  @Input() backLabel = "Back";
  @Input() nextLabel = "Next";
  @Input() finishLabel = "Finish";
  @Input() cancelLabel = "Cancel";
  @Input() hideCancel = false;
  @Input() hideProgress = false;

  @Output() completed = new EventEmitter<PathData>();
  @Output() cancelled = new EventEmitter<PathData>();
  @Output() pathEvent = new EventEmitter<PathEvent>();

  @ContentChildren(PathStepDirective) stepDirectives!: QueryList<PathStepDirective>;

  public readonly facade = inject(PathFacade);
  public started = false;

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
}


