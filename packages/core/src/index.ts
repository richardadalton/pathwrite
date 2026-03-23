export type PathData = Record<string, unknown>;

/**
 * The return type of a `fieldMessages` hook. Each key is a field ID; the value
 * is an error string, or `undefined` / omitted to indicate no error for that field.
 *
 * Use `"_"` as a key for form-level errors that don't belong to a specific field:
 * ```typescript
 * { _: "You must accept the terms and conditions." }
 * ```
 */
export type FieldErrors = Record<string, string | undefined>;

export interface SerializedPathState {
  version: 1;
  pathId: string;
  currentStepIndex: number;
  data: PathData;
  visitedStepIds: string[];
  subPathMeta?: Record<string, unknown>;
  pathStack: Array<{
    pathId: string;
    currentStepIndex: number;
    data: PathData;
    visitedStepIds: string[];
    subPathMeta?: Record<string, unknown>;
  }>;
  _isNavigating: boolean;
}

/**
 * The interface every path state store must implement.
 *
 * `HttpStore` from `@daltonr/pathwrite-store-http` is the reference
 * implementation. Any backend — MongoDB, Redis, localStorage, etc. —
 * implements this interface and works with `httpPersistence` and
 * `restoreOrStart` without any other changes.
 */
export interface PathStore {
  save(key: string, state: SerializedPathState): Promise<void>;
  load(key: string): Promise<SerializedPathState | null>;
  delete(key: string): Promise<void>;
}

export interface PathStepContext<TData extends PathData = PathData> {
  readonly pathId: string;
  readonly stepId: string;
  readonly data: Readonly<TData>;
  /**
   * `true` the first time this step is entered within the current path
   * instance. `false` on all subsequent re-entries (e.g. navigating back
   * then forward again). Use inside `onEnter` to distinguish initialisation
   * from re-entry so you don't accidentally overwrite data the user has
   * already filled in.
   */
  readonly isFirstEntry: boolean;
}

export interface PathStep<TData extends PathData = PathData> {
  id: string;
  title?: string;
  meta?: Record<string, unknown>;
  shouldSkip?: (ctx: PathStepContext<TData>) => boolean | Promise<boolean>;
  canMoveNext?: (ctx: PathStepContext<TData>) => boolean | Promise<boolean>;
  canMovePrevious?: (ctx: PathStepContext<TData>) => boolean | Promise<boolean>;
  /**
   * Returns a map of field ID → error message explaining why the step is not
   * yet valid. The shell displays these messages below the step content (labeled
   * by field name) so consumers do not need to duplicate validation logic in
   * the template. Return `undefined` for a field to indicate no error.
   *
   * When `fieldMessages` is provided and `canMoveNext` is **not**, the engine
   * automatically derives `canMoveNext` as `true` when all values are `undefined`
   * (i.e. no messages), eliminating the need to express the same logic twice.
   *
   * Evaluated synchronously on every snapshot; async functions default to `{}`.
   *
   * @example
   * ```typescript
   * fieldMessages: ({ data }) => ({
   *   name:  !data.name?.trim()        ? "Required."             : undefined,
   *   email: !isValidEmail(data.email) ? "Invalid email address." : undefined,
   * })
   * ```
   */
  fieldMessages?: (ctx: PathStepContext<TData>) => FieldErrors;
  onEnter?: (ctx: PathStepContext<TData>) => Partial<TData> | void | Promise<Partial<TData> | void>;
  onLeave?: (ctx: PathStepContext<TData>) => Partial<TData> | void | Promise<Partial<TData> | void>;
  /**
   * Called on the parent step when a sub-path completes naturally (user
   * reached the last step). Receives the sub-path ID, its final data, the
   * parent step context, and the optional `meta` object that was passed to
   * `startSubPath()` for correlation (e.g. a collection item index).
   */
  onSubPathComplete?: (
    subPathId: string,
    subPathData: PathData,
    ctx: PathStepContext<TData>,
    meta?: Record<string, unknown>
  ) => Partial<TData> | void | Promise<Partial<TData> | void>;
  /**
   * Called on the parent step when a sub-path is cancelled — either via an
   * explicit `cancel()` call or by pressing Back on the sub-path's first step.
   * Receives the sub-path ID, its data at time of cancellation, the parent
   * step context, and the optional `meta` passed to `startSubPath()`.
   * Return a patch to update the parent path's data (e.g. to record a
   * "skipped" or "declined" outcome).
   */
  onSubPathCancel?: (
    subPathId: string,
    subPathData: PathData,
    ctx: PathStepContext<TData>,
    meta?: Record<string, unknown>
  ) => Partial<TData> | void | Promise<Partial<TData> | void>;
}

export interface PathDefinition<TData extends PathData = PathData> {
  id: string;
  title?: string;
  steps: PathStep<TData>[];
}

export type StepStatus = "completed" | "current" | "upcoming";

export interface StepSummary {
  id: string;
  title?: string;
  meta?: Record<string, unknown>;
  status: StepStatus;
}

/**
 * Controls how the shell renders progress bars when a sub-path is active.
 *
 * | Value          | Behaviour                                                              |
 * |----------------|------------------------------------------------------------------------|
 * | `"merged"`     | Root and sub-path bars in one card (default)                           |
 * | `"split"`      | Root and sub-path bars as separate cards                               |
 * | `"rootOnly"`   | Only the root bar — sub-path bar hidden                                |
 * | `"activeOnly"` | Only the active (sub-path) bar — root bar hidden (pre-v0.7 behaviour) |
 */
export type ProgressLayout = "merged" | "split" | "rootOnly" | "activeOnly";

/**
 * Summary of the root (top-level) path's progress. Present on `PathSnapshot`
 * only when `nestingLevel > 0` — i.e. a sub-path is active.
 *
 * Shells use this to keep the top-level progress bar visible while navigating
 * a sub-path, so users never lose sight of where they are in the main flow.
 */
export interface RootProgress {
  pathId: string;
  stepIndex: number;
  stepCount: number;
  progress: number;
  steps: StepSummary[];
}

export interface PathSnapshot<TData extends PathData = PathData> {
  pathId: string;
  stepId: string;
  stepTitle?: string;
  stepMeta?: Record<string, unknown>;
  stepIndex: number;
  stepCount: number;
  progress: number;
  steps: StepSummary[];
  isFirstStep: boolean;
  isLastStep: boolean;
  nestingLevel: number;
  /**
   * Progress summary of the root (top-level) path. Only present when
   * `nestingLevel > 0`. Shells use this to render a persistent top-level
   * progress bar above the sub-path's own progress bar.
   */
  rootProgress?: RootProgress;
  /** True while an async guard or hook is executing. Use to disable navigation controls. */
  isNavigating: boolean;
  /** Whether the current step's `canMoveNext` guard allows advancing. Async guards default to `true`. Auto-derived as `true` when `fieldMessages` is defined and returns no messages, and `canMoveNext` is not explicitly defined. */
  canMoveNext: boolean;
  /** Whether the current step's `canMovePrevious` guard allows going back. Async guards default to `true`. */
  canMovePrevious: boolean;
  /**
   * True after the user has clicked Next / Submit on this step at least once,
   * regardless of whether navigation succeeded. Resets to `false` when entering
   * a new step.
   *
   * Use this to gate inline field-error display so errors are hidden on first
   * render and only appear after the user has attempted to proceed:
   *
   * ```svelte
   * {#if snapshot.hasAttemptedNext && snapshot.fieldMessages.email}
   *   <span class="error">{snapshot.fieldMessages.email}</span>
   * {/if}
   * ```
   *
   * The shell itself uses this flag to gate its own automatic `fieldMessages`
   * summary rendering — errors are never shown before the first Next attempt.
   */
  hasAttemptedNext: boolean;
  /**
   * Field-keyed validation messages for the current step. Empty object when there are none.
   * Use in step templates to render inline per-field errors: `snapshot.fieldMessages['email']`.
   * The shell also renders these automatically in a labeled summary box.
   * Use `"_"` as a key for form-level (non-field-specific) errors.
   */
  fieldMessages: Record<string, string>;
  data: TData;
}

/**
 * Identifies the public method that triggered a `stateChanged` event.
 */
export type StateChangeCause =
  | "start"
  | "next"
  | "previous"
  | "goToStep"
  | "goToStepChecked"
  | "setData"
  | "cancel"
  | "restart";

export type PathEvent =
  | { type: "stateChanged"; cause: StateChangeCause; snapshot: PathSnapshot }
  | { type: "completed"; pathId: string; data: PathData }
  | { type: "cancelled"; pathId: string; data: PathData }
  | {
      type: "resumed";
      resumedPathId: string;
      fromSubPathId: string;
      snapshot: PathSnapshot;
    };

/**
 * A function called on every engine event. Observers are registered at
 * construction time and receive every event for the lifetime of the engine.
 *
 * The second argument is the engine itself — useful when the observer needs to
 * read current state (e.g. calling `engine.exportState()` for persistence).
 *
 * ```typescript
 * const logger: PathObserver = (event) => console.log(event.type);
 * const persist: PathObserver = (event, engine) => { ... };
 * ```
 */
export type PathObserver = (event: PathEvent, engine: PathEngine) => void;

/**
 * Determines which engine events an observer should react to.
 *
 * | Strategy            | Triggers when                                              |
 * |---------------------|------------------------------------------------------------|
 * | `"onEveryChange"`   | Any settled `stateChanged` or `resumed`                    |
 * | `"onNext"`          | `next()` completes navigation *(default)*                  |
 * | `"onSubPathComplete"` | Sub-path finishes and the parent resumes                 |
 * | `"onComplete"`      | The entire path completes                                  |
 * | `"manual"`          | Never — caller decides when to act                        |
 */
export type ObserverStrategy =
  | "onEveryChange"
  | "onNext"
  | "onSubPathComplete"
  | "onComplete"
  | "manual";

/**
 * Returns `true` when `event` matches the trigger condition for `strategy`.
 *
 * Use this in any `PathObserver` factory to centralise the
 * "which events should I react to?" decision so every observer
 * (HTTP, MongoDB, logger, analytics…) shares the same semantics.
 *
 * ```typescript
 * const observer: PathObserver = (event, engine) => {
 *   if (matchesStrategy(strategy, event)) doWork(engine);
 * };
 * ```
 */
export function matchesStrategy(strategy: ObserverStrategy, event: PathEvent): boolean {
  switch (strategy) {
    case "onEveryChange":
      // Only react once navigation has settled — stateChanged fires twice per
      // navigation (isNavigating:true then false).
      return (event.type === "stateChanged" && !event.snapshot.isNavigating)
        || event.type === "resumed";
    case "onNext":
      return event.type === "stateChanged"
        && event.cause === "next"
        && !event.snapshot.isNavigating;
    case "onSubPathComplete":
      return event.type === "resumed";
    case "onComplete":
      return event.type === "completed";
    case "manual":
      return false;
  }
}

/**
 * Options accepted by the `PathEngine` constructor and `PathEngine.fromState()`.
 */
export interface PathEngineOptions {
  /**
   * Zero or more observers to register before the first event fires.
   * Each observer is called synchronously on every engine event for the
   * lifetime of the engine. Observers cannot be removed; for removable
   * listeners use `engine.subscribe()`.
   */
  observers?: PathObserver[];
}

interface ActivePath {
  definition: PathDefinition;
  currentStepIndex: number;
  data: PathData;
  visitedStepIds: Set<string>;
  subPathMeta?: Record<string, unknown>;
}

export class PathEngine {
  private activePath: ActivePath | null = null;
  private readonly pathStack: ActivePath[] = [];
  private readonly listeners = new Set<(event: PathEvent) => void>();
  private _isNavigating = false;
  /** True after the user has called next() on the current step at least once. Resets on step entry. */
  private _hasAttemptedNext = false;

  constructor(options?: PathEngineOptions) {
    if (options?.observers) {
      for (const observer of options.observers) {
        // Wrap so observer receives the engine instance as the second argument
        this.listeners.add((event) => observer(event, this));
      }
    }
  }

  /**
   * Restores a PathEngine from previously exported state.
   *
   * **Important:** You must provide the same path definitions that were
   * active when the state was exported. The path IDs in `state` are used
   * to match against the provided definitions.
   *
   * @param state           The serialized state from `exportState()`.
   * @param pathDefinitions A map of path ID → definition. Must include the
   *                        active path and any paths in the stack.
   * @returns A new PathEngine instance with the restored state.
   * @throws If `state` references a path ID not present in `pathDefinitions`,
   *         or if the state format is invalid.
   */
  public static fromState(
    state: SerializedPathState,
    pathDefinitions: Record<string, PathDefinition>,
    options?: PathEngineOptions
  ): PathEngine {
    if (state.version !== 1) {
      throw new Error(`Unsupported SerializedPathState version: ${state.version}`);
    }

    const engine = new PathEngine(options);

    // Restore the path stack (sub-paths)
    for (const stackItem of state.pathStack) {
      const definition = pathDefinitions[stackItem.pathId];
      if (!definition) {
        throw new Error(
          `Cannot restore state: path definition "${stackItem.pathId}" not found. ` +
          `Provide all path definitions that were active when state was exported.`
        );
      }
      engine.pathStack.push({
        definition,
        currentStepIndex: stackItem.currentStepIndex,
        data: { ...stackItem.data },
        visitedStepIds: new Set(stackItem.visitedStepIds),
        subPathMeta: stackItem.subPathMeta ? { ...stackItem.subPathMeta } : undefined
      });
    }

    // Restore the active path
    const activeDefinition = pathDefinitions[state.pathId];
    if (!activeDefinition) {
      throw new Error(
        `Cannot restore state: active path definition "${state.pathId}" not found.`
      );
    }

    engine.activePath = {
      definition: activeDefinition,
      currentStepIndex: state.currentStepIndex,
      data: { ...state.data },
      visitedStepIds: new Set(state.visitedStepIds),
      // Active path's subPathMeta is not serialized (it's transient metadata
      // from the parent when this path was started). On restore, it's undefined.
      subPathMeta: undefined
    };

    engine._isNavigating = state._isNavigating;

    return engine;
  }

  public subscribe(listener: (event: PathEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  public start(path: PathDefinition<any>, initialData: PathData = {}): Promise<void> {
    this.assertPathHasSteps(path);
    return this._startAsync(path, initialData);
  }

  /**
   * Tears down any active path (and the entire sub-path stack) without firing
   * lifecycle hooks or emitting `cancelled`, then immediately starts the given
   * path from scratch.
   *
   * Safe to call at any time — whether a path is running, already completed,
   * or has never been started. Use this to implement a "Start over" button or
   * to retry a path after completion without remounting the host component.
   *
   * @param path        The path definition to (re)start.
   * @param initialData Data to seed the fresh path with. Defaults to `{}`.
   */
  public restart(path: PathDefinition<any>, initialData: PathData = {}): Promise<void> {
    this.assertPathHasSteps(path);
    this._isNavigating = false;
    this.activePath = null;
    this.pathStack.length = 0;
    return this._startAsync(path, initialData);
  }

  /**
   * Starts a sub-path on top of the currently active path. Throws if no path
   * is running.
   *
   * @param path        The sub-path definition to start.
   * @param initialData Data to seed the sub-path with.
   * @param meta        Optional correlation object returned unchanged to the
   *                    parent step's `onSubPathComplete` / `onSubPathCancel`
   *                    hooks. Use to identify which collection item triggered
   *                    the sub-path without embedding that information in the
   *                    sub-path's own data.
   */
  public startSubPath(path: PathDefinition<any>, initialData: PathData = {}, meta?: Record<string, unknown>): Promise<void> {
    this.requireActivePath();
    return this._startAsync(path, initialData, meta);
  }

  public next(): Promise<void> {
    const active = this.requireActivePath();
    return this._nextAsync(active);
  }

  public previous(): Promise<void> {
    const active = this.requireActivePath();
    return this._previousAsync(active);
  }

  /** Cancel is synchronous for top-level paths (no hooks). Sub-path cancellation
   *  is async when an `onSubPathCancel` hook is present. Returns a Promise for
   *  API consistency. */
  public cancel(): Promise<void> {
    const active = this.requireActivePath();
    if (this._isNavigating) return Promise.resolve();

    const cancelledPathId = active.definition.id;
    const cancelledData = { ...active.data };

    if (this.pathStack.length > 0) {
      // Get meta from the parent in the stack
      const parent = this.pathStack[this.pathStack.length - 1];
      const cancelledMeta = parent.subPathMeta;
      return this._cancelSubPathAsync(cancelledPathId, cancelledData, cancelledMeta);
    }

    this.activePath = null;
    this.emit({ type: "cancelled", pathId: cancelledPathId, data: cancelledData });
    return Promise.resolve();
  }

  public setData(key: string, value: unknown): Promise<void> {
    const active = this.requireActivePath();
    active.data[key] = value;
    this.emitStateChanged("setData");
    return Promise.resolve();
  }

  /** Jumps directly to the step with the given ID. Does not check guards or shouldSkip. */
  public goToStep(stepId: string): Promise<void> {
    const active = this.requireActivePath();
    const targetIndex = active.definition.steps.findIndex((s) => s.id === stepId);
    if (targetIndex === -1) {
      throw new Error(`Step "${stepId}" not found in path "${active.definition.id}".`);
    }
    return this._goToStepAsync(active, targetIndex);
  }

  /**
   * Jumps directly to the step with the given ID, but first checks the
   * direction-appropriate guard on the current step:
   * - Going forward  → checks `canMoveNext`
   * - Going backward → checks `canMovePrevious`
   *
   * If the guard blocks, navigation does not occur and `stateChanged` is still
   * emitted (so the UI can react). `shouldSkip` is not evaluated.
   * Throws if the target step ID does not exist.
   */
  public goToStepChecked(stepId: string): Promise<void> {
    const active = this.requireActivePath();
    const targetIndex = active.definition.steps.findIndex((s) => s.id === stepId);
    if (targetIndex === -1) {
      return Promise.reject(new Error(`Step "${stepId}" not found in path "${active.definition.id}".`));
    }
    if (targetIndex === active.currentStepIndex) return Promise.resolve();
    return this._goToStepCheckedAsync(active, targetIndex);
  }

  public snapshot(): PathSnapshot | null {
    if (this.activePath === null) {
      return null;
    }

    const active = this.activePath;
    const step = this.getCurrentStep(active);
    const { steps } = active.definition;
    const stepCount = steps.length;

    // Build rootProgress from the bottom of the stack (the top-level path)
    let rootProgress: RootProgress | undefined;
    if (this.pathStack.length > 0) {
      const root = this.pathStack[0];
      const rootSteps = root.definition.steps;
      const rootStepCount = rootSteps.length;
      rootProgress = {
        pathId: root.definition.id,
        stepIndex: root.currentStepIndex,
        stepCount: rootStepCount,
        progress: rootStepCount <= 1 ? 1 : root.currentStepIndex / (rootStepCount - 1),
        steps: rootSteps.map((s, i) => ({
          id: s.id,
          title: s.title,
          meta: s.meta,
          status: i < root.currentStepIndex ? "completed" as const
            : i === root.currentStepIndex ? "current" as const
            : "upcoming" as const
        }))
      };
    }

    return {
      pathId: active.definition.id,
      stepId: step.id,
      stepTitle: step.title,
      stepMeta: step.meta,
      stepIndex: active.currentStepIndex,
      stepCount,
      progress: stepCount <= 1 ? 1 : active.currentStepIndex / (stepCount - 1),
      steps: steps.map((s, i) => ({
        id: s.id,
        title: s.title,
        meta: s.meta,
        status: i < active.currentStepIndex ? "completed" as const
          : i === active.currentStepIndex ? "current" as const
          : "upcoming" as const
      })),
      isFirstStep: active.currentStepIndex === 0,
      isLastStep:
        active.currentStepIndex === stepCount - 1 &&
        this.pathStack.length === 0,
      nestingLevel: this.pathStack.length,
      rootProgress,
      isNavigating: this._isNavigating,
      hasAttemptedNext: this._hasAttemptedNext,
      canMoveNext: this.evaluateCanMoveNextSync(step, active),
      canMovePrevious: this.evaluateGuardSync(step.canMovePrevious, active),
      fieldMessages: this.evaluateFieldMessagesSync(step.fieldMessages, active),
      data: { ...active.data }
    };
  }

  /**
   * Exports the current engine state as a plain JSON-serializable object.
   * Use with storage adapters (e.g. `@daltonr/pathwrite-store-http`) to
   * persist and restore wizard progress.
   *
   * Returns `null` if no path is active.
   *
   * **Important:** This only exports the _state_ (data, step position, etc.),
   * not the path definition. When restoring, you must provide the same
   * `PathDefinition` to `fromState()`.
   */
  public exportState(): SerializedPathState | null {
    if (this.activePath === null) {
      return null;
    }

    const active = this.activePath;

    return {
      version: 1,
      pathId: active.definition.id,
      currentStepIndex: active.currentStepIndex,
      data: { ...active.data },
      visitedStepIds: Array.from(active.visitedStepIds),
      pathStack: this.pathStack.map((p) => ({
        pathId: p.definition.id,
        currentStepIndex: p.currentStepIndex,
        data: { ...p.data },
        visitedStepIds: Array.from(p.visitedStepIds),
        subPathMeta: p.subPathMeta ? { ...p.subPathMeta } : undefined
      })),
      _isNavigating: this._isNavigating
    };
  }

  // ---------------------------------------------------------------------------
  // Private async helpers
  // ---------------------------------------------------------------------------

  private async _startAsync(path: PathDefinition, initialData: PathData, subPathMeta?: Record<string, unknown>): Promise<void> {
    if (this._isNavigating) return;

    if (this.activePath !== null) {
      // Store the meta on the parent before pushing to stack
      const parentWithMeta: ActivePath = {
        ...this.activePath,
        subPathMeta
      };
      this.pathStack.push(parentWithMeta);
    }

    this.activePath = {
      definition: path,
      currentStepIndex: 0,
      data: { ...initialData },
      visitedStepIds: new Set(),
      subPathMeta: undefined
    };

    this._isNavigating = true;

    await this.skipSteps(1);

    if (this.activePath.currentStepIndex >= path.steps.length) {
      this._isNavigating = false;
      await this.finishActivePath();
      return;
    }

    this.emitStateChanged("start");

    try {
      this.applyPatch(await this.enterCurrentStep());
      this._isNavigating = false;
      this.emitStateChanged("start");
    } catch (err) {
      this._isNavigating = false;
      this.emitStateChanged("start");
      throw err;
    }
  }

  private async _nextAsync(active: ActivePath): Promise<void> {
    if (this._isNavigating) return;

    // Record that the user has attempted to advance — used by shells and step
    // templates to gate error display ("punish late, reward early").
    this._hasAttemptedNext = true;
    this._isNavigating = true;
    this.emitStateChanged("next");

    try {
      const step = this.getCurrentStep(active);

      if (await this.canMoveNext(active, step)) {
        this.applyPatch(await this.leaveCurrentStep(active, step));
        active.currentStepIndex += 1;
        await this.skipSteps(1);

        if (active.currentStepIndex >= active.definition.steps.length) {
          this._isNavigating = false;
          await this.finishActivePath();
          return;
        }

        this.applyPatch(await this.enterCurrentStep());
      }

      this._isNavigating = false;
      this.emitStateChanged("next");
    } catch (err) {
      this._isNavigating = false;
      this.emitStateChanged("next");
      throw err;
    }
  }

  private async _previousAsync(active: ActivePath): Promise<void> {
    if (this._isNavigating) return;

    // No-op when already on the first step of a top-level path.
    // Sub-paths still cancel/pop back to the parent when previous() is called
    // on their first step (the currentStepIndex < 0 branch below handles that).
    if (active.currentStepIndex === 0 && this.pathStack.length === 0) return;

    this._isNavigating = true;
    this.emitStateChanged("previous");

    try {
      const step = this.getCurrentStep(active);

      if (await this.canMovePrevious(active, step)) {
        this.applyPatch(await this.leaveCurrentStep(active, step));
        active.currentStepIndex -= 1;
        await this.skipSteps(-1);

        if (active.currentStepIndex < 0) {
          this._isNavigating = false;
          await this.cancel();
          return;
        }

        this.applyPatch(await this.enterCurrentStep());
      }

      this._isNavigating = false;
      this.emitStateChanged("previous");
    } catch (err) {
      this._isNavigating = false;
      this.emitStateChanged("previous");
      throw err;
    }
  }

  private async _goToStepAsync(active: ActivePath, targetIndex: number): Promise<void> {
    if (this._isNavigating) return;

    this._isNavigating = true;
    this.emitStateChanged("goToStep");

    try {
      const currentStep = this.getCurrentStep(active);
      this.applyPatch(await this.leaveCurrentStep(active, currentStep));

      active.currentStepIndex = targetIndex;

      this.applyPatch(await this.enterCurrentStep());
      this._isNavigating = false;
      this.emitStateChanged("goToStep");
    } catch (err) {
      this._isNavigating = false;
      this.emitStateChanged("goToStep");
      throw err;
    }
  }

  private async _goToStepCheckedAsync(active: ActivePath, targetIndex: number): Promise<void> {
    if (this._isNavigating) return;

    this._isNavigating = true;
    this.emitStateChanged("goToStepChecked");

    try {
      const currentStep = this.getCurrentStep(active);
      const goingForward = targetIndex > active.currentStepIndex;
      const allowed = goingForward
        ? await this.canMoveNext(active, currentStep)
        : await this.canMovePrevious(active, currentStep);

      if (allowed) {
        this.applyPatch(await this.leaveCurrentStep(active, currentStep));
        active.currentStepIndex = targetIndex;
        this.applyPatch(await this.enterCurrentStep());
      }

      this._isNavigating = false;
      this.emitStateChanged("goToStepChecked");
    } catch (err) {
      this._isNavigating = false;
      this.emitStateChanged("goToStepChecked");
      throw err;
    }
  }

  private async _cancelSubPathAsync(
    cancelledPathId: string,
    cancelledData: PathData,
    cancelledMeta?: Record<string, unknown>
  ): Promise<void> {
    // Pop the stack BEFORE emitting so snapshot() always reflects the parent
    // path (which has a valid currentStepIndex) rather than the cancelled
    // sub-path (which may have currentStepIndex = -1).
    this.activePath = this.pathStack.pop() ?? null;

    this._isNavigating = true;
    this.emitStateChanged("cancel");

    try {
      const parent = this.activePath;

      if (parent) {
        const parentStep = this.getCurrentStep(parent);
        if (parentStep.onSubPathCancel) {
          const ctx: PathStepContext = {
            pathId: parent.definition.id,
            stepId: parentStep.id,
            data: { ...parent.data },
            isFirstEntry: !parent.visitedStepIds.has(parentStep.id)
          };
          this.applyPatch(
            await parentStep.onSubPathCancel(cancelledPathId, cancelledData, ctx, cancelledMeta)
          );
        }
      }

      this._isNavigating = false;
      this.emitStateChanged("cancel");
    } catch (err) {
      this._isNavigating = false;
      this.emitStateChanged("cancel");
      throw err;
    }
  }

  private async finishActivePath(): Promise<void> {
    const finished = this.requireActivePath();
    const finishedPathId = finished.definition.id;
    const finishedData = { ...finished.data };

    if (this.pathStack.length > 0) {
      const parent = this.pathStack.pop()!;
      // The meta is stored on the parent, not the sub-path
      const finishedMeta = parent.subPathMeta;
      this.activePath = parent;
      const parentStep = this.getCurrentStep(parent);

      if (parentStep.onSubPathComplete) {
        const ctx: PathStepContext = {
          pathId: parent.definition.id,
          stepId: parentStep.id,
          data: { ...parent.data },
          isFirstEntry: !parent.visitedStepIds.has(parentStep.id)
        };
        this.applyPatch(
          await parentStep.onSubPathComplete(finishedPathId, finishedData, ctx, finishedMeta)
        );
      }

      this.emit({
        type: "resumed",
        resumedPathId: parent.definition.id,
        fromSubPathId: finishedPathId,
        snapshot: this.snapshot()!
      });
    } else {
      this.activePath = null;
      this.emit({ type: "completed", pathId: finishedPathId, data: finishedData });
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private requireActivePath(): ActivePath {
    if (this.activePath === null) {
      throw new Error("No active path.");
    }
    return this.activePath;
  }

  private assertPathHasSteps(path: PathDefinition): void {
    if (!path.steps || path.steps.length === 0) {
      throw new Error(`Path "${path.id}" must have at least one step.`);
    }
  }

  private emit(event: PathEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private emitStateChanged(cause: StateChangeCause): void {
    this.emit({ type: "stateChanged", cause, snapshot: this.snapshot()! });
  }

  private getCurrentStep(active: ActivePath): PathStep {
    return active.definition.steps[active.currentStepIndex];
  }

  private applyPatch(patch: Partial<PathData> | void | null | undefined): void {
    if (patch && typeof patch === "object") {
      const active = this.activePath;
      if (active) {
        Object.assign(active.data, patch);
      }
    }
  }

  private async skipSteps(direction: 1 | -1): Promise<void> {
    const active = this.activePath;
    if (!active) return;

    while (
      active.currentStepIndex >= 0 &&
      active.currentStepIndex < active.definition.steps.length
    ) {
      const step = active.definition.steps[active.currentStepIndex];
      if (!step.shouldSkip) break;
      const ctx: PathStepContext = {
        pathId: active.definition.id,
        stepId: step.id,
        data: { ...active.data },
        isFirstEntry: !active.visitedStepIds.has(step.id)
      };
      const skip = await step.shouldSkip(ctx);
      if (!skip) break;
      active.currentStepIndex += direction;
    }
  }

  private async enterCurrentStep(): Promise<Partial<PathData> | void> {
    // Each step starts fresh — errors are not shown until the user attempts to proceed.
    this._hasAttemptedNext = false;
    const active = this.activePath;
    if (!active) return;
    const step = this.getCurrentStep(active);
    const isFirstEntry = !active.visitedStepIds.has(step.id);
    // Mark as visited before calling onEnter so re-entrant calls see the
    // correct isFirstEntry value.
    active.visitedStepIds.add(step.id);
    if (!step.onEnter) return;
    const ctx: PathStepContext = {
      pathId: active.definition.id,
      stepId: step.id,
      data: { ...active.data },
      isFirstEntry
    };
    return step.onEnter(ctx);
  }

  private async leaveCurrentStep(
    active: ActivePath,
    step: PathStep
  ): Promise<Partial<PathData> | void> {
    if (!step.onLeave) return;
    const ctx: PathStepContext = {
      pathId: active.definition.id,
      stepId: step.id,
      data: { ...active.data },
      isFirstEntry: !active.visitedStepIds.has(step.id)
    };
    return step.onLeave(ctx);
  }

  private async canMoveNext(
    active: ActivePath,
    step: PathStep
  ): Promise<boolean> {
    if (step.canMoveNext) {
      const ctx: PathStepContext = {
        pathId: active.definition.id,
        stepId: step.id,
        data: { ...active.data },
        isFirstEntry: !active.visitedStepIds.has(step.id)
      };
      return step.canMoveNext(ctx);
    }
    if (step.fieldMessages) {
      return Object.keys(this.evaluateFieldMessagesSync(step.fieldMessages, active)).length === 0;
    }
    return true;
  }

  private async canMovePrevious(
    active: ActivePath,
    step: PathStep
  ): Promise<boolean> {
    if (!step.canMovePrevious) return true;
    const ctx: PathStepContext = {
      pathId: active.definition.id,
      stepId: step.id,
      data: { ...active.data },
      isFirstEntry: !active.visitedStepIds.has(step.id)
    };
    return step.canMovePrevious(ctx);
  }

  /**
   * Evaluates a guard function synchronously for inclusion in the snapshot.
   * If the guard is absent, returns `true`.
   * If the guard returns a `Promise`, returns `true` (optimistic default).
   *
   * **Note:** Guards are evaluated on every snapshot, including the very first one
   * emitted at the start of a path — _before_ `onEnter` has run on that step.
   * This means `data` will still reflect the `initialData` passed to `start()`.
   * Write guards defensively (e.g. `(data.name ?? "").trim().length > 0`) so they
   * do not throw when optional fields are absent on first entry.
   *
   * If a guard throws, the error is caught, a `console.warn` is emitted, and the
   * safe default (`true`) is returned so the UI remains operable.
   */
  private evaluateGuardSync(
    guard: ((ctx: PathStepContext) => boolean | Promise<boolean>) | undefined,
    active: ActivePath
  ): boolean {
    if (!guard) return true;
    const step = this.getCurrentStep(active);
    const ctx: PathStepContext = {
      pathId: active.definition.id,
      stepId: step.id,
      data: { ...active.data },
      isFirstEntry: !active.visitedStepIds.has(step.id)
    };
    try {
      const result = guard(ctx);
      if (typeof result === "boolean") return result;
      // Async guard detected - warn and return optimistic default
      if (result && typeof result.then === "function") {
        console.warn(
          `[pathwrite] Async guard detected on step "${step.id}". ` +
          `Guards in snapshots must be synchronous. ` +
          `Returning true (optimistic) as default. ` +
          `The async guard will still be enforced during actual navigation.`
        );
      }
      return true;
    } catch (err) {
      console.warn(
        `[pathwrite] Guard on step "${step.id}" threw an error during snapshot evaluation. ` +
        `Returning true (allow navigation) as a safe default. ` +
        `Note: guards are evaluated before onEnter runs on first entry — ` +
        `ensure guards handle missing/undefined data gracefully.`,
        err
      );
      return true;
    }
  }

  /**
   * Evaluates `canMoveNext` synchronously for inclusion in the snapshot.
   * When `canMoveNext` is defined, delegates to `evaluateGuardSync`.
   * When absent but `fieldMessages` is defined, auto-derives: `true` iff no messages.
   * When neither is defined, returns `true`.
   */
  private evaluateCanMoveNextSync(step: PathStep, active: ActivePath): boolean {
    if (step.canMoveNext) return this.evaluateGuardSync(step.canMoveNext, active);
    if (step.fieldMessages) {
      return Object.keys(this.evaluateFieldMessagesSync(step.fieldMessages, active)).length === 0;
    }
    return true;
  }

  /**
   * Evaluates a fieldMessages function synchronously for inclusion in the snapshot.
   * If the hook is absent, returns `{}`.
   * If the hook returns a `Promise`, returns `{}` (async hooks are not supported in snapshots).
   * `undefined` values are stripped from the result — only fields with a defined message are included.
   *
   * **Note:** Like guards, `fieldMessages` is evaluated before `onEnter` runs on first
   * entry. Write it defensively so it does not throw when fields are absent.
   */
  private evaluateFieldMessagesSync(
    fn: ((ctx: PathStepContext) => FieldErrors) | undefined,
    active: ActivePath
  ): Record<string, string> {
    if (!fn) return {};
    const step = this.getCurrentStep(active);
    const ctx: PathStepContext = {
      pathId: active.definition.id,
      stepId: step.id,
      data: { ...active.data },
      isFirstEntry: !active.visitedStepIds.has(step.id)
    };
    try {
      const result = fn(ctx);
      if (result && typeof result === "object" && typeof (result as unknown as { then?: unknown }).then !== "function") {
        const filtered: Record<string, string> = {};
        for (const [key, val] of Object.entries(result)) {
          if (val !== undefined && val !== null && val !== "") {
            filtered[key] = val;
          }
        }
        return filtered;
      }
      if (result && typeof (result as unknown as { then?: unknown }).then === "function") {
        console.warn(
          `[pathwrite] Async fieldMessages detected on step "${step.id}". ` +
          `fieldMessages must be synchronous. Returning {} as default. ` +
          `Use synchronous validation or move async checks to canMoveNext.`
        );
      }
      return {};
    } catch (err) {
      console.warn(
        `[pathwrite] fieldMessages on step "${step.id}" threw an error during snapshot evaluation. ` +
        `Returning {} as a safe default. ` +
        `Note: fieldMessages is evaluated before onEnter runs on first entry — ` +
        `ensure it handles missing/undefined data gracefully.`,
        err
      );
      return {};
    }
  }
}

