import { Injectable, OnDestroy, DestroyRef, signal, Signal } from "@angular/core";
import { BehaviorSubject, Observable, Subject } from "rxjs";
import {
  PathData,
  PathDefinition,
  PathEngine,
  PathEvent,
  PathSnapshot
} from "@daltonr/pathwrite-core";

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
@Injectable()
export class PathFacade<TData extends PathData = PathData> implements OnDestroy {
  private readonly engine = new PathEngine();
  private readonly _state$ = new BehaviorSubject<PathSnapshot<TData> | null>(null);
  private readonly _events$ = new Subject<PathEvent>();
  private readonly unsubscribeFromEngine: () => void;
  private readonly _stateSignal = signal<PathSnapshot<TData> | null>(null);

  public readonly state$: Observable<PathSnapshot<TData> | null> = this._state$.asObservable();
  public readonly events$: Observable<PathEvent> = this._events$.asObservable();
  /** Signal version of state$. Updates on every path state change. Requires Angular 16+. */
  public readonly stateSignal: Signal<PathSnapshot<TData> | null> = this._stateSignal.asReadonly();

  public constructor() {
    this.unsubscribeFromEngine = this.engine.subscribe((event) => {
      this._events$.next(event);
      if (event.type === "stateChanged" || event.type === "resumed") {
        this._state$.next(event.snapshot as PathSnapshot<TData>);
        this._stateSignal.set(event.snapshot as PathSnapshot<TData>);
      } else if (event.type === "completed" || event.type === "cancelled") {
        this._state$.next(null);
        this._stateSignal.set(null);
      }
    });
  }

  public ngOnDestroy(): void {
    this.unsubscribeFromEngine();
    this._events$.complete();
    this._state$.complete();
  }

  public start(path: PathDefinition, initialData: PathData = {}): Promise<void> {
    return this.engine.start(path, initialData);
  }

  public startSubPath(path: PathDefinition, initialData: PathData = {}): Promise<void> {
    return this.engine.startSubPath(path, initialData);
  }

  public next(): Promise<void> {
    return this.engine.next();
  }

  public previous(): Promise<void> {
    return this.engine.previous();
  }

  public cancel(): Promise<void> {
    return this.engine.cancel();
  }

  public setData<K extends string & keyof TData>(key: K, value: TData[K]): Promise<void> {
    return this.engine.setData(key, value as unknown);
  }

  public goToStep(stepId: string): Promise<void> {
    return this.engine.goToStep(stepId);
  }

  /** Jump to a step by ID, checking the current step's canMoveNext (forward) or
   *  canMovePrevious (backward) guard first. Navigation is blocked if the guard
   *  returns false. Throws if the step ID does not exist. */
  public goToStepChecked(stepId: string): Promise<void> {
    return this.engine.goToStepChecked(stepId);
  }

  public snapshot(): PathSnapshot<TData> | null {
    return this._state$.getValue();
  }
}

// ---------------------------------------------------------------------------
// Forms integration
// ---------------------------------------------------------------------------

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
export function syncFormGroup<TData extends PathData = PathData>(
  facade: PathFacade<TData>,
  formGroup: FormGroupLike,
  destroyRef?: DestroyRef
): () => void {
  const baseFacade = facade as PathFacade<PathData>;

  function applyValues(): void {
    if (baseFacade.snapshot() === null) return; // no active path — nothing to sync
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
