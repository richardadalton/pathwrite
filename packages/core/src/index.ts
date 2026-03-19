export type WizardArgs = Record<string, unknown>;

export interface WizardStepContext<TArgs extends WizardArgs = WizardArgs> {
  readonly wizardId: string;
  readonly stepId: string;
  readonly args: Readonly<TArgs>;
}

export interface WizardStepDefinition<TArgs extends WizardArgs = WizardArgs> {
  id: string;
  title?: string;
  meta?: Record<string, unknown>;
  shouldSkip?: (ctx: WizardStepContext<TArgs>) => boolean;
  okToMoveNext?: (ctx: WizardStepContext<TArgs>) => boolean;
  okToMovePrevious?: (ctx: WizardStepContext<TArgs>) => boolean;
  onVisit?: (ctx: WizardStepContext<TArgs>) => Partial<TArgs> | void;
  onLeavingStep?: (ctx: WizardStepContext<TArgs>) => Partial<TArgs> | void;
  onResumeFromSubWizard?: (
    subWizardId: string,
    subWizardArgs: WizardArgs,
    ctx: WizardStepContext<TArgs>
  ) => Partial<TArgs> | void;
}

export interface WizardDefinition<TArgs extends WizardArgs = WizardArgs> {
  id: string;
  title?: string;
  steps: WizardStepDefinition<TArgs>[];
}

export type StepStatus = "completed" | "current" | "upcoming";

export interface StepSummary {
  id: string;
  title?: string;
  meta?: Record<string, unknown>;
  status: StepStatus;
}

export interface WizardSnapshot<TArgs extends WizardArgs = WizardArgs> {
  wizardId: string;
  stepId: string;
  stepTitle?: string;
  stepMeta?: Record<string, unknown>;
  stepIndex: number;
  stepCount: number;
  progress: number;
  steps: StepSummary[];
  isFirstStep: boolean;
  isLastStep: boolean;
  stackDepth: number;
  args: TArgs;
}

export type WizardEngineEvent =
  | { type: "stateChanged"; snapshot: WizardSnapshot }
  | { type: "completed"; wizardId: string; args: WizardArgs }
  | { type: "cancelled"; wizardId: string; args: WizardArgs }
  | {
      type: "resumed";
      resumedWizardId: string;
      fromSubWizardId: string;
      snapshot: WizardSnapshot;
    };

interface ActiveWizard {
  definition: WizardDefinition;
  currentStepIndex: number;
  args: WizardArgs;
}

export class WizardEngine {
  private activeWizard: ActiveWizard | null = null;
  private readonly wizardStack: ActiveWizard[] = [];
  private readonly listeners = new Set<(event: WizardEngineEvent) => void>();

  public subscribe(listener: (event: WizardEngineEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public start(wizard: WizardDefinition, initialArgs: WizardArgs = {}): void {
    this.assertWizardHasSteps(wizard);
    if (this.activeWizard !== null) {
      this.wizardStack.push(this.activeWizard);
    }

    this.activeWizard = {
      definition: wizard,
      currentStepIndex: 0,
      args: { ...initialArgs }
    };

    this.skipSteps(1);

    if (this.activeWizard.currentStepIndex >= wizard.steps.length) {
      this.finishActiveWizard();
      return;
    }

    this.applyHookResult(this.visitCurrentStep());
    this.emitStateChanged();
  }

  /** Starts a sub-wizard on top of the currently active wizard. Throws if no wizard is running. */
  public startSubWizard(wizard: WizardDefinition, initialArgs: WizardArgs = {}): void {
    this.requireActiveWizard();
    this.start(wizard, initialArgs);
  }

  public moveNext(): void {
    const active = this.requireActiveWizard();
    const step = this.getCurrentStepDefinition(active);

    if (this.okToMoveNext(active, step)) {
      this.applyHookResult(this.leavingStep(active, step));
      active.currentStepIndex += 1;
      this.skipSteps(1);
    }

    if (active.currentStepIndex >= active.definition.steps.length) {
      this.finishActiveWizard();
      return;
    }

    this.applyHookResult(this.visitCurrentStep());
    this.emitStateChanged();
  }

  public movePrevious(): void {
    const active = this.requireActiveWizard();
    const step = this.getCurrentStepDefinition(active);

    if (this.okToMovePrevious(active, step)) {
      this.applyHookResult(this.leavingStep(active, step));
      active.currentStepIndex -= 1;
      this.skipSteps(-1);
    }

    if (active.currentStepIndex < 0) {
      this.cancel();
      return;
    }

    this.applyHookResult(this.visitCurrentStep());
    this.emitStateChanged();
  }

  public cancel(): void {
    const active = this.requireActiveWizard();
    const cancelledWizardId = active.definition.id;
    const cancelledArgs = { ...active.args };

    if (this.wizardStack.length > 0) {
      this.activeWizard = this.wizardStack.pop() ?? null;
      this.emitStateChanged();
      return;
    }

    this.activeWizard = null;
    this.emit({ type: "cancelled", wizardId: cancelledWizardId, args: cancelledArgs });
  }

  public setArg(key: string, value: unknown): void {
    const active = this.requireActiveWizard();
    active.args[key] = value;
    this.emitStateChanged();
  }

  /** Jumps directly to the step with the given ID. Calls onLeavingStep on the current step and onVisit on the target. Does not check guards or shouldSkip. */
  public goToStep(stepId: string): void {
    const active = this.requireActiveWizard();
    const targetIndex = active.definition.steps.findIndex((s) => s.id === stepId);
    if (targetIndex === -1) {
      throw new Error(`Step "${stepId}" not found in wizard "${active.definition.id}".`);
    }

    const currentStep = this.getCurrentStepDefinition(active);
    this.applyHookResult(this.leavingStep(active, currentStep));

    active.currentStepIndex = targetIndex;

    this.applyHookResult(this.visitCurrentStep());
    this.emitStateChanged();
  }

  public getSnapshot(): WizardSnapshot | null {
    if (this.activeWizard === null) {
      return null;
    }

    const active = this.activeWizard;
    const step = this.getCurrentStepDefinition(active);
    const { steps } = active.definition;
    const stepCount = steps.length;

    return {
      wizardId: active.definition.id,
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
        this.wizardStack.length === 0,
      stackDepth: this.wizardStack.length,
      args: { ...active.args }
    };
  }

  private finishActiveWizard(): void {
    const finished = this.requireActiveWizard();
    const finishedWizardId = finished.definition.id;
    const finishedArgs = { ...finished.args };

    if (this.wizardStack.length > 0) {
      const parent = this.wizardStack.pop() as ActiveWizard;
      this.activeWizard = parent;
      const parentStep = this.getCurrentStepDefinition(parent);
      const patch = parentStep.onResumeFromSubWizard?.(
        finishedWizardId,
        finishedArgs,
        this.buildContext(parent)
      );
      this.applyHookResult(patch);
      this.applyHookResult(this.visitCurrentStep());
      this.emit({
        type: "resumed",
        resumedWizardId: parent.definition.id,
        fromSubWizardId: finishedWizardId,
        snapshot: this.getSnapshotOrThrow()
      });
      this.emitStateChanged();
      return;
    }

    this.activeWizard = null;
    this.emit({ type: "completed", wizardId: finishedWizardId, args: finishedArgs });
  }

  private visitCurrentStep(): Partial<WizardArgs> | void {
    const active = this.requireActiveWizard();
    const step = this.getCurrentStepDefinition(active);
    return step.onVisit?.(this.buildContext(active));
  }

  private leavingStep(active: ActiveWizard, step: WizardStepDefinition): Partial<WizardArgs> | void {
    return step.onLeavingStep?.(this.buildContext(active));
  }

  private okToMoveNext(active: ActiveWizard, step: WizardStepDefinition): boolean {
    return step.okToMoveNext?.(this.buildContext(active)) ?? true;
  }

  private okToMovePrevious(active: ActiveWizard, step: WizardStepDefinition): boolean {
    return step.okToMovePrevious?.(this.buildContext(active)) ?? true;
  }

  /** Returns a context with a snapshot copy of args — hooks cannot mutate internal state directly. */
  private buildContext(active: ActiveWizard): WizardStepContext {
    return {
      wizardId: active.definition.id,
      stepId: this.getCurrentStepDefinition(active).id,
      args: { ...active.args }
    };
  }

  /** Merges a hook's returned patch into the active wizard's args. */
  private applyHookResult(patch: Partial<WizardArgs> | void | undefined): void {
    if (patch != null && this.activeWizard !== null) {
      Object.assign(this.activeWizard.args, patch);
    }
  }

  /** Advances (direction=1) or retreats (direction=-1) past steps where shouldSkip returns true. */
  private skipSteps(direction: 1 | -1): void {
    const active = this.activeWizard;
    if (active === null) return;
    const { steps } = active.definition;
    while (
      active.currentStepIndex >= 0 &&
      active.currentStepIndex < steps.length &&
      steps[active.currentStepIndex].shouldSkip?.(this.buildContext(active))
    ) {
      active.currentStepIndex += direction;
    }
  }

  private getCurrentStepDefinition(active: ActiveWizard): WizardStepDefinition {
    return active.definition.steps[active.currentStepIndex];
  }

  private requireActiveWizard(): ActiveWizard {
    if (this.activeWizard === null) {
      throw new Error("No active wizard is running.");
    }
    return this.activeWizard;
  }

  private getSnapshotOrThrow(): WizardSnapshot {
    const snapshot = this.getSnapshot();
    if (snapshot === null) {
      throw new Error("No active wizard snapshot available.");
    }
    return snapshot;
  }

  private assertWizardHasSteps(wizard: WizardDefinition): void {
    if (wizard.steps.length === 0) {
      throw new Error("Cannot start an empty wizard.");
    }
  }

  private emitStateChanged(): void {
    if (this.activeWizard === null) {
      return;
    }
    this.emit({ type: "stateChanged", snapshot: this.getSnapshotOrThrow() });
  }

  private emit(event: WizardEngineEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }
}

