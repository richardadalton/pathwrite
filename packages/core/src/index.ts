export type PathData = Record<string, unknown>;

export interface PathStepContext<TArgs extends PathData = PathData> {
  readonly pathId: string;
  readonly stepId: string;
  readonly args: Readonly<TArgs>;
}

export interface PathStep<TArgs extends PathData = PathData> {
  id: string;
  title?: string;
  meta?: Record<string, unknown>;
  shouldSkip?: (ctx: PathStepContext<TArgs>) => boolean | Promise<boolean>;
  canMoveNext?: (ctx: PathStepContext<TArgs>) => boolean | Promise<boolean>;
  canMovePrevious?: (ctx: PathStepContext<TArgs>) => boolean | Promise<boolean>;
  onEnter?: (ctx: PathStepContext<TArgs>) => Partial<TArgs> | void | Promise<Partial<TArgs> | void>;
  onLeave?: (ctx: PathStepContext<TArgs>) => Partial<TArgs> | void | Promise<Partial<TArgs> | void>;
  onSubPathComplete?: (
    subPathId: string,
    subPathData: PathData,
    ctx: PathStepContext<TArgs>
  ) => Partial<TArgs> | void | Promise<Partial<TArgs> | void>;
}

export interface PathDefinition<TArgs extends PathData = PathData> {
  id: string;
  title?: string;
  steps: PathStep<TArgs>[];
}

export type StepStatus = "completed" | "current" | "upcoming";

export interface StepSummary {
  id: string;
  title?: string;
  meta?: Record<string, unknown>;
  status: StepStatus;
}

export interface PathSnapshot<TArgs extends PathData = PathData> {
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
  args: TArgs;
}

export type PathEvent =
  | { type: "stateChanged"; snapshot: PathSnapshot }
  | { type: "completed"; pathId: string; args: PathData }
  | { type: "cancelled"; pathId: string; args: PathData }
  | {
      type: "resumed";
      resumedPathId: string;
      fromSubPathId: string;
      snapshot: PathSnapshot;
    };

interface ActivePath {
  definition: PathDefinition;
  currentStepIndex: number;
  args: PathData;
}

export class PathEngine {
  private activePath: ActivePath | null = null;
  private readonly pathStack: ActivePath[] = [];
  private readonly listeners = new Set<(event: PathEvent) => void>();
  private _isNavigating = false;

  public subscribe(listener: (event: PathEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  public start(path: PathDefinition, initialData: PathData = {}): Promise<void> {
    this.assertPathHasSteps(path);
    return this._startAsync(path, initialData);
  }

  /** Starts a sub-path on top of the currently active path. Throws if no path is running. */
  public startSubPath(path: PathDefinition, initialData: PathData = {}): Promise<void> {
    this.requireActivePath();
    return this.start(path, initialData);
  }

  public next(): Promise<void> {
    const active = this.requireActivePath();
    return this._nextAsync(active);
  }

  public previous(): Promise<void> {
    const active = this.requireActivePath();
    return this._previousAsync(active);
  }

  /** Cancel is synchronous (no hooks). Returns a resolved Promise for API consistency. */
  public cancel(): Promise<void> {
    const active = this.requireActivePath();
    if (this._isNavigating) return Promise.resolve();

    const cancelledPathId = active.definition.id;
    const cancelledData = { ...active.args };

    if (this.pathStack.length > 0) {
      this.activePath = this.pathStack.pop() ?? null;
      this.emitStateChanged();
      return Promise.resolve();
    }

    this.activePath = null;
    this.emit({ type: "cancelled", pathId: cancelledPathId, args: cancelledData });
    return Promise.resolve();
  }

  public setArg(key: string, value: unknown): Promise<void> {
    const active = this.requireActivePath();
    active.args[key] = value;
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
      args: { ...active.args }
    };
  }

  // ---------------------------------------------------------------------------
  // Private async helpers
  // ---------------------------------------------------------------------------

  private async _startAsync(path: PathDefinition, initialData: PathData): Promise<void> {
    if (this._isNavigating) return;

    if (this.activePath !== null) {
      this.pathStack.push(this.activePath);
    }

    this.activePath = {
      definition: path,
      currentStepIndex: 0,
      args: { ...initialData }
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
      }

      if (active.currentStepIndex >= active.definition.steps.length) {
        this._isNavigating = false;
        await this.finishActivePath();
        return;
      }

      this.applyPatch(await this.enterCurrentStep());
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

    this._isNavigating = true;
    this.emitStateChanged();

    try {
      const step = this.getCurrentStep(active);

      if (await this.canMovePrevious(active, step)) {
        this.applyPatch(await this.leaveCurrentStep(active, step));
        active.currentStepIndex -= 1;
        await this.skipSteps(-1);
      }

      if (active.currentStepIndex < 0) {
        this._isNavigating = false;
        await this.cancel();
        return;
      }

      this.applyPatch(await this.enterCurrentStep());
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

  private async finishActivePath(): Promise<void> {
    const finished = this.requireActivePath();
    const finishedPathId = finished.definition.id;
    const finishedData = { ...finished.args };

    if (this.pathStack.length > 0) {
      this.activePath = this.pathStack.pop()!;
      const parent = this.activePath;
      const parentStep = this.getCurrentStep(parent);

      if (parentStep.onSubPathComplete) {
        const ctx: PathStepContext = {
          pathId: parent.definition.id,
          stepId: parentStep.id,
          args: { ...parent.args }
        };
        this.applyPatch(
          await parentStep.onSubPathComplete(finishedPathId, finishedData, ctx)
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
      this.emit({ type: "completed", pathId: finishedPathId, args: finishedData });
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
        Object.assign(active.args, patch);
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
        args: { ...active.args }
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
    if (!step.onEnter) return;
    const ctx: PathStepContext = {
      pathId: active.definition.id,
      stepId: step.id,
      args: { ...active.args }
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
      args: { ...active.args }
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
      args: { ...active.args }
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
      args: { ...active.args }
    };
    return step.canMovePrevious(ctx);
  }
}

