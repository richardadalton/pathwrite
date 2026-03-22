import { OnDestroy, DestroyRef, Signal } from "@angular/core";
import { Observable } from "rxjs";
import { PathData, PathDefinition, PathEngine, PathEvent, PathSnapshot } from "@daltonr/pathwrite-core";
import * as i0 from "@angular/core";
/**
 * Angular facade over PathEngine. Provide at component level for an isolated
 * instance per component; Angular handles cleanup via ngOnDestroy.
 *
 * The optional generic `TData` narrows `state$`, `stateSignal`, `snapshot()`,
 * and `setData()` to your data shape. It is a **type-level assertion** — no
 * runtime validation is performed. Inject as `PathFacade` (untyped default)
 * then cast:
 *
 * ```typescript
 * const facade = inject(PathFacade) as PathFacade<MyData>;
 * facade.snapshot()?.data.name; // typed as string (or whatever MyData defines)
 * ```
 */
export declare class PathFacade<TData extends PathData = PathData> implements OnDestroy {
    private _engine;
    private readonly _state$;
    private readonly _events$;
    private _unsubscribeFromEngine;
    private readonly _stateSignal;
    readonly state$: Observable<PathSnapshot<TData> | null>;
    readonly events$: Observable<PathEvent>;
    /** Signal version of state$. Updates on every path state change. Requires Angular 16+. */
    readonly stateSignal: Signal<PathSnapshot<TData> | null>;
    constructor();
    /**
     * Adopt an externally-managed `PathEngine` — for example, the engine returned
     * by `restoreOrStart()` from `@daltonr/pathwrite-store-http`.
     *
     * The facade immediately reflects the engine's current state and forwards all
     * subsequent events. The **caller** is responsible for the engine's lifecycle
     * (starting, cleanup); the facade only subscribes to it.
     *
     * ```typescript
     * const { engine } = await restoreOrStart({ store, key, path, initialData, observers: [...] });
     * facade.adoptEngine(engine);
     * ```
     */
    adoptEngine(engine: PathEngine): void;
    private connectEngine;
    ngOnDestroy(): void;
    start(path: PathDefinition<any>, initialData?: PathData): Promise<void>;
    /**
     * Tears down any active path (without firing lifecycle hooks) and immediately
     * starts the given path fresh. Safe to call whether or not a path is running.
     * Use for "Start over" / retry flows without destroying and re-creating the
     * component that provides this facade.
     */
    restart(path: PathDefinition<any>, initialData?: PathData): Promise<void>;
    startSubPath(path: PathDefinition<any>, initialData?: PathData, meta?: Record<string, unknown>): Promise<void>;
    next(): Promise<void>;
    previous(): Promise<void>;
    cancel(): Promise<void>;
    setData<K extends string & keyof TData>(key: K, value: TData[K]): Promise<void>;
    goToStep(stepId: string): Promise<void>;
    /** Jump to a step by ID, checking the current step's canMoveNext (forward) or
     *  canMovePrevious (backward) guard first. Navigation is blocked if the guard
     *  returns false. Throws if the step ID does not exist. */
    goToStepChecked(stepId: string): Promise<void>;
    snapshot(): PathSnapshot<TData> | null;
    static ɵfac: i0.ɵɵFactoryDeclaration<PathFacade<any>, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<PathFacade<any>>;
}
/**
 * Minimal interface describing what syncFormGroup needs from an Angular
 * FormGroup. Typed as a duck interface so that @angular/forms is not a
 * required import — any object with getRawValue() and valueChanges works.
 *
 * Angular's FormGroup satisfies this interface automatically.
 */
export interface FormGroupLike {
    /** Returns all control values including disabled ones (FormGroup.getRawValue()). */
    getRawValue(): Record<string, unknown>;
    /** Observable that emits whenever any control value changes. */
    readonly valueChanges: Observable<unknown>;
}
/**
 * Syncs every key of an Angular FormGroup to the path engine via setData.
 *
 * - Immediately writes getRawValue() to the facade so canMoveNext guards
 *   evaluate against the current form state on the very first snapshot.
 * - Subscribes to valueChanges and re-applies getRawValue() on every emission
 *   so disabled controls are always included.
 * - Guards against calling setData when no path is active, so it is safe to
 *   call syncFormGroup before or after facade.start().
 * - Returns a cleanup function that unsubscribes from the observable.
 *   Pass a DestroyRef to wire cleanup automatically to the component lifecycle.
 *
 * @example
 * ```typescript
 * export class MyStepComponent implements OnInit {
 *   private readonly facade = inject(PathFacade) as PathFacade<MyData>;
 *   protected readonly form = new FormGroup({
 *     name:  new FormControl('', Validators.required),
 *     email: new FormControl(''),
 *   });
 *
 *   ngOnInit() {
 *     syncFormGroup(this.facade, this.form, inject(DestroyRef));
 *   }
 * }
 * ```
 */
export declare function syncFormGroup<TData extends PathData = PathData>(facade: PathFacade<TData>, formGroup: FormGroupLike, destroyRef?: DestroyRef): () => void;
export type { PathData, PathDefinition, PathEvent, PathSnapshot, PathStep, PathStepContext, SerializedPathState } from "@daltonr/pathwrite-core";
export { PathEngine } from "@daltonr/pathwrite-core";
