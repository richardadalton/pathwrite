import { Injectable, OnDestroy, DestroyRef, signal, Signal, inject } from "@angular/core";
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
  private _engine = new PathEngine();
  private readonly _state$ = new BehaviorSubject<PathSnapshot<TData> | null>(null);
  private readonly _events$ = new Subject<PathEvent>();
  private _unsubscribeFromEngine: () => void = () => {};
  private readonly _stateSignal = signal<PathSnapshot<TData> | null>(null);

  public readonly state$: Observable<PathSnapshot<TData> | null> = this._state$.asObservable();
  public readonly events$: Observable<PathEvent> = this._events$.asObservable();
  /** Signal version of state$. Updates on every path state change. Requires Angular 16+. */
  public readonly stateSignal: Signal<PathSnapshot<TData> | null> = this._stateSignal.asReadonly();

  public constructor() {
    this.connectEngine(this._engine);
  }

  /**
   * Adopt an externally-managed `PathEngine` — for example, the engine returned
   * by `restoreOrStart()` from `@daltonr/pathwrite-store`.
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
  public adoptEngine(engine: PathEngine): void {
    // Disconnect from whatever engine we're currently listening to
    this._unsubscribeFromEngine();
    this._engine = engine;
    this.connectEngine(engine);
  }

  private connectEngine(engine: PathEngine): void {
    // Seed state immediately — critical when restoring a persisted path since
    // the engine is already running before the facade connects to it.
    const current = engine.snapshot() as PathSnapshot<TData> | null;
    this._state$.next(current);
    this._stateSignal.set(current);

    this._unsubscribeFromEngine = engine.subscribe((event) => {
      this._events$.next(event);
      if (event.type === "stateChanged" || event.type === "resumed") {
        this._state$.next(event.snapshot as PathSnapshot<TData>);
        this._stateSignal.set(event.snapshot as PathSnapshot<TData>);
      } else if (event.type === "completed" || event.type === "cancelled") {
        const snap = engine.snapshot() as PathSnapshot<TData> | null;
        this._state$.next(snap);
        this._stateSignal.set(snap);
      }
    });
  }

  public ngOnDestroy(): void {
    this._unsubscribeFromEngine();
    this._events$.complete();
    this._state$.complete();
  }

  public start(path: PathDefinition<any>, initialData: PathData = {}): Promise<void> {
    return this._engine.start(path, initialData);
  }

  /**
   * Tears down any active path (without firing lifecycle hooks) and immediately
   * starts the given path fresh. Safe to call whether or not a path is running.
   * Use for "Start over" / retry flows without destroying and re-creating the
   * component that provides this facade.
   */
  public restart(): Promise<void> {
    return this._engine.restart();
  }

  /** Re-runs the operation that set `snapshot().error`. Increments `retryCount` on repeated failure. No-op when there is no pending error. */
  public retry(): Promise<void> {
    return this._engine.retry();
  }

  /** Pauses the path with intent to return. Emits `suspended`. All state is preserved. */
  public suspend(): Promise<void> {
    return this._engine.suspend();
  }

  public startSubPath(path: PathDefinition<any>, initialData: PathData = {}, meta?: Record<string, unknown>): Promise<void> {
    return this._engine.startSubPath(path, initialData, meta);
  }

  public next(): Promise<void> {
    return this._engine.next();
  }

  public previous(): Promise<void> {
    return this._engine.previous();
  }

  public cancel(): Promise<void> {
    return this._engine.cancel();
  }

  public setData<K extends string & keyof TData>(key: K, value: TData[K]): Promise<void> {
    return this._engine.setData(key, value as unknown);
  }

  /** Reset the current step's data to what it was when the step was entered.
   *  Useful for "Clear" or "Reset" buttons that undo changes within a step. */
  public resetStep(): Promise<void> {
    return this._engine.resetStep();
  }

  public goToStep(stepId: string, options?: { validateOnLeave?: boolean }): Promise<void> {
    return this._engine.goToStep(stepId, options);
  }

  /** Jump to a step by ID, checking the current step's canMoveNext (forward) or
   *  canMovePrevious (backward) guard first. Navigation is blocked if the guard
   *  returns false. Throws if the step ID does not exist. */
  public goToStepChecked(stepId: string, options?: { validateOnLeave?: boolean }): Promise<void> {
    return this._engine.goToStepChecked(stepId, options);
  }

  public validate(): void {
    this._engine.validate();
  }

  public snapshot(): PathSnapshot<TData> | null {
    return this._state$.getValue();
  }
}

// ---------------------------------------------------------------------------
// usePathContext() - Signal-based path access
// ---------------------------------------------------------------------------

/**
 * Return type of `usePathContext()`. Provides signal-based reactive access to the
 * path state and strongly-typed navigation actions. Mirrors React's `usePathContext()`
 * return type for consistency across adapters.
 */
export interface UsePathContextReturn<TData extends PathData = PathData> {
  /** Current path snapshot as a signal. Returns `null` when no path is active. */
  snapshot: Signal<PathSnapshot<TData> | null>;
  /** Start (or restart) a path. */
  start: (path: PathDefinition<any>, initialData?: PathData) => Promise<void>;
  /** Push a sub-path onto the stack. */
  startSubPath: (path: PathDefinition<any>, initialData?: PathData, meta?: Record<string, unknown>) => Promise<void>;
  /** Advance one step. Completes the path on the last step. */
  next: () => Promise<void>;
  /** Go back one step. No-op when already on the first step. */
  previous: () => Promise<void>;
  /** Cancel the active path (or sub-path). */
  cancel: () => Promise<void>;
  /** Update a single data field. */
  setData: <K extends string & keyof TData>(key: K, value: TData[K]) => Promise<void>;
  /** Reset the current step's data to what it was when the step was entered. */
  resetStep: () => Promise<void>;
  /** Jump to a step by ID without checking guards. Pass `{ validateOnLeave: true }` to mark the departing step as attempted before navigating. */
  goToStep: (stepId: string, options?: { validateOnLeave?: boolean }) => Promise<void>;
  /** Jump to a step by ID, checking guards first. */
  goToStepChecked: (stepId: string, options?: { validateOnLeave?: boolean }) => Promise<void>;
  /**
   * Tears down any active path and immediately starts the given path fresh.
   * Use for "Start over" / retry flows.
   */
  restart: () => Promise<void>;
  /** Re-run the operation that set `snapshot().error`. */
  retry: () => Promise<void>;
  /** Pause with intent to return, preserving all state. Emits `suspended`. */
  suspend: () => Promise<void>;
}

/**
 * Access the nearest `PathFacade`'s path instance for use in Angular step components.
 * Requires `PathFacade` to be provided in the component's injector tree (either via
 * `providers: [PathFacade]` in the component or a parent component).
 *
 * **This is the recommended way to consume Pathwrite in Angular components** — it
 * provides the same ergonomic API as React's `usePathContext()` and Vue's `usePathContext()`.
 * No template references or manual facade injection needed.
 *
 * The optional generic `TData` narrows `snapshot().data` and `setData()` to your
 * data shape. It is a **type-level assertion**, not a runtime guarantee.
 *
 * @example
 * ```typescript
 * @Component({
 *   selector: 'app-contact-step',
 *   standalone: true,
 *   providers: [PathFacade],  // ← Provide at this component or a parent
 *   template: `
 *     @if (path.snapshot(); as s) {
 *       <div>Step: {{ s.activeStep?.title }}</div>
 *       <button (click)="path.next()">Next</button>
 *     }
 *   `
 * })
 * export class ContactStepComponent {
 *   protected readonly path = usePathContext<ContactData>();
 *
 *   updateName(name: string) {
 *     this.path.setData('name', name);
 *   }
 * }
 * ```
 *
 * @throws Error if PathFacade is not provided in the injector tree
 */
export function usePathContext<TData extends PathData = PathData>(): UsePathContextReturn<TData> {
  const facade = inject(PathFacade, { optional: true }) as PathFacade<TData> | null;

  if (!facade) {
    throw new Error(
      "usePathContext() requires PathFacade to be provided. " +
      "Add 'providers: [PathFacade]' to your component or a parent component."
    );
  }

  return {
    snapshot: facade.stateSignal,
    start: (path, initialData = {}) => facade.start(path, initialData),
    startSubPath: (path, initialData = {}, meta) => facade.startSubPath(path, initialData, meta),
    next: () => facade.next(),
    previous: () => facade.previous(),
    cancel: () => facade.cancel(),
    setData: (key, value) => facade.setData(key, value),
    resetStep: () => facade.resetStep(),
    goToStep: (stepId, options) => facade.goToStep(stepId, options),
    goToStepChecked: (stepId, options) => facade.goToStepChecked(stepId, options),
    restart: () => facade.restart(),
    retry: () => facade.retry(),
    suspend: () => facade.suspend(),
  };
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

// Re-export core types for convenience (users don't need to import from @daltonr/pathwrite-core)
export type {
  PathData,
  FieldErrors,
  PathDefinition,
  PathEvent,
  PathSnapshot,
  PathStep,
  PathStepContext,
  ProgressLayout,
  RootProgress,
  SerializedPathState
} from "@daltonr/pathwrite-core";

export { PathEngine } from "@daltonr/pathwrite-core";

