import { TemplateRef, EventEmitter, QueryList, OnInit, OnDestroy, Injector } from "@angular/core";
import { PathData, PathDefinition, PathEvent, PathSnapshot } from "@daltonr/pathwrite-core";
import { PathFacade } from "./index";
import * as i0 from "@angular/core";
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
export declare class PathStepDirective {
    readonly templateRef: TemplateRef<unknown>;
    stepId: string;
    constructor(templateRef: TemplateRef<unknown>);
    static ɵfac: i0.ɵɵFactoryDeclaration<PathStepDirective, never>;
    static ɵdir: i0.ɵɵDirectiveDeclaration<PathStepDirective, "[pwStep]", never, { "stepId": { "alias": "pwStep"; "required": true; }; }, {}, never, never, true, never>;
}
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
export declare class PathShellHeaderDirective {
    readonly templateRef: TemplateRef<{
        $implicit: PathSnapshot;
    }>;
    constructor(templateRef: TemplateRef<{
        $implicit: PathSnapshot;
    }>);
    static ɵfac: i0.ɵɵFactoryDeclaration<PathShellHeaderDirective, never>;
    static ɵdir: i0.ɵɵDirectiveDeclaration<PathShellHeaderDirective, "[pwShellHeader]", never, {}, {}, never, never, true, never>;
}
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
export declare class PathShellFooterDirective {
    readonly templateRef: TemplateRef<{
        $implicit: PathSnapshot;
        actions: PathShellActions;
    }>;
    constructor(templateRef: TemplateRef<{
        $implicit: PathSnapshot;
        actions: PathShellActions;
    }>);
    static ɵfac: i0.ɵɵFactoryDeclaration<PathShellFooterDirective, never>;
    static ɵdir: i0.ɵɵDirectiveDeclaration<PathShellFooterDirective, "[pwShellFooter]", never, {}, {}, never, never, true, never>;
}
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
export declare class PathShellComponent implements OnInit, OnDestroy {
    /** The path definition to run. Required. */
    path: PathDefinition<any>;
    /** Initial data merged into the path engine on start. */
    initialData: PathData;
    /** Start the path automatically on ngOnInit. Set to false to call doStart() manually. */
    autoStart: boolean;
    /** Label for the Back navigation button. */
    backLabel: string;
    /** Label for the Next navigation button. */
    nextLabel: string;
    /** Label for the Next button when on the last step. */
    completeLabel: string;
    /** Label for the Cancel button. */
    cancelLabel: string;
    /** Hide the Cancel button entirely. */
    hideCancel: boolean;
    /** Hide the step progress indicator in the header. */
    hideProgress: boolean;
    completed: EventEmitter<PathData>;
    cancelled: EventEmitter<PathData>;
    pathEvent: EventEmitter<PathEvent>;
    stepDirectives: QueryList<PathStepDirective>;
    customHeader?: PathShellHeaderDirective;
    customFooter?: PathShellFooterDirective;
    readonly facade: PathFacade<PathData>;
    /** The shell's own component-level injector. Passed to ngTemplateOutlet so that
     *  step components can resolve PathFacade (provided by this shell) via inject(). */
    protected readonly shellInjector: Injector;
    started: boolean;
    /** Navigation actions passed to custom `pwShellFooter` templates. */
    protected readonly shellActions: PathShellActions;
    private readonly destroy$;
    ngOnInit(): void;
    ngOnDestroy(): void;
    doStart(): void;
    static ɵfac: i0.ɵɵFactoryDeclaration<PathShellComponent, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<PathShellComponent, "pw-shell", never, { "path": { "alias": "path"; "required": true; }; "initialData": { "alias": "initialData"; "required": false; }; "autoStart": { "alias": "autoStart"; "required": false; }; "backLabel": { "alias": "backLabel"; "required": false; }; "nextLabel": { "alias": "nextLabel"; "required": false; }; "completeLabel": { "alias": "completeLabel"; "required": false; }; "cancelLabel": { "alias": "cancelLabel"; "required": false; }; "hideCancel": { "alias": "hideCancel"; "required": false; }; "hideProgress": { "alias": "hideProgress"; "required": false; }; }, { "completed": "completed"; "cancelled": "cancelled"; "pathEvent": "pathEvent"; }, ["customHeader", "customFooter", "stepDirectives"], never, true, never>;
}
