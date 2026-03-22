export type PathData = Record<string, unknown>;
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
     * Returns a list of human-readable messages explaining why the step is not
     * yet valid. The shell displays these messages below the step content so
     * consumers do not need to duplicate guard logic in the template.
     * Evaluated synchronously on every snapshot; async functions default to `[]`.
     */
    validationMessages?: (ctx: PathStepContext<TData>) => string[] | Promise<string[]>;
    onEnter?: (ctx: PathStepContext<TData>) => Partial<TData> | void | Promise<Partial<TData> | void>;
    onLeave?: (ctx: PathStepContext<TData>) => Partial<TData> | void | Promise<Partial<TData> | void>;
    /**
     * Called on the parent step when a sub-path completes naturally (user
     * reached the last step). Receives the sub-path ID, its final data, the
     * parent step context, and the optional `meta` object that was passed to
     * `startSubPath()` for correlation (e.g. a collection item index).
     */
    onSubPathComplete?: (subPathId: string, subPathData: PathData, ctx: PathStepContext<TData>, meta?: Record<string, unknown>) => Partial<TData> | void | Promise<Partial<TData> | void>;
    /**
     * Called on the parent step when a sub-path is cancelled — either via an
     * explicit `cancel()` call or by pressing Back on the sub-path's first step.
     * Receives the sub-path ID, its data at time of cancellation, the parent
     * step context, and the optional `meta` passed to `startSubPath()`.
     * Return a patch to update the parent path's data (e.g. to record a
     * "skipped" or "declined" outcome).
     */
    onSubPathCancel?: (subPathId: string, subPathData: PathData, ctx: PathStepContext<TData>, meta?: Record<string, unknown>) => Partial<TData> | void | Promise<Partial<TData> | void>;
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
    /** True while an async guard or hook is executing. Use to disable navigation controls. */
    isNavigating: boolean;
    /** Whether the current step's `canMoveNext` guard allows advancing. Async guards default to `true`. */
    canMoveNext: boolean;
    /** Whether the current step's `canMovePrevious` guard allows going back. Async guards default to `true`. */
    canMovePrevious: boolean;
    /** Messages from the current step's `validationMessages` hook. Empty array when there are none. */
    validationMessages: string[];
    data: TData;
}
/**
 * Identifies the public method that triggered a `stateChanged` event.
 */
export type StateChangeCause = "start" | "next" | "previous" | "goToStep" | "goToStepChecked" | "setData" | "cancel" | "restart";
export type PathEvent = {
    type: "stateChanged";
    cause: StateChangeCause;
    snapshot: PathSnapshot;
} | {
    type: "completed";
    pathId: string;
    data: PathData;
} | {
    type: "cancelled";
    pathId: string;
    data: PathData;
} | {
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
export type ObserverStrategy = "onEveryChange" | "onNext" | "onSubPathComplete" | "onComplete" | "manual";
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
export declare function matchesStrategy(strategy: ObserverStrategy, event: PathEvent): boolean;
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
export declare class PathEngine {
    private activePath;
    private readonly pathStack;
    private readonly listeners;
    private _isNavigating;
    constructor(options?: PathEngineOptions);
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
    static fromState(state: SerializedPathState, pathDefinitions: Record<string, PathDefinition>, options?: PathEngineOptions): PathEngine;
    subscribe(listener: (event: PathEvent) => void): () => void;
    start(path: PathDefinition<any>, initialData?: PathData): Promise<void>;
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
    restart(path: PathDefinition<any>, initialData?: PathData): Promise<void>;
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
    startSubPath(path: PathDefinition<any>, initialData?: PathData, meta?: Record<string, unknown>): Promise<void>;
    next(): Promise<void>;
    previous(): Promise<void>;
    /** Cancel is synchronous for top-level paths (no hooks). Sub-path cancellation
     *  is async when an `onSubPathCancel` hook is present. Returns a Promise for
     *  API consistency. */
    cancel(): Promise<void>;
    setData(key: string, value: unknown): Promise<void>;
    /** Jumps directly to the step with the given ID. Does not check guards or shouldSkip. */
    goToStep(stepId: string): Promise<void>;
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
    goToStepChecked(stepId: string): Promise<void>;
    snapshot(): PathSnapshot | null;
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
    exportState(): SerializedPathState | null;
    private _startAsync;
    private _nextAsync;
    private _previousAsync;
    private _goToStepAsync;
    private _goToStepCheckedAsync;
    private _cancelSubPathAsync;
    private finishActivePath;
    private requireActivePath;
    private assertPathHasSteps;
    private emit;
    private emitStateChanged;
    private getCurrentStep;
    private applyPatch;
    private skipSteps;
    private enterCurrentStep;
    private leaveCurrentStep;
    private canMoveNext;
    private canMovePrevious;
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
    private evaluateGuardSync;
    /**
     * Evaluates a validationMessages function synchronously for inclusion in the snapshot.
     * If the hook is absent, returns `[]`.
     * If the hook returns a `Promise`, returns `[]` (async hooks are not supported in snapshots).
     *
     * **Note:** Like guards, `validationMessages` is evaluated before `onEnter` runs on first
     * entry. Write it defensively so it does not throw when fields are absent.
     *
     * If the function throws, the error is caught, a `console.warn` is emitted, and `[]`
     * is returned so validation messages do not block the UI unexpectedly.
     */
    private evaluateValidationMessagesSync;
}
