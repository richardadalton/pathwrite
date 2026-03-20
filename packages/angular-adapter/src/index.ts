import { Injectable, OnDestroy, DestroyRef, signal, Signal } from "@angular/core";
import { BehaviorSubject, Observable, Subject } from "rxjs";
import {
  PathData,
  PathDefinition,
  PathEngine,
  PathEvent,
  PathSnapshot
} from "@daltonr/pathwrite-core";

@Injectable()
export class PathFacade implements OnDestroy {
  private readonly engine = new PathEngine();
  private readonly _state$ = new BehaviorSubject<PathSnapshot | null>(null);
  private readonly _events$ = new Subject<PathEvent>();
  private readonly unsubscribeFromEngine: () => void;
  private readonly _stateSignal = signal<PathSnapshot | null>(null);

  public readonly state$: Observable<PathSnapshot | null> = this._state$.asObservable();
  public readonly events$: Observable<PathEvent> = this._events$.asObservable();
  /** Signal version of state$. Updates on every path state change. Requires Angular 16+. */
  public readonly stateSignal: Signal<PathSnapshot | null> = this._stateSignal.asReadonly();

  public constructor() {
    this.unsubscribeFromEngine = this.engine.subscribe((event) => {
      this._events$.next(event);
      if (event.type === "stateChanged" || event.type === "resumed") {
        this._state$.next(event.snapshot);
        this._stateSignal.set(event.snapshot);
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

  public setData(key: string, value: unknown): Promise<void> {
    return this.engine.setData(key, value);
  }

  public goToStep(stepId: string): Promise<void> {
    return this.engine.goToStep(stepId);
  }

  public snapshot(): PathSnapshot | null {
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
 *   private readonly facade = inject(PathFacade);
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
export function syncFormGroup(
  facade: PathFacade,
  formGroup: FormGroupLike,
  destroyRef?: DestroyRef
): () => void {
  function applyValues(): void {
    if (facade.snapshot() === null) return; // no active path — nothing to sync
    for (const [key, value] of Object.entries(formGroup.getRawValue())) {
      void facade.setData(key, value);
    }
  }

  // Write current form values immediately so guards see the initial state.
  applyValues();

  const subscription = formGroup.valueChanges.subscribe(() => applyValues());

  const cleanup = () => subscription.unsubscribe();
  destroyRef?.onDestroy(cleanup);
  return cleanup;
}
