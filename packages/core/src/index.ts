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

export type PathEvent =
  | { type: "stateChanged"; snapshot: PathSnapshot }
  | { type: "completed"; pathId: string; data: PathData }
  | { type: "cancelled"; pathId: string; data: PathData }
  | {
      type: "resumed";
      resumedPathId: string;
      fromSubPathId: string;
      snapshot: PathSnapshot;
    };

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
    pathDefinitions: Record<string, PathDefinition>
  ): PathEngine {
    if (state.version !== 1) {
      throw new Error(`Unsupported SerializedPathState version: ${state.version}`);
    }

    const engine = new PathEngine();

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
    this.emitStateChanged();
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
      isNavigating: this._isNavigating,
      canMoveNext: this.evaluateGuardSync(step.canMoveNext, active),
      canMovePrevious: this.evaluateGuardSync(step.canMovePrevious, active),
      validationMessages: this.evaluateValidationMessagesSync(step.validationMessages, active),
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

    this.emitStateChanged();

    try {
      this.applyPatch(await this.enterCurrentStep());
      this._isNavigating = false;
      this.emitStateChanged();
    } catch (err) {
      this._isNavigating = false;
      this.emitStateChanged();
      throw err;
    }
  }

  private async _nextAsync(active: ActivePath): Promise<void> {
    if (this._isNavigating) return;

    this._isNavigating = true;
    this.emitStateChanged();

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
      this.emitStateChanged();
    } catch (err) {
      this._isNavigating = false;
      this.emitStateChanged();
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
    this.emitStateChanged();

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
      this.emitStateChanged();
    } catch (err) {
      this._isNavigating = false;
      this.emitStateChanged();
      throw err;
    }
  }

  private async _goToStepAsync(active: ActivePath, targetIndex: number): Promise<void> {
    if (this._isNavigating) return;

    this._isNavigating = true;
    this.emitStateChanged();

    try {
      const currentStep = this.getCurrentStep(active);
      this.applyPatch(await this.leaveCurrentStep(active, currentStep));

      active.currentStepIndex = targetIndex;

      this.applyPatch(await this.enterCurrentStep());
      this._isNavigating = false;
      this.emitStateChanged();
    } catch (err) {
      this._isNavigating = false;
      this.emitStateChanged();
      throw err;
    }
  }

  private async _goToStepCheckedAsync(active: ActivePath, targetIndex: number): Promise<void> {
    if (this._isNavigating) return;

    this._isNavigating = true;
    this.emitStateChanged();

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
      this.emitStateChanged();
    } catch (err) {
      this._isNavigating = false;
      this.emitStateChanged();
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
    this.emitStateChanged();

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
      this.emitStateChanged();
    } catch (err) {
      this._isNavigating = false;
      this.emitStateChanged();
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

  private emitStateChanged(): void {
    this.emit({ type: "stateChanged", snapshot: this.snapshot()! });
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
    if (!step.canMoveNext) return true;
    const ctx: PathStepContext = {
      pathId: active.definition.id,
      stepId: step.id,
      data: { ...active.data },
      isFirstEntry: !active.visitedStepIds.has(step.id)
    };
    return step.canMoveNext(ctx);
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
  private evaluateValidationMessagesSync(
    fn: ((ctx: PathStepContext) => string[] | Promise<string[]>) | undefined,
    active: ActivePath
  ): string[] {
    if (!fn) return [];
    const step = this.getCurrentStep(active);
    const ctx: PathStepContext = {
      pathId: active.definition.id,
      stepId: step.id,
      data: { ...active.data },
      isFirstEntry: !active.visitedStepIds.has(step.id)
    };
    try {
      const result = fn(ctx);
      if (Array.isArray(result)) return result;
      // Async validationMessages detected - warn and return empty array
      if (result && typeof result.then === "function") {
        console.warn(
          `[pathwrite] Async validationMessages detected on step "${step.id}". ` +
          `validationMessages in snapshots must be synchronous. ` +
          `Returning [] as default. ` +
          `Use synchronous validation or move async checks to canMoveNext.`
        );
      }
      return [];
    } catch (err) {
      console.warn(
        `[pathwrite] validationMessages on step "${step.id}" threw an error during snapshot evaluation. ` +
        `Returning [] as a safe default. ` +
        `Note: validationMessages is evaluated before onEnter runs on first entry — ` +
        `ensure it handles missing/undefined data gracefully.`,
        err
      );
      return [];
    }
  }
}

