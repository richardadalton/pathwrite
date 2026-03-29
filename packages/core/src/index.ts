export type PathData = Record<string, unknown>;

/**
 * The return type of a `fieldErrors` hook. Each key is a field ID; the value
 * is an error string, or `undefined` / omitted to indicate no error for that field.
 *
 * Use `"_"` as a key for form-level errors that don't belong to a specific field:
 * ```typescript
 * { _: "You must accept the terms and conditions." }
 * ```
 */
export type FieldErrors = Record<string, string | undefined>;

/**
 * The return type of a `canMoveNext` or `canMovePrevious` guard.
 *
 * - `true` — allow navigation
 * - `{ allowed: false }` — block silently (no message)
 * - `{ allowed: false, reason: "..." }` — block with a message; the shell surfaces
 *   this as `snapshot.blockingError` between the step content and the nav buttons
 *
 * @example
 * ```typescript
 * canMoveNext: async ({ data }) => {
 *   const result = await checkEligibility(data.applicantId);
 *   if (!result.eligible) return { allowed: false, reason: result.reason };
 *   return true;
 * }
 * ```
 */
export type GuardResult = true | { allowed: false; reason?: string };

export interface SerializedPathState {
  version: 1;
  pathId: string;
  currentStepIndex: number;
  data: PathData;
  visitedStepIds: string[];
  subPathMeta?: Record<string, unknown>;
  stepEntryData?: PathData;
  stepEnteredAt?: number;
  pathStack: Array<{
    pathId: string;
    currentStepIndex: number;
    data: PathData;
    visitedStepIds: string[];
    subPathMeta?: Record<string, unknown>;
    stepEntryData?: PathData;
    stepEnteredAt?: number;
  }>;
  _status: PathStatus;
}

/**
 * The interface every path state store must implement.
 *
 * `HttpStore` from `@daltonr/pathwrite-store` is the reference
 * implementation. Any backend — MongoDB, Redis, localStorage, etc. —
 * implements this interface and works with `persistence` and
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

/**
 * A conditional step selection placed in a path's `steps` array in place of a
 * single `PathStep`. When the engine reaches a `StepChoice` it calls `select`
 * to decide which of the bundled `steps` to activate. The chosen step is then
 * treated exactly like any other step — its hooks, guards, and validation all
 * apply normally.
 *
 * `StepChoice` has its own `id` (used for progress tracking and `goToStep`)
 * while `formId` on the snapshot exposes which inner step was selected, so the
 * UI can render the right component.
 *
 * @example
 * ```typescript
 * {
 *   id: "contact-details",
 *   select: ({ data }) => data.accountType === "company" ? "company" : "individual",
 *   steps: [
 *     {
 *       id: "individual",
 *       fieldErrors: ({ data }) => ({ name: !data.name ? "Required." : undefined }),
 *     },
 *     {
 *       id: "company",
 *       fieldErrors: ({ data }) => ({ companyName: !data.companyName ? "Required." : undefined }),
 *     },
 *   ],
 * }
 * ```
 */
export interface StepChoice<TData extends PathData = PathData> {
  id: string;
  title?: string;
  meta?: Record<string, unknown>;
  /** Called on step entry. Return the `id` of the step to activate. Throws if the returned id is not found in `steps`. */
  select: (ctx: PathStepContext<TData>) => string;
  steps: PathStep<TData>[];
  /** When `true`, the engine skips this choice slot entirely (same semantics as `PathStep.shouldSkip`). */
  shouldSkip?: (ctx: PathStepContext<TData>) => boolean | Promise<boolean>;
}

export interface PathStep<TData extends PathData = PathData> {
  id: string;
  title?: string;
  meta?: Record<string, unknown>;
  shouldSkip?: (ctx: PathStepContext<TData>) => boolean | Promise<boolean>;
  canMoveNext?: (ctx: PathStepContext<TData>) => GuardResult | Promise<GuardResult>;
  canMovePrevious?: (ctx: PathStepContext<TData>) => GuardResult | Promise<GuardResult>;
  /**
   * Returns a map of field ID → error message explaining why the step is not
   * yet valid. The shell displays these messages below the step content (labeled
   * by field name) so consumers do not need to duplicate validation logic in
   * the template. Return `undefined` for a field to indicate no error.
   *
   * When `fieldErrors` is provided and `canMoveNext` is **not**, the engine
   * automatically derives `canMoveNext` as `true` when all values are `undefined`
   * (i.e. no messages), eliminating the need to express the same logic twice.
   *
   * Evaluated synchronously on every snapshot; async functions default to `{}`.
   *
   * @example
   * ```typescript
   * fieldErrors: ({ data }) => ({
   *   name:  !data.name?.trim()        ? "Required."             : undefined,
   *   email: !isValidEmail(data.email) ? "Invalid email address." : undefined,
   * })
   * ```
   */
  fieldErrors?: (ctx: PathStepContext<TData>) => FieldErrors;
  /**
   * Returns a map of field ID → warning message for non-blocking advisories.
   * Same shape as `fieldErrors`, but warnings never affect `canMoveNext` —
   * they are purely informational. Shells render them in amber/yellow instead
   * of red.
   *
   * Evaluated synchronously on every snapshot; async functions default to `{}`.
   *
   * @example
   * ```typescript
   * fieldWarnings: ({ data }) => ({
   *   email: looksLikeTypo(data.email) ? "Did you mean gmail.com?" : undefined,
   * })
   * ```
   */
  fieldWarnings?: (ctx: PathStepContext<TData>) => FieldErrors;
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
  steps: (PathStep<TData> | StepChoice<TData>)[];
  /**
   * Optional callback invoked when this path completes (i.e. the user
   * reaches the end of the last step). Receives the final path data.
   * Only called for top-level paths — sub-path completion is handled by
   * the parent step's `onSubPathComplete` hook.
   */
  onComplete?: (data: TData) => void | Promise<void>;
  /**
   * Optional callback invoked when this path is cancelled. Receives the
   * path data at the time of cancellation. Only called for top-level paths —
   * sub-path cancellation is handled by the parent step's `onSubPathCancel` hook.
   */
  onCancel?: (data: TData) => void | Promise<void>;
}

export type StepStatus = "completed" | "current" | "upcoming";

/**
 * The engine's current operational state. Exposed as `snapshot.status`.
 *
 * | Status        | Meaning                                                      |
 * |---------------|--------------------------------------------------------------|
 * | `idle`        | On a step, waiting for user input                            |
 * | `entering`    | `onEnter` hook is running                                    |
 * | `validating`  | `canMoveNext` / `canMovePrevious` guard is running           |
 * | `leaving`     | `onLeave` hook is running                                    |
 * | `completing`  | `PathDefinition.onComplete` is running                       |
 * | `error`       | An async operation failed — see `snapshot.error` for details |
 */
export type PathStatus =
  | "idle"
  | "entering"
  | "validating"
  | "leaving"
  | "completing"
  | "error";

/**
 * The subset of `PathStatus` values that identify which phase was active
 * when an error occurred. Used by `snapshot.error.phase`.
 */
export type ErrorPhase = Exclude<PathStatus, "idle" | "error">;

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
  /**
   * The `id` of the selected inner `PathStep` when the current position in
   * the path is a `StepChoice`. `undefined` for ordinary steps.
   * Use this to decide which form component to render.
   */
  formId?: string;
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
  /**
   * The engine's current operational state. Use this instead of multiple boolean flags.
   *
   * Common patterns:
   * - `status !== "idle"` — disable all navigation buttons (engine is busy or errored)
   * - `status === "entering"` — show a skeleton/spinner inside the step area
   * - `status === "validating"` — show "Checking…" on the Next button
   * - `status === "error"` — show the retry / suspend error UI
   */
  status: PathStatus;
  /**
   * Structured error set when an engine-invoked async operation throws. `null` when no error is active.
   *
   * `phase` identifies which operation failed so shells can adapt the message.
   * `retryCount` counts how many times the user has explicitly called `retry()` — starts at 0 on
   * first failure, increments on each retry. Use this to escalate from "Try again" to "Come back later".
   *
   * Cleared automatically when navigation succeeds or when `retry()` is called.
   */
  error: { message: string; phase: ErrorPhase; retryCount: number } | null;
  /**
   * `true` when a `PathStore` is attached via `PathEngineOptions.hasPersistence`.
   * Shells use this to decide whether to promise the user that progress is saved
   * when showing the "come back later" escalation message.
   */
  hasPersistence: boolean;
  /** Whether the current step's `canMoveNext` guard allows advancing. Async guards default to `true`. Auto-derived as `true` when `fieldErrors` is defined and returns no messages, and `canMoveNext` is not explicitly defined. */
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
   * {#if snapshot.hasAttemptedNext && snapshot.fieldErrors.email}
   *   <span class="error">{snapshot.fieldErrors.email}</span>
   * {/if}
   * ```
   *
   * The shell itself uses this flag to gate its own automatic `fieldErrors`
   * summary rendering — errors are never shown before the first Next attempt.
   */
  hasAttemptedNext: boolean;
  /**
   * True if any data has changed since entering this step. Automatically computed
   * by comparing the current data to the snapshot taken on step entry. Resets to
   * `false` when navigating to a new step or calling `resetStep()`.
   *
   * Useful for "unsaved changes" warnings, disabling Save buttons until changes
   * are made, or styling forms to indicate modifications.
   *
   * ```typescript
   * {#if snapshot.isDirty}
   *   <span class="warning">You have unsaved changes</span>
   * {/if}
   * ```
   */
  isDirty: boolean;
  /**
   * Timestamp (from `Date.now()`) captured when the current step was entered.
   * Useful for analytics, timeout warnings, or computing how long a user has
   * been on a step.
   *
   * ```typescript
   * const durationMs = Date.now() - snapshot.stepEnteredAt;
   * const durationSec = Math.floor(durationMs / 1000);
   * ```
   *
   * Resets to a new timestamp each time the step is entered (including when
   * navigating back to a previously visited step).
   */
  stepEnteredAt: number;
  /**
   * A guard-level blocking message set when `canMoveNext` returns
   * `{ allowed: false, reason: "..." }`. `null` when there is no blocking message.
   *
   * Distinct from `fieldErrors` (field-attached) and `error` (async crash).
   * Shells render this between the step content and the navigation buttons.
   * Cleared automatically when the user successfully navigates to a new step.
   */
  blockingError: string | null;
  /**
   * Field-keyed validation messages for the current step. Empty object when there are none.
   * Use in step templates to render inline per-field errors: `snapshot.fieldErrors['email']`.
   * The shell also renders these automatically in a labeled summary box.
   * Use `"_"` as a key for form-level (non-field-specific) errors.
   */
  fieldErrors: Record<string, string>;
  /**
   * Field-keyed warning messages for the current step. Empty object when there are none.
   * Same shape as `fieldErrors` but purely informational — warnings never block navigation.
   * Shells render these in amber/yellow instead of red.
   * Use `"_"` as a key for form-level (non-field-specific) warnings.
   */
  fieldWarnings: Record<string, string>;
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
  | "resetStep"
  | "cancel"
  | "restart"
  | "retry"
  | "suspend";

export type PathEvent =
  | { type: "stateChanged"; cause: StateChangeCause; snapshot: PathSnapshot }
  | { type: "completed"; pathId: string; data: PathData }
  | { type: "cancelled"; pathId: string; data: PathData }
  | { type: "suspended"; pathId: string; data: PathData }
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
      // Only react once the engine has settled — stateChanged fires on every
      // phase transition; only "idle" and "error" are settled states.
      return (event.type === "stateChanged" &&
        (event.snapshot.status === "idle" || event.snapshot.status === "error"))
        || event.type === "resumed";
    case "onNext":
      return event.type === "stateChanged"
        && event.cause === "next"
        && (event.snapshot.status === "idle" || event.snapshot.status === "error");
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
  /**
   * Set to `true` when a `PathStore` is attached and will persist path state.
   * Exposed as `snapshot.hasPersistence` so shells can honestly tell the user
   * their progress is saved when showing the "come back later" escalation message.
   */
  hasPersistence?: boolean;
}

interface ActivePath {
  definition: PathDefinition;
  currentStepIndex: number;
  data: PathData;
  visitedStepIds: Set<string>;
  subPathMeta?: Record<string, unknown>;
  /** Snapshot of data taken when the current step was entered. Used by resetStep(). */
  stepEntryData: PathData;
  /** Timestamp (Date.now()) captured when the current step was entered. */
  stepEnteredAt: number;
  /** The selected inner step when the current slot is a StepChoice. Cached on entry. */
  resolvedChoiceStep?: PathStep;
}

function isStepChoice(item: PathStep | StepChoice): item is StepChoice {
  return "select" in item && "steps" in item;
}

/**
 * Converts a camelCase or lowercase field key to a display label.
 * `"firstName"` → `"First Name"`, `"email"` → `"Email"`.
 * Used by shells to render labeled field-error summaries.
 */
export function formatFieldKey(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase()).trim();
}

/**
 * Returns a human-readable description of which operation failed, keyed by
 * the `ErrorPhase` value on `snapshot.error.phase`. Used by shells to render
 * the error panel message.
 */
export function errorPhaseMessage(phase: string): string {
  switch (phase) {
    case "entering":   return "Failed to load this step.";
    case "validating": return "The check could not be completed.";
    case "leaving":    return "Failed to save your progress.";
    case "completing": return "Your submission could not be sent.";
    default:           return "An unexpected error occurred.";
  }
}

export class PathEngine {
  private activePath: ActivePath | null = null;
  private readonly pathStack: ActivePath[] = [];
  private readonly listeners = new Set<(event: PathEvent) => void>();
  private _status: PathStatus = "idle";
  /** True after the user has called next() on the current step at least once. Resets on step entry. */
  private _hasAttemptedNext = false;
  /** Blocking message from canMoveNext returning { allowed: false, reason }. Cleared on step entry. */
  private _blockingError: string | null = null;
  /** The path and initial data from the most recent top-level start() call. Used by restart(). */
  private _rootPath: PathDefinition<any> | null = null;
  private _rootInitialData: PathData = {};
  /** Structured error from the most recent failed async operation. Null when no error is active. */
  private _error: { message: string; phase: ErrorPhase; retryCount: number } | null = null;
  /** Stored retry function. Null when no error is pending. */
  private _pendingRetry: (() => Promise<void>) | null = null;
  /**
   * Counts how many times `retry()` has been called for the current error sequence.
   * Reset to 0 by `next()` (fresh navigation). Incremented by `retry()`.
   */
  private _retryCount = 0;
  private _hasPersistence = false;

  constructor(options?: PathEngineOptions) {
    if (options?.observers) {
      for (const observer of options.observers) {
        // Wrap so observer receives the engine instance as the second argument
        this.listeners.add((event) => observer(event, this));
      }
    }
    if (options?.hasPersistence) {
      this._hasPersistence = true;
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
        subPathMeta: stackItem.subPathMeta ? { ...stackItem.subPathMeta } : undefined,
        stepEntryData: stackItem.stepEntryData ? { ...stackItem.stepEntryData } : { ...stackItem.data },
        stepEnteredAt: stackItem.stepEnteredAt ?? Date.now()
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
      subPathMeta: undefined,
      stepEntryData: state.stepEntryData ? { ...state.stepEntryData } : { ...state.data },
      stepEnteredAt: state.stepEnteredAt ?? Date.now()
    };

    engine._status = state._status ?? "idle";

    // Re-derive the selected inner step for any StepChoice slots (not serialized —
    // always recomputed from current data on restore).
    for (const stackItem of engine.pathStack) {
      engine.cacheResolvedChoiceStep(stackItem);
    }
    engine.cacheResolvedChoiceStep(engine.activePath);

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
    this._rootPath = path;
    this._rootInitialData = initialData;
    return this._startAsync(path, initialData);
  }

  /**
   * Tears down any active path (and the entire sub-path stack) without firing
   * lifecycle hooks or emitting `cancelled`, then immediately restarts the same
   * path with the same initial data that was passed to the original `start()` call.
   *
   * Safe to call at any time — whether a path is running, already completed,
   * or has never been started. Use this to implement a "Start over" button or
   * to retry a path after completion without remounting the host component.
   *
   * @throws If `restart()` is called before `start()` has ever been called.
   */
  public restart(): Promise<void> {
    if (!this._rootPath) {
      throw new Error("Cannot restart: engine has not been started. Call start() first.");
    }
    this._status = "idle";
    this._blockingError = null;
    this.activePath = null;
    this.pathStack.length = 0;
    return this._startAsync(this._rootPath, { ...this._rootInitialData });
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
    // Reset the retry sequence. If we're recovering from an error the user
    // explicitly clicked Next again — clear the error and reset to idle so
    // _nextAsync's entry guard passes. For any other non-idle status (busy)
    // the guard in _nextAsync will drop this call.
    this._retryCount = 0;
    this._error = null;
    this._pendingRetry = null;
    if (this._status === "error") this._status = "idle";
    return this._nextAsync(active);
  }

  public previous(): Promise<void> {
    const active = this.requireActivePath();
    return this._previousAsync(active);
  }

  /**
   * Re-runs the operation that caused the most recent `snapshot.error`.
   * Increments `snapshot.error.retryCount` so shells can escalate from
   * "Try again" to "Come back later" after repeated failures.
   *
   * No-op if there is no pending error or if navigation is in progress.
   */
  public retry(): Promise<void> {
    if (!this._pendingRetry || this._status !== "error") return Promise.resolve();
    this._retryCount++;
    const fn = this._pendingRetry;
    this._pendingRetry = null;
    this._error = null;
    this._status = "idle";  // allow the retry fn's entry guard to pass
    return fn();
  }

  /**
   * Pauses the path with intent to return. Preserves all state and data.
   *
   * - Clears any active error state
   * - Emits a `suspended` event that the application can listen for to dismiss
   *   the wizard UI (close a modal, navigate away, etc.)
   * - The engine remains in its current state — call `start()` / `restoreOrStart()`
   *   to resume when the user returns
   *
   * Use in the "Come back later" escalation path when `snapshot.error.retryCount`
   * has crossed `retryThreshold`. The `suspended` event signals the app to dismiss
   * the UI; Pathwrite's persistence layer handles saving progress automatically via
   * the configured store and observer strategy.
   */
  public suspend(): Promise<void> {
    const active = this.activePath;
    const pathId = active?.definition.id ?? "";
    const data = active ? { ...active.data } : {};
    this._error = null;
    this._pendingRetry = null;
    this._status = "idle";
    this.emit({ type: "suspended", pathId, data });
    return Promise.resolve();
  }

  /** Cancel is synchronous for top-level paths (no hooks). Sub-path cancellation
   *  is async when an `onSubPathCancel` hook is present. Returns a Promise for
   *  API consistency. */
  public async cancel(): Promise<void> {
    const active = this.requireActivePath();
    if (this._status !== "idle") return;

    const cancelledPathId = active.definition.id;
    const cancelledData = { ...active.data };

    if (this.pathStack.length > 0) {
      // Get meta from the parent in the stack
      const parent = this.pathStack[this.pathStack.length - 1];
      const cancelledMeta = parent.subPathMeta;
      return this._cancelSubPathAsync(cancelledPathId, cancelledData, cancelledMeta);
    }

    // Top-level path cancelled — call onCancel hook if defined
    this.activePath = null;
    this.emit({ type: "cancelled", pathId: cancelledPathId, data: cancelledData });
    if (active.definition.onCancel) {
      await active.definition.onCancel(cancelledData);
    }
  }

  public setData(key: string, value: unknown): Promise<void> {
    const active = this.requireActivePath();
    active.data[key] = value;
    this.emitStateChanged("setData");
    return Promise.resolve();
  }

  /**
   * Resets the current step's data to what it was when the step was entered.
   * Useful for "Clear" or "Reset" buttons that undo changes within a step.
   * Emits a `stateChanged` event with cause `"resetStep"`.
   * Throws if no path is active.
   */
  public resetStep(): Promise<void> {
    const active = this.requireActivePath();
    // Restore data from the snapshot taken when this step was entered
    active.data = { ...active.stepEntryData };
    this.emitStateChanged("resetStep");
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
    const item = this.getCurrentItem(active);
    const effectiveStep = this.getEffectiveStep(active);
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
      stepId: item.id,
      stepTitle: effectiveStep.title ?? item.title,
      stepMeta: effectiveStep.meta ?? item.meta,
      formId: isStepChoice(item) ? effectiveStep.id : undefined,
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
      status: this._status,
      error: this._error,
      hasPersistence: this._hasPersistence,
      hasAttemptedNext: this._hasAttemptedNext,
      blockingError: this._blockingError,
      canMoveNext: this.evaluateCanMoveNextSync(effectiveStep, active),
      canMovePrevious: this.evaluateGuardSync(effectiveStep.canMovePrevious, active),
      fieldErrors: this.evaluateFieldMessagesSync(effectiveStep.fieldErrors, active),
      fieldWarnings: this.evaluateFieldMessagesSync(effectiveStep.fieldWarnings, active),
      isDirty: this.computeIsDirty(active),
      stepEnteredAt: active.stepEnteredAt,
      data: { ...active.data }
    };
  }

  /**
   * Exports the current engine state as a plain JSON-serializable object.
   * Use with storage adapters (e.g. `@daltonr/pathwrite-store`) to
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
      stepEntryData: { ...active.stepEntryData },
      stepEnteredAt: active.stepEnteredAt,
      pathStack: this.pathStack.map((p) => ({
        pathId: p.definition.id,
        currentStepIndex: p.currentStepIndex,
        data: { ...p.data },
        visitedStepIds: Array.from(p.visitedStepIds),
        subPathMeta: p.subPathMeta ? { ...p.subPathMeta } : undefined,
        stepEntryData: { ...p.stepEntryData },
        stepEnteredAt: p.stepEnteredAt
      })),
      _status: this._status
    };
  }

  // ---------------------------------------------------------------------------
  // Private async helpers
  // ---------------------------------------------------------------------------

  private async _startAsync(path: PathDefinition, initialData: PathData, subPathMeta?: Record<string, unknown>): Promise<void> {
    if (this._status !== "idle") return;

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
      subPathMeta: undefined,
      stepEntryData: { ...initialData },  // Will be updated in enterCurrentStep
      stepEnteredAt: 0  // Will be set in enterCurrentStep
    };

    await this.skipSteps(1);

    if (this.activePath.currentStepIndex >= path.steps.length) {
      await this._finishActivePathWithErrorHandling();
      return;
    }

    this._status = "entering";
    this.emitStateChanged("start");

    await this._enterCurrentStepWithErrorHandling("start");
  }

  private async _nextAsync(active: ActivePath): Promise<void> {
    if (this._status !== "idle") return;

    // Record that the user has attempted to advance — used by shells and step
    // templates to gate error display ("punish late, reward early").
    this._hasAttemptedNext = true;

    // Phase: validating — canMoveNext guard
    this._status = "validating";
    this.emitStateChanged("next");

    let guardResult: { allowed: boolean; reason: string | null };
    try {
      guardResult = await this.canMoveNext(active, this.getEffectiveStep(active));
    } catch (err) {
      this._error = { message: PathEngine.errorMessage(err), phase: "validating", retryCount: this._retryCount };
      this._pendingRetry = () => this._nextAsync(active);
      this._status = "error";
      this.emitStateChanged("next");
      return;
    }

    if (guardResult.allowed) {
      // Phase: leaving — onLeave hook
      this._status = "leaving";
      this.emitStateChanged("next");
      try {
        this.applyPatch(await this.leaveCurrentStep(active, this.getEffectiveStep(active)));
      } catch (err) {
        this._error = { message: PathEngine.errorMessage(err), phase: "leaving", retryCount: this._retryCount };
        this._pendingRetry = () => this._nextAsync(active);
        this._status = "error";
        this.emitStateChanged("next");
        return;
      }

      active.currentStepIndex += 1;
      await this.skipSteps(1);

      if (active.currentStepIndex >= active.definition.steps.length) {
        // Phase: completing — PathDefinition.onComplete
        await this._finishActivePathWithErrorHandling();
        return;
      }

      // Phase: entering — onEnter hook on the new step
      await this._enterCurrentStepWithErrorHandling("next");
      return;
    }

    this._blockingError = guardResult.reason;
    this._status = "idle";
    this.emitStateChanged("next");
  }

  private async _previousAsync(active: ActivePath): Promise<void> {
    if (this._status !== "idle") return;

    // No-op when already on the first step of a top-level path.
    // Sub-paths still cancel/pop back to the parent when previous() is called
    // on their first step (the currentStepIndex < 0 branch below handles that).
    if (active.currentStepIndex === 0 && this.pathStack.length === 0) return;

    this._status = "leaving";
    this.emitStateChanged("previous");

    try {
      const step = this.getEffectiveStep(active);

      const prevGuard = await this.canMovePrevious(active, step);
      if (!prevGuard.allowed) this._blockingError = prevGuard.reason;

      if (prevGuard.allowed) {
        this.applyPatch(await this.leaveCurrentStep(active, step));
        active.currentStepIndex -= 1;
        await this.skipSteps(-1);

        if (active.currentStepIndex < 0) {
          this._status = "idle";
          await this.cancel();
          return;
        }

        this.applyPatch(await this.enterCurrentStep());
      }

      this._status = "idle";
      this.emitStateChanged("previous");
    } catch (err) {
      this._status = "idle";
      this.emitStateChanged("previous");
      throw err;
    }
  }

  private async _goToStepAsync(active: ActivePath, targetIndex: number): Promise<void> {
    if (this._status !== "idle") return;

    this._status = "leaving";
    this.emitStateChanged("goToStep");

    try {
      const currentStep = this.getEffectiveStep(active);
      this.applyPatch(await this.leaveCurrentStep(active, currentStep));

      active.currentStepIndex = targetIndex;

      this.applyPatch(await this.enterCurrentStep());
      this._status = "idle";
      this.emitStateChanged("goToStep");
    } catch (err) {
      this._status = "idle";
      this.emitStateChanged("goToStep");
      throw err;
    }
  }

  private async _goToStepCheckedAsync(active: ActivePath, targetIndex: number): Promise<void> {
    if (this._status !== "idle") return;

    this._status = "validating";
    this.emitStateChanged("goToStepChecked");

    try {
      const currentStep = this.getEffectiveStep(active);
      const goingForward = targetIndex > active.currentStepIndex;
      const guardResult = goingForward
        ? await this.canMoveNext(active, currentStep)
        : await this.canMovePrevious(active, currentStep);

      if (!guardResult.allowed) this._blockingError = guardResult.reason;

      if (guardResult.allowed) {
        this._status = "leaving";
        this.applyPatch(await this.leaveCurrentStep(active, currentStep));
        active.currentStepIndex = targetIndex;
        this.applyPatch(await this.enterCurrentStep());
      }

      this._status = "idle";
      this.emitStateChanged("goToStepChecked");
    } catch (err) {
      this._status = "idle";
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

    this._status = "leaving";
    this.emitStateChanged("cancel");

    try {
      const parent = this.activePath;

      if (parent) {
        const parentItem = this.getCurrentItem(parent);
        const parentStep = this.getEffectiveStep(parent);
        if (parentStep.onSubPathCancel) {
          const ctx: PathStepContext = {
            pathId: parent.definition.id,
            stepId: parentItem.id,
            data: { ...parent.data },
            isFirstEntry: !parent.visitedStepIds.has(parentItem.id)
          };
          this.applyPatch(
            await parentStep.onSubPathCancel(cancelledPathId, cancelledData, ctx, cancelledMeta)
          );
        }
      }

      this._status = "idle";
      this.emitStateChanged("cancel");
    } catch (err) {
      this._status = "idle";
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
      const parentItem = this.getCurrentItem(parent);
      const parentStep = this.getEffectiveStep(parent);

      if (parentStep.onSubPathComplete) {
        const ctx: PathStepContext = {
          pathId: parent.definition.id,
          stepId: parentItem.id,
          data: { ...parent.data },
          isFirstEntry: !parent.visitedStepIds.has(parentItem.id)
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
      // Top-level path completed — call onComplete before clearing activePath so
      // that if it throws the engine remains on the final step and can retry.
      if (finished.definition.onComplete) {
        await finished.definition.onComplete(finishedData);
      }
      this.activePath = null;
      this.emit({ type: "completed", pathId: finishedPathId, data: finishedData });
    }
  }

  /**
   * Wraps `finishActivePath` with error handling for the `completing` phase.
   * On failure: sets `_error`, stores a retry that re-calls `finishActivePath`,
   * resets status to `"error"`, and emits `stateChanged`.
   * On success: resets status to `"idle"` (finishActivePath sets activePath = null,
   * so no stateChanged is needed — the `completed` event is the terminal signal).
   */
  private async _finishActivePathWithErrorHandling(): Promise<void> {
    const active = this.activePath;
    this._status = "completing";
    try {
      await this.finishActivePath();
      this._status = "idle";
      // No stateChanged here — finishActivePath emits "completed" or "resumed"
    } catch (err) {
      this._error = { message: PathEngine.errorMessage(err), phase: "completing", retryCount: this._retryCount };
      // Retry: call finishActivePath again (activePath is still set because onComplete
      // throws before this.activePath = null in the restructured finishActivePath)
      this._pendingRetry = () => this._finishActivePathWithErrorHandling();
      this._status = "error";
      if (active) {
        // Restore activePath if it was cleared mid-throw (defensive)
        if (!this.activePath) this.activePath = active;
        // Back up to the last valid step so snapshot() can render it while error is shown
        if (this.activePath.currentStepIndex >= this.activePath.definition.steps.length) {
          this.activePath.currentStepIndex = this.activePath.definition.steps.length - 1;
        }
        this.emitStateChanged("next");
      }
    }
  }

  /**
   * Wraps `enterCurrentStep` with error handling for the `entering` phase.
   * Called by both `_startAsync` and `_nextAsync` after advancing to a new step.
   * On failure: sets `_error`, stores a retry that re-calls this method,
   * resets status to `"error"`, and emits `stateChanged` with the given `cause`.
   */
  private async _enterCurrentStepWithErrorHandling(cause: StateChangeCause): Promise<void> {
    this._status = "entering";
    try {
      this.applyPatch(await this.enterCurrentStep());
      this._status = "idle";
      this.emitStateChanged(cause);
    } catch (err) {
      this._error = { message: PathEngine.errorMessage(err), phase: "entering", retryCount: this._retryCount };
      // Retry: re-enter the current step (don't repeat guards/leave)
      this._pendingRetry = () => this._enterCurrentStepWithErrorHandling(cause);
      this._status = "error";
      this.emitStateChanged(cause);
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private static errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }

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

  /** Returns the raw item at the current index — either a PathStep or a StepChoice. */
  private getCurrentItem(active: ActivePath): PathStep | StepChoice {
    return active.definition.steps[active.currentStepIndex];
  }

  /**
   * Calls `StepChoice.select` and caches the chosen inner step in
   * `active.resolvedChoiceStep`. Clears the cache when the current item is a
   * plain `PathStep`. Throws if `select` returns an id not present in `steps`.
   */
  private cacheResolvedChoiceStep(active: ActivePath): void {
    const item = this.getCurrentItem(active);
    if (!isStepChoice(item)) {
      active.resolvedChoiceStep = undefined;
      return;
    }
    const ctx: PathStepContext = {
      pathId: active.definition.id,
      stepId: item.id,
      data: { ...active.data },
      isFirstEntry: !active.visitedStepIds.has(item.id)
    };
    let selectedId: string;
    try {
      selectedId = item.select(ctx);
    } catch (err) {
      throw new Error(
        `[pathwrite] StepChoice "${item.id}".select() threw an error: ${err}`
      );
    }
    const found = item.steps.find((s) => s.id === selectedId);
    if (!found) {
      throw new Error(
        `[pathwrite] StepChoice "${item.id}".select() returned "${selectedId}" ` +
        `but no step with that id exists in its steps array.`
      );
    }
    active.resolvedChoiceStep = found;
  }

  /**
   * Returns the effective `PathStep` for the current position. When the
   * current item is a `StepChoice`, returns the cached resolved inner step.
   * When it is a plain `PathStep`, returns it directly.
   */
  private getEffectiveStep(active: ActivePath): PathStep {
    if (active.resolvedChoiceStep) return active.resolvedChoiceStep;
    const item = this.getCurrentItem(active);
    if (isStepChoice(item)) {
      // resolvedChoiceStep should always be set after enterCurrentStep; this
      // branch is a defensive fallback (e.g. during fromState restore).
      this.cacheResolvedChoiceStep(active);
      return active.resolvedChoiceStep!;
    }
    return item;
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
      const item = active.definition.steps[active.currentStepIndex];
      if (!item.shouldSkip) break;
      const ctx: PathStepContext = {
        pathId: active.definition.id,
        stepId: item.id,
        data: { ...active.data },
        isFirstEntry: !active.visitedStepIds.has(item.id)
      };
      const skip = await item.shouldSkip(ctx);
      if (!skip) break;
      active.currentStepIndex += direction;
    }
  }

  private async enterCurrentStep(): Promise<Partial<PathData> | void> {
    // Each step starts fresh — errors are not shown until the user attempts to proceed.
    this._hasAttemptedNext = false;
    this._blockingError = null;
    const active = this.activePath;
    if (!active) return;

    // Save a snapshot of the data as it was when entering this step (for resetStep)
    active.stepEntryData = { ...active.data };

    // Capture the timestamp when entering this step (for analytics, timeout warnings)
    active.stepEnteredAt = Date.now();

    const item = this.getCurrentItem(active);

    // Resolve the inner step when this slot is a StepChoice
    this.cacheResolvedChoiceStep(active);

    const effectiveStep = this.getEffectiveStep(active);
    const isFirstEntry = !active.visitedStepIds.has(item.id);
    // Mark as visited before calling onEnter so re-entrant calls see the
    // correct isFirstEntry value.
    active.visitedStepIds.add(item.id);
    if (!effectiveStep.onEnter) return;
    const ctx: PathStepContext = {
      pathId: active.definition.id,
      stepId: item.id,
      data: { ...active.data },
      isFirstEntry
    };
    return effectiveStep.onEnter(ctx);
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
  ): Promise<{ allowed: boolean; reason: string | null }> {
    if (step.canMoveNext) {
      const ctx: PathStepContext = {
        pathId: active.definition.id,
        stepId: step.id,
        data: { ...active.data },
        isFirstEntry: !active.visitedStepIds.has(step.id)
      };
      const result = await step.canMoveNext(ctx);
      return PathEngine.normaliseGuardResult(result);
    }
    if (step.fieldErrors) {
      const allowed = Object.keys(this.evaluateFieldMessagesSync(step.fieldErrors, active)).length === 0;
      return { allowed, reason: null };
    }
    return { allowed: true, reason: null };
  }

  private async canMovePrevious(
    active: ActivePath,
    step: PathStep
  ): Promise<{ allowed: boolean; reason: string | null }> {
    if (!step.canMovePrevious) return { allowed: true, reason: null };
    const ctx: PathStepContext = {
      pathId: active.definition.id,
      stepId: step.id,
      data: { ...active.data },
      isFirstEntry: !active.visitedStepIds.has(step.id)
    };
    const result = await step.canMovePrevious(ctx);
    return PathEngine.normaliseGuardResult(result);
  }

  private static normaliseGuardResult(result: GuardResult): { allowed: boolean; reason: string | null } {
    if (result === true) return { allowed: true, reason: null };
    return { allowed: false, reason: result.reason ?? null };
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
    guard: ((ctx: PathStepContext) => GuardResult | Promise<GuardResult>) | undefined,
    active: ActivePath
  ): boolean {
    if (!guard) return true;
    const item = this.getCurrentItem(active);
    const ctx: PathStepContext = {
      pathId: active.definition.id,
      stepId: item.id,
      data: { ...active.data },
      isFirstEntry: !active.visitedStepIds.has(item.id)
    };
    try {
      const result = guard(ctx);
      if (result === true) return true;
      if (result && typeof (result as Promise<unknown>).then === "function") {
        // Async guard detected - suppress the unhandled rejection, warn, return optimistic default
        (result as Promise<unknown>).catch(() => {});
        console.warn(
          `[pathwrite] Async guard detected on step "${item.id}". ` +
          `Guards in snapshots must be synchronous. ` +
          `Returning true (optimistic) as default. ` +
          `The async guard will still be enforced during actual navigation.`
        );
        return true;
      }
      // { allowed: false, reason? } object returned synchronously
      return false;
    } catch (err) {
      console.warn(
        `[pathwrite] Guard on step "${item.id}" threw an error during snapshot evaluation. ` +
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
   * When absent but `fieldErrors` is defined, auto-derives: `true` iff no messages.
   * When neither is defined, returns `true`.
   */
  private evaluateCanMoveNextSync(step: PathStep, active: ActivePath): boolean {
    if (step.canMoveNext) return this.evaluateGuardSync(step.canMoveNext, active);
    if (step.fieldErrors) {
      return Object.keys(this.evaluateFieldMessagesSync(step.fieldErrors, active)).length === 0;
    }
    return true;
  }

  /**
   * Evaluates a fieldErrors function synchronously for inclusion in the snapshot.
   * If the hook is absent, returns `{}`.
   * If the hook returns a `Promise`, returns `{}` (async hooks are not supported in snapshots).
   * `undefined` values are stripped from the result — only fields with a defined message are included.
   *
   * **Note:** Like guards, `fieldErrors` is evaluated before `onEnter` runs on first
   * entry. Write it defensively so it does not throw when fields are absent.
   */
  private evaluateFieldMessagesSync(
    fn: ((ctx: PathStepContext) => FieldErrors) | undefined,
    active: ActivePath
  ): Record<string, string> {
    if (!fn) return {};
    const item = this.getCurrentItem(active);
    const ctx: PathStepContext = {
      pathId: active.definition.id,
      stepId: item.id,
      data: { ...active.data },
      isFirstEntry: !active.visitedStepIds.has(item.id)
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
          `[pathwrite] Async fieldErrors detected on step "${item.id}". ` +
          `fieldErrors must be synchronous. Returning {} as default. ` +
          `Use synchronous validation or move async checks to canMoveNext.`
        );
      }
      return {};
    } catch (err) {
      console.warn(
        `[pathwrite] fieldErrors on step "${item.id}" threw an error during snapshot evaluation. ` +
        `Returning {} as a safe default. ` +
        `Note: fieldErrors is evaluated before onEnter runs on first entry — ` +
        `ensure it handles missing/undefined data gracefully.`,
        err
      );
      return {};
    }
  }

  /**
   * Compares the current step data to the snapshot taken when the step was entered.
   * Returns `true` if any data value has changed.
   *
   * Performs a shallow comparison — only top-level keys are checked. Nested objects
   * are compared by reference, not by deep equality.
   */
  private computeIsDirty(active: ActivePath): boolean {
    const current = active.data;
    const entry = active.stepEntryData;

    // Get all unique keys from both objects
    const allKeys = new Set([...Object.keys(current), ...Object.keys(entry)]);

    for (const key of allKeys) {
      if (current[key] !== entry[key]) {
        return true;
      }
    }

    return false;
  }
}

