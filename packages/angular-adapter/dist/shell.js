import { Component, Directive, Input, Output, EventEmitter, ContentChild, ContentChildren, inject, Injector, ChangeDetectionStrategy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";
import { PathFacade } from "./index";
import * as i0 from "@angular/core";
import * as i1 from "@angular/common";
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
export class PathStepDirective {
    constructor(templateRef) {
        this.templateRef = templateRef;
    }
    static { this.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: PathStepDirective, deps: [{ token: i0.TemplateRef }], target: i0.ɵɵFactoryTarget.Directive }); }
    static { this.ɵdir = i0.ɵɵngDeclareDirective({ minVersion: "14.0.0", version: "17.3.12", type: PathStepDirective, isStandalone: true, selector: "[pwStep]", inputs: { stepId: ["pwStep", "stepId"] }, ngImport: i0 }); }
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: PathStepDirective, decorators: [{
            type: Directive,
            args: [{ selector: "[pwStep]", standalone: true }]
        }], ctorParameters: () => [{ type: i0.TemplateRef }], propDecorators: { stepId: [{
                type: Input,
                args: [{ required: true, alias: "pwStep" }]
            }] } });
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
export class PathShellHeaderDirective {
    constructor(templateRef) {
        this.templateRef = templateRef;
    }
    static { this.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: PathShellHeaderDirective, deps: [{ token: i0.TemplateRef }], target: i0.ɵɵFactoryTarget.Directive }); }
    static { this.ɵdir = i0.ɵɵngDeclareDirective({ minVersion: "14.0.0", version: "17.3.12", type: PathShellHeaderDirective, isStandalone: true, selector: "[pwShellHeader]", ngImport: i0 }); }
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: PathShellHeaderDirective, decorators: [{
            type: Directive,
            args: [{ selector: "[pwShellHeader]", standalone: true }]
        }], ctorParameters: () => [{ type: i0.TemplateRef }] });
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
export class PathShellFooterDirective {
    constructor(templateRef) {
        this.templateRef = templateRef;
    }
    static { this.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: PathShellFooterDirective, deps: [{ token: i0.TemplateRef }], target: i0.ɵɵFactoryTarget.Directive }); }
    static { this.ɵdir = i0.ɵɵngDeclareDirective({ minVersion: "14.0.0", version: "17.3.12", type: PathShellFooterDirective, isStandalone: true, selector: "[pwShellFooter]", ngImport: i0 }); }
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: PathShellFooterDirective, decorators: [{
            type: Directive,
            args: [{ selector: "[pwShellFooter]", standalone: true }]
        }], ctorParameters: () => [{ type: i0.TemplateRef }] });
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
export class PathShellComponent {
    constructor() {
        /** Initial data merged into the path engine on start. */
        this.initialData = {};
        /** Start the path automatically on ngOnInit. Set to false to call doStart() manually. */
        this.autoStart = true;
        /** Label for the Back navigation button. */
        this.backLabel = "Previous";
        /** Label for the Next navigation button. */
        this.nextLabel = "Next";
        /** Label for the Next button when on the last step. */
        this.completeLabel = "Complete";
        /** Label for the Cancel button. */
        this.cancelLabel = "Cancel";
        /** Hide the Cancel button entirely. */
        this.hideCancel = false;
        /** Hide the step progress indicator in the header. */
        this.hideProgress = false;
        this.completed = new EventEmitter();
        this.cancelled = new EventEmitter();
        this.pathEvent = new EventEmitter();
        this.facade = inject(PathFacade);
        /** The shell's own component-level injector. Passed to ngTemplateOutlet so that
         *  step components can resolve PathFacade (provided by this shell) via inject(). */
        this.shellInjector = inject(Injector);
        this.started = false;
        /** Navigation actions passed to custom `pwShellFooter` templates. */
        this.shellActions = {
            next: () => this.facade.next(),
            previous: () => this.facade.previous(),
            cancel: () => this.facade.cancel(),
            goToStep: (id) => this.facade.goToStep(id),
            goToStepChecked: (id) => this.facade.goToStepChecked(id),
            setData: (key, value) => this.facade.setData(key, value),
            restart: () => this.facade.restart(this.path, this.initialData),
        };
        this.destroy$ = new Subject();
    }
    ngOnInit() {
        this.facade.events$.pipe(takeUntil(this.destroy$)).subscribe((event) => {
            this.pathEvent.emit(event);
            if (event.type === "completed")
                this.completed.emit(event.data);
            if (event.type === "cancelled")
                this.cancelled.emit(event.data);
        });
        if (this.autoStart) {
            this.doStart();
        }
    }
    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }
    doStart() {
        this.started = true;
        this.facade.start(this.path, this.initialData);
    }
    static { this.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: PathShellComponent, deps: [], target: i0.ɵɵFactoryTarget.Component }); }
    static { this.ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "17.3.12", type: PathShellComponent, isStandalone: true, selector: "pw-shell", inputs: { path: "path", initialData: "initialData", autoStart: "autoStart", backLabel: "backLabel", nextLabel: "nextLabel", completeLabel: "completeLabel", cancelLabel: "cancelLabel", hideCancel: "hideCancel", hideProgress: "hideProgress" }, outputs: { completed: "completed", cancelled: "cancelled", pathEvent: "pathEvent" }, providers: [PathFacade], queries: [{ propertyName: "customHeader", first: true, predicate: PathShellHeaderDirective, descendants: true }, { propertyName: "customFooter", first: true, predicate: PathShellFooterDirective, descendants: true }, { propertyName: "stepDirectives", predicate: PathStepDirective }], ngImport: i0, template: `
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
      </ng-template>

      <!-- Body — step content -->
      <div class="pw-shell__body">
        <ng-container *ngFor="let stepDir of stepDirectives">
          <ng-container *ngIf="stepDir.stepId === s.stepId">
            <ng-container *ngTemplateOutlet="stepDir.templateRef; injector: shellInjector"></ng-container>
          </ng-container>
        </ng-container>
      </div>

      <!-- Validation messages -->
      <ul class="pw-shell__validation" *ngIf="s.validationMessages.length > 0">
        <li *ngFor="let msg of s.validationMessages" class="pw-shell__validation-item">{{ msg }}</li>
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
  `, isInline: true, dependencies: [{ kind: "ngmodule", type: CommonModule }, { kind: "directive", type: i1.NgClass, selector: "[ngClass]", inputs: ["class", "ngClass"] }, { kind: "directive", type: i1.NgForOf, selector: "[ngFor][ngForOf]", inputs: ["ngForOf", "ngForTrackBy", "ngForTemplate"] }, { kind: "directive", type: i1.NgIf, selector: "[ngIf]", inputs: ["ngIf", "ngIfThen", "ngIfElse"] }, { kind: "directive", type: i1.NgTemplateOutlet, selector: "[ngTemplateOutlet]", inputs: ["ngTemplateOutletContext", "ngTemplateOutlet", "ngTemplateOutletInjector"] }, { kind: "pipe", type: i1.AsyncPipe, name: "async" }], changeDetection: i0.ChangeDetectionStrategy.Default }); }
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: PathShellComponent, decorators: [{
            type: Component,
            args: [{
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
      </ng-template>

      <!-- Body — step content -->
      <div class="pw-shell__body">
        <ng-container *ngFor="let stepDir of stepDirectives">
          <ng-container *ngIf="stepDir.stepId === s.stepId">
            <ng-container *ngTemplateOutlet="stepDir.templateRef; injector: shellInjector"></ng-container>
          </ng-container>
        </ng-container>
      </div>

      <!-- Validation messages -->
      <ul class="pw-shell__validation" *ngIf="s.validationMessages.length > 0">
        <li *ngFor="let msg of s.validationMessages" class="pw-shell__validation-item">{{ msg }}</li>
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
                }]
        }], propDecorators: { path: [{
                type: Input,
                args: [{ required: true }]
            }], initialData: [{
                type: Input
            }], autoStart: [{
                type: Input
            }], backLabel: [{
                type: Input
            }], nextLabel: [{
                type: Input
            }], completeLabel: [{
                type: Input
            }], cancelLabel: [{
                type: Input
            }], hideCancel: [{
                type: Input
            }], hideProgress: [{
                type: Input
            }], completed: [{
                type: Output
            }], cancelled: [{
                type: Output
            }], pathEvent: [{
                type: Output
            }], stepDirectives: [{
                type: ContentChildren,
                args: [PathStepDirective]
            }], customHeader: [{
                type: ContentChild,
                args: [PathShellHeaderDirective]
            }], customFooter: [{
                type: ContentChild,
                args: [PathShellFooterDirective]
            }] } });
//# sourceMappingURL=shell.js.map