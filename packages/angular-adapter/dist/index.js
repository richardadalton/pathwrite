import { Injectable, signal } from "@angular/core";
import { BehaviorSubject, Subject } from "rxjs";
import { PathEngine } from "@daltonr/pathwrite-core";
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
export class PathFacade {
    constructor() {
        this._engine = new PathEngine();
        this._state$ = new BehaviorSubject(null);
        this._events$ = new Subject();
        this._unsubscribeFromEngine = () => { };
        this._stateSignal = signal(null);
        this.state$ = this._state$.asObservable();
        this.events$ = this._events$.asObservable();
        /** Signal version of state$. Updates on every path state change. Requires Angular 16+. */
        this.stateSignal = this._stateSignal.asReadonly();
        this.connectEngine(this._engine);
    }
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
    adoptEngine(engine) {
        // Disconnect from whatever engine we're currently listening to
        this._unsubscribeFromEngine();
        this._engine = engine;
        this.connectEngine(engine);
    }
    connectEngine(engine) {
        // Seed state immediately — critical when restoring a persisted path since
        // the engine is already running before the facade connects to it.
        const current = engine.snapshot();
        this._state$.next(current);
        this._stateSignal.set(current);
        this._unsubscribeFromEngine = engine.subscribe((event) => {
            this._events$.next(event);
            if (event.type === "stateChanged" || event.type === "resumed") {
                this._state$.next(event.snapshot);
                this._stateSignal.set(event.snapshot);
            }
            else if (event.type === "completed" || event.type === "cancelled") {
                this._state$.next(null);
                this._stateSignal.set(null);
            }
        });
    }
    ngOnDestroy() {
        this._unsubscribeFromEngine();
        this._events$.complete();
        this._state$.complete();
    }
    start(path, initialData = {}) {
        return this._engine.start(path, initialData);
    }
    /**
     * Tears down any active path (without firing lifecycle hooks) and immediately
     * starts the given path fresh. Safe to call whether or not a path is running.
     * Use for "Start over" / retry flows without destroying and re-creating the
     * component that provides this facade.
     */
    restart(path, initialData = {}) {
        return this._engine.restart(path, initialData);
    }
    startSubPath(path, initialData = {}, meta) {
        return this._engine.startSubPath(path, initialData, meta);
    }
    next() {
        return this._engine.next();
    }
    previous() {
        return this._engine.previous();
    }
    cancel() {
        return this._engine.cancel();
    }
    setData(key, value) {
        return this._engine.setData(key, value);
    }
    goToStep(stepId) {
        return this._engine.goToStep(stepId);
    }
    /** Jump to a step by ID, checking the current step's canMoveNext (forward) or
     *  canMovePrevious (backward) guard first. Navigation is blocked if the guard
     *  returns false. Throws if the step ID does not exist. */
    goToStepChecked(stepId) {
        return this._engine.goToStepChecked(stepId);
    }
    snapshot() {
        return this._state$.getValue();
    }
    static { this.ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: PathFacade, deps: [], target: i0.ɵɵFactoryTarget.Injectable }); }
    static { this.ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: PathFacade }); }
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "17.3.12", ngImport: i0, type: PathFacade, decorators: [{
            type: Injectable
        }], ctorParameters: () => [] });
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
export function syncFormGroup(facade, formGroup, destroyRef) {
    const baseFacade = facade;
    function applyValues() {
        if (baseFacade.snapshot() === null)
            return; // no active path — nothing to sync
        for (const [key, value] of Object.entries(formGroup.getRawValue())) {
            void baseFacade.setData(key, value);
        }
    }
    // Write current form values immediately so guards see the initial state.
    applyValues();
    const subscription = formGroup.valueChanges.subscribe(() => applyValues());
    const cleanup = () => subscription.unsubscribe();
    destroyRef?.onDestroy(cleanup);
    return cleanup;
}
export { PathEngine } from "@daltonr/pathwrite-core";
//# sourceMappingURL=index.js.map