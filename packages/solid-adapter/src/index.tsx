import {
  createSignal,
  onCleanup,
  onMount,
  createContext,
  useContext,
  createEffect,
  For,
  Show,
  type Component,
  type JSX,
  type Accessor,
} from "solid-js";
import {
  PathData,
  PathDefinition,
  PathEngine,
  PathEvent,
  PathSnapshot,
  ProgressLayout,
  RootProgress,
  formatFieldKey,
  errorPhaseMessage,
} from "@daltonr/pathwrite-core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UsePathOptions {
  /**
   * An externally-managed `PathEngine` to subscribe to — for example, the engine
   * returned by `createPersistedEngine()` from `@daltonr/pathwrite-store`.
   *
   * When provided:
   * - `usePath` will **not** create its own engine.
   * - The snapshot is seeded immediately from the engine's current state.
   * - The engine lifecycle (start / cleanup) is the **caller's responsibility**.
   * - `PathShell` will skip its own `autoStart` call.
   */
  engine?: PathEngine;
  /** Called for every engine event (stateChanged, completed, cancelled, resumed). */
  onEvent?: (event: PathEvent) => void;
}

export interface UsePathReturn<TData extends PathData = PathData> {
  /**
   * Reactive snapshot accessor. Call `snapshot()` to read the current value.
   * Automatically tracked as a reactive dependency when read inside JSX or effects.
   */
  snapshot: Accessor<PathSnapshot<TData> | null>;
  /** Start (or restart) a path. */
  start: (path: PathDefinition<any>, initialData?: PathData) => Promise<void>;
  /** Push a sub-path onto the stack. Requires an active path. Pass an optional `meta` object for correlation — it is returned unchanged to the parent step's `onSubPathComplete` / `onSubPathCancel` hooks. */
  startSubPath: (path: PathDefinition<any>, initialData?: PathData, meta?: Record<string, unknown>) => Promise<void>;
  /** Advance one step. Completes the path on the last step. */
  next: () => Promise<void>;
  /** Go back one step. No-op when already on the first step of a top-level path. Pops back to the parent path when on the first step of a sub-path. */
  previous: () => Promise<void>;
  /** Cancel the active path (or sub-path). */
  cancel: () => Promise<void>;
  /** Jump directly to a step by ID. Calls onLeave / onEnter but bypasses guards and shouldSkip. */
  goToStep: (stepId: string) => Promise<void>;
  /** Jump directly to a step by ID, checking the current step's canMoveNext (forward) or canMovePrevious (backward) guard first. Navigation is blocked if the guard returns false. */
  goToStepChecked: (stepId: string) => Promise<void>;
  /** Update a single data value; triggers re-renders via stateChanged. When `TData` is specified, `key` and `value` are type-checked against your data shape. */
  setData: <K extends string & keyof TData>(key: K, value: TData[K]) => Promise<void>;
  /** Reset the current step's data to what it was when the step was entered. Useful for "Clear" or "Reset" buttons. */
  resetStep: () => Promise<void>;
  /**
   * Tear down any active path (without firing hooks) and immediately start the
   * given path fresh. Safe to call whether or not a path is currently active.
   * Use for "Start over" / retry flows without remounting the component.
   */
  restart: () => Promise<void>;
  /** Re-runs the operation that set `snapshot().error`. Increments `retryCount` on repeated failure. No-op when there is no pending error. */
  retry: () => Promise<void>;
  /** Pauses the path with intent to return. Emits `suspended`. All state is preserved. */
  suspend: () => Promise<void>;
  /** Trigger inline validation on all steps without navigating. Sets `snapshot().hasValidated`. */
  validate: () => void;
}

// ---------------------------------------------------------------------------
// usePath composable
// ---------------------------------------------------------------------------

export function usePath<TData extends PathData = PathData>(options?: UsePathOptions): UsePathReturn<TData> {
  const engine = options?.engine ?? new PathEngine();

  const [snapshot, setSnapshot] = createSignal<PathSnapshot<TData> | null>(
    engine.snapshot() as PathSnapshot<TData> | null,
    // always notify — PathEngine produces new snapshot objects on every event
    { equals: false }
  );

  const unsubscribe = engine.subscribe((event: PathEvent) => {
    if (event.type === "stateChanged" || event.type === "resumed") {
      setSnapshot(event.snapshot as PathSnapshot<TData>);
    } else if (event.type === "completed" || event.type === "cancelled") {
      setSnapshot(engine.snapshot() as PathSnapshot<TData> | null);
    }
    options?.onEvent?.(event);
  });

  onCleanup(unsubscribe);

  const start = (path: PathDefinition<any>, initialData: PathData = {}): Promise<void> =>
    engine.start(path, initialData);

  const startSubPath = (path: PathDefinition<any>, initialData: PathData = {}, meta?: Record<string, unknown>): Promise<void> =>
    engine.startSubPath(path, initialData, meta);

  const next = (): Promise<void> => engine.next();
  const previous = (): Promise<void> => engine.previous();
  const cancel = (): Promise<void> => engine.cancel();
  const goToStep = (stepId: string): Promise<void> => engine.goToStep(stepId);
  const goToStepChecked = (stepId: string): Promise<void> => engine.goToStepChecked(stepId);

  const setData = (<K extends string & keyof TData>(key: K, value: TData[K]): Promise<void> =>
    engine.setData(key, value as unknown)) as UsePathReturn<TData>["setData"];

  const resetStep = (): Promise<void> => engine.resetStep();
  const restart = (): Promise<void> => engine.restart();
  const retry = (): Promise<void> => engine.retry();
  const suspend = (): Promise<void> => engine.suspend();
  const validate = (): void => engine.validate();

  return { snapshot, start, startSubPath, next, previous, cancel, goToStep, goToStepChecked, setData, resetStep, restart, retry, suspend, validate };
}

// ---------------------------------------------------------------------------
// Context — provide / useContext
// ---------------------------------------------------------------------------

interface PathContextValue {
  path: UsePathReturn;
  services: unknown;
}

const PathContext = createContext<PathContextValue | undefined>(undefined);

/**
 * Access the nearest `PathShell`'s path instance and optional services object.
 * Throws if used outside of a PathShell component.
 *
 * Both generics are type-level assertions, not runtime guarantees:
 * - `TData` narrows `snapshot().data`
 * - `TServices` types the `services` value — must match what was passed to `PathShell`
 */
export function usePathContext<TData extends PathData = PathData, TServices = unknown>(): Omit<UsePathReturn<TData>, "snapshot"> & { snapshot: Accessor<PathSnapshot<TData>>; services: TServices } {
  const ctx = useContext(PathContext);
  if (!ctx) {
    throw new Error("usePathContext must be used within a PathShell component.");
  }
  return {
    ...(ctx.path as unknown as Omit<UsePathReturn<TData>, "snapshot"> & { snapshot: Accessor<PathSnapshot<TData>> }),
    services: ctx.services as TServices,
  };
}

// ---------------------------------------------------------------------------
// Default UI — PathShell
// ---------------------------------------------------------------------------

export interface PathShellActions {
  next: () => Promise<void>;
  previous: () => Promise<void>;
  cancel: () => Promise<void>;
  goToStep: (stepId: string) => Promise<void>;
  goToStepChecked: (stepId: string) => Promise<void>;
  setData: (key: string, value: unknown) => Promise<void>;
  restart: () => Promise<void>;
  retry: () => Promise<void>;
  suspend: () => Promise<void>;
}

export interface PathShellProps {
  path: PathDefinition<any>;
  /**
   * An externally-managed engine — for example, the engine returned by
   * `createPersistedEngine()`. When supplied, `PathShell` will skip its own
   * `start()` call and drive the UI from the provided engine instead.
   */
  engine?: PathEngine;
  initialData?: PathData;
  /**
   * When set, this shell automatically saves its state into the nearest outer `PathShell`'s
   * data under this key on every change, and restores from that stored state on remount.
   * No-op when used on a top-level shell with no outer `PathShell` ancestor.
   */
  restoreKey?: string;
  autoStart?: boolean;
  /**
   * Step render functions keyed by step ID (or `formId` for StepChoice steps).
   * ```tsx
   * <PathShell steps={{ details: (snap) => <DetailsStep snapshot={snap} />, review: (snap) => <ReviewStep snapshot={snap} /> }} />
   * ```
   */
  steps?: Record<string, (snapshot: PathSnapshot) => JSX.Element>;
  onComplete?: (data: PathData) => void;
  onCancel?: (data: PathData) => void;
  onEvent?: (event: PathEvent) => void;
  renderHeader?: (snapshot: PathSnapshot) => JSX.Element;
  renderFooter?: (snapshot: PathSnapshot, actions: PathShellActions) => JSX.Element;
  backLabel?: string;
  nextLabel?: string;
  completeLabel?: string;
  loadingLabel?: string;
  cancelLabel?: string;
  hideCancel?: boolean;
  hideProgress?: boolean;
  /** If true, hide the footer (navigation buttons). The error panel is still shown on async failure regardless of this prop. */
  hideFooter?: boolean;
  /**
   * Shell layout mode:
   * - `"auto"` (default): Uses "form" for single-step top-level paths, "wizard" otherwise.
   * - `"wizard"`: Progress header + Back button on left, Cancel and Submit together on right.
   * - `"form"`: Progress header + Cancel on left, Submit alone on right. Back button never shown.
   * - `"tabs"`: No progress header, no footer. Use for tabbed interfaces with a custom tab bar inside the step body.
   */
  layout?: "wizard" | "form" | "auto" | "tabs";
  /**
   * Controls whether the shell renders its auto-generated field-error summary box.
   * - `"summary"` (default): Shell renders the labeled error list below the step body.
   * - `"inline"`: Suppress the summary — handle errors inside the step component instead.
   * - `"both"`: Render the shell summary AND whatever the step renders.
   */
  validationDisplay?: "summary" | "inline" | "both";
  /**
   * Controls how progress bars are arranged when a sub-path is active.
   * - `"merged"` (default): Root and sub-path bars in one card.
   * - `"split"`: Root and sub-path bars as separate cards.
   * - `"rootOnly"`: Only the root bar — sub-path bar hidden.
   * - `"activeOnly"`: Only the active (sub-path) bar — root bar hidden.
   */
  progressLayout?: ProgressLayout;
  /**
   * Services object passed through context to all step components.
   * Step components access it via `usePathContext<TData, TServices>()`.
   */
  services?: object | null;
  /** When true, calls `validate()` on the engine so all steps show inline errors simultaneously. Useful when this shell is nested inside a step of an outer shell: bind to the outer snapshot's `hasAttemptedNext`. */
  validateWhen?: boolean;
  class?: string;
  /**
   * Content rendered when `snapshot.status === "completed"` (i.e. after the path
   * finishes with `completionBehaviour: "stayOnFinal"`). Defaults to a simple
   * "All done." panel with a Restart button.
   */
  completionContent?: (snapshot: PathSnapshot) => JSX.Element;
}

export const PathShell: Component<PathShellProps> = (props) => {
  // Read outer PathShell context BEFORE providing our own.
  const outerCtx = useContext(PathContext);

  const pathReturn = usePath({
    engine: props.engine,
    onEvent(event) {
      props.onEvent?.(event);
      if (event.type === "completed") props.onComplete?.(event.data as PathData);
      if (event.type === "cancelled") props.onCancel?.(event.data as PathData);
      if (props.restoreKey && outerCtx && event.type === "stateChanged") {
        (outerCtx.path.setData as unknown as (key: string, value: unknown) => void)(
          props.restoreKey, event.snapshot
        );
      }
    },
  });

  const { snapshot, start, next, previous, cancel, goToStep, goToStepChecked, setData, restart, retry, suspend, validate } = pathReturn;

  onMount(() => {
    if (props.autoStart !== false && !props.engine) {
      let startData: PathData = props.initialData ?? {};
      let restoreStepId: string | undefined;
      if (props.restoreKey && outerCtx) {
        const stored = outerCtx.path.snapshot()?.data[props.restoreKey] as PathSnapshot | undefined;
        if (stored != null && typeof stored === "object" && "stepId" in stored) {
          startData = stored.data as PathData;
          if (stored.stepIndex > 0) restoreStepId = stored.stepId as string;
        }
      }
      const p = start(props.path, startData);
      if (restoreStepId) {
        p.then(() => goToStep(restoreStepId!));
      }
    }
  });

  createEffect(() => {
    if (props.validateWhen) validate();
  });

  const contextValue: PathContextValue = { path: pathReturn, services: props.services ?? null };

  const actions: PathShellActions = {
    next, previous, cancel, goToStep, goToStepChecked,
    setData: (key, value) => setData(key as any, value as any),
    restart: () => restart(),
    retry: () => retry(),
    suspend: () => suspend(),
  };

  // Convenience — non-null snapshot, only valid inside <Show when={snapshot()}>
  const snap = () => snapshot()!;

  const shellClass = () => {
    const base = "pw-shell";
    const layout = props.progressLayout;
    const mod = layout && layout !== "merged" ? ` pw-shell--progress-${layout}` : "";
    return props.class ? `${base}${mod} ${props.class}` : `${base}${mod}`;
  };

  const effectiveHideProgress = () => props.hideProgress || props.layout === "tabs";
  const effectiveHideFooter = () => props.hideFooter || props.layout === "tabs";
  const showRoot = () => !effectiveHideProgress() && !!snap().rootProgress && props.progressLayout !== "activeOnly";
  const showActive = () => !effectiveHideProgress() && (snap().stepCount > 1 || snap().nestingLevel > 0) && props.progressLayout !== "rootOnly";

  const stepContent = () => {
    const s = snap();
    const key = s.formId ?? s.stepId;
    const render = props.steps?.[key];
    return render ? render(s) : null;
  };

  const showValidation = () =>
    props.validationDisplay !== "inline" &&
    (snap().hasAttemptedNext || snap().hasValidated) &&
    Object.keys(snap().fieldErrors).length > 0;

  const showWarnings = () =>
    props.validationDisplay !== "inline" &&
    Object.keys(snap().fieldWarnings).length > 0;

  const showBlockingError = () =>
    props.validationDisplay !== "inline" &&
    (snap().hasAttemptedNext || snap().hasValidated) &&
    !!snap().blockingError;

  const resolvedFooterLayout = () => {
    const fl = props.layout ?? "auto";
    if (fl !== "auto" && fl !== "tabs") return fl;
    return snap().stepCount === 1 && snap().nestingLevel === 0 ? "form" : "wizard";
  };

  return (
    <PathContext.Provider value={contextValue}>
      <Show
        when={snapshot()}
        fallback={
          <div class="pw-shell">
            <div class="pw-shell__empty">
              <p>No active path.</p>
              <Show when={props.autoStart === false}>
                <button
                  type="button"
                  class="pw-shell__start-btn"
                  onClick={() => start(props.path, props.initialData ?? {})}
                >
                  Start
                </button>
              </Show>
            </div>
          </div>
        }
      >
        <div class={shellClass()}>
          {/* Root progress — persistent top-level bar visible during sub-paths */}
          <Show when={showRoot()}>
            <SolidRootProgress root={snap().rootProgress!} />
          </Show>
          {/* Header — progress (active path) */}
          <Show when={showActive()}>
            {props.renderHeader
              ? props.renderHeader(snap())
              : <SolidHeader snapshot={snap()} />}
          </Show>
          {/* Completion panel — shown when path finishes with stayOnFinal */}
          <Show when={snap().status === "completed"}>
            <div class="pw-shell__body">
              {props.completionContent
                ? props.completionContent(snap())
                : (
                  <div class="pw-shell__completion">
                    <p class="pw-shell__completion-message">All done.</p>
                    <button
                      type="button"
                      class="pw-shell__completion-restart"
                      onClick={() => restart()}
                    >
                      Start over
                    </button>
                  </div>
                )
              }
            </div>
          </Show>
          {/* Body — step content (hidden when completed) */}
          <Show when={snap().status !== "completed"}>
          <div class="pw-shell__body">{stepContent()}</div>
          {/* Validation messages */}
          <Show when={showValidation()}>
            <ul class="pw-shell__validation">
              <For each={Object.entries(snap().fieldErrors)}>
                {([key, msg]) => (
                  <li class="pw-shell__validation-item">
                    <Show when={key !== "_"}>
                      <span class="pw-shell__validation-label">{formatFieldKey(key)}</span>
                    </Show>
                    {msg}
                  </li>
                )}
              </For>
            </ul>
          </Show>
          {/* Warning messages — non-blocking, shown immediately */}
          <Show when={showWarnings()}>
            <ul class="pw-shell__warnings">
              <For each={Object.entries(snap().fieldWarnings)}>
                {([key, msg]) => (
                  <li class="pw-shell__warnings-item">
                    <Show when={key !== "_"}>
                      <span class="pw-shell__warnings-label">{formatFieldKey(key)}</span>
                    </Show>
                    {msg}
                  </li>
                )}
              </For>
            </ul>
          </Show>
          {/* Blocking error */}
          <Show when={showBlockingError()}>
            <p class="pw-shell__blocking-error">{snap().blockingError}</p>
          </Show>
          {/* Error panel or footer */}
          <Show
            when={snap().status === "error" && snap().error}
            fallback={
              <Show when={!effectiveHideFooter()}>
                {props.renderFooter
                  ? props.renderFooter(snap(), actions)
                  : <SolidFooter
                      snapshot={snap()}
                      actions={actions}
                      backLabel={props.backLabel ?? "Previous"}
                      nextLabel={props.nextLabel ?? "Next"}
                      completeLabel={props.completeLabel ?? "Complete"}
                      loadingLabel={props.loadingLabel}
                      cancelLabel={props.cancelLabel ?? "Cancel"}
                      hideCancel={props.hideCancel ?? false}
                      layout={resolvedFooterLayout()}
                    />
                }
              </Show>
            }
          >
            <SolidErrorPanel snapshot={snap()} actions={actions} />
          </Show>
          </Show>{/* end status !== completed */}
        </div>
      </Show>
    </PathContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Root progress
// ---------------------------------------------------------------------------

function SolidRootProgress(props: { root: RootProgress }) {
  return (
    <div class="pw-shell__root-progress">
      <div class="pw-shell__steps">
        <For each={props.root.steps}>
          {(step, i) => (
            <div class={`pw-shell__step pw-shell__step--${step.status}`}>
              <span class="pw-shell__step-dot">
                {step.status === "completed" ? "✓" : String(i() + 1)}
              </span>
              <span class="pw-shell__step-label">{step.title ?? step.id}</span>
            </div>
          )}
        </For>
      </div>
      <div class="pw-shell__track">
        <div class="pw-shell__track-fill" style={{ width: `${props.root.progress * 100}%` }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Default header (progress indicator)
// ---------------------------------------------------------------------------

function SolidHeader(props: { snapshot: PathSnapshot }) {
  return (
    <div class="pw-shell__header">
      <div class="pw-shell__steps">
        <For each={props.snapshot.steps}>
          {(step, i) => (
            <div class={`pw-shell__step pw-shell__step--${step.status}`}>
              <span class="pw-shell__step-dot">
                {step.status === "completed" ? "✓" : String(i() + 1)}
              </span>
              <span class="pw-shell__step-label">{step.title ?? step.id}</span>
            </div>
          )}
        </For>
      </div>
      <div class="pw-shell__track">
        <div class="pw-shell__track-fill" style={{ width: `${props.snapshot.progress * 100}%` }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error panel
// ---------------------------------------------------------------------------

function SolidErrorPanel(props: { snapshot: PathSnapshot; actions: PathShellActions }) {
  const error = () => props.snapshot.error!;
  const escalated = () => error().retryCount >= 2;
  const title = () => escalated() ? "Still having trouble." : "Something went wrong.";
  const phaseMsg = () => errorPhaseMessage(error().phase);

  return (
    <div class="pw-shell__error">
      <div class="pw-shell__error-title">{title()}</div>
      <div class="pw-shell__error-message">
        {phaseMsg()}{error().message ? ` ${error().message}` : ""}
      </div>
      <div class="pw-shell__error-actions">
        <Show when={!escalated()}>
          <button type="button" class="pw-shell__btn pw-shell__btn--retry" onClick={props.actions.retry}>
            Try again
          </button>
        </Show>
        <Show when={props.snapshot.hasPersistence}>
          <button
            type="button"
            class={`pw-shell__btn ${escalated() ? "pw-shell__btn--retry" : "pw-shell__btn--suspend"}`}
            onClick={props.actions.suspend}
          >
            Save and come back later
          </button>
        </Show>
        <Show when={escalated() && !props.snapshot.hasPersistence}>
          <button type="button" class="pw-shell__btn pw-shell__btn--retry" onClick={props.actions.retry}>
            Try again
          </button>
        </Show>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Default footer (navigation buttons)
// ---------------------------------------------------------------------------

function SolidFooter(props: {
  snapshot: PathSnapshot;
  actions: PathShellActions;
  backLabel: string;
  nextLabel: string;
  completeLabel: string;
  loadingLabel?: string;
  cancelLabel: string;
  hideCancel: boolean;
  layout: "wizard" | "form";
}) {
  const isFormMode = () => props.layout === "form";
  const isLoading = () => props.snapshot.status !== "idle";
  const submitLabel = () =>
    isLoading() && props.loadingLabel
      ? props.loadingLabel
      : props.snapshot.isLastStep
        ? props.completeLabel
        : props.nextLabel;

  return (
    <div class="pw-shell__footer">
      <div class="pw-shell__footer-left">
        {/* Form mode: Cancel on the left */}
        <Show when={isFormMode() && !props.hideCancel}>
          <button
            type="button"
            class="pw-shell__btn pw-shell__btn--cancel"
            disabled={isLoading()}
            onClick={props.actions.cancel}
          >
            {props.cancelLabel}
          </button>
        </Show>
        {/* Wizard mode: Back on the left */}
        <Show when={!isFormMode() && !props.snapshot.isFirstStep}>
          <button
            type="button"
            class="pw-shell__btn pw-shell__btn--back"
            disabled={isLoading() || !props.snapshot.canMovePrevious}
            onClick={props.actions.previous}
          >
            {props.backLabel}
          </button>
        </Show>
      </div>
      <div class="pw-shell__footer-right">
        {/* Wizard mode: Cancel on the right */}
        <Show when={!isFormMode() && !props.hideCancel}>
          <button
            type="button"
            class="pw-shell__btn pw-shell__btn--cancel"
            disabled={isLoading()}
            onClick={props.actions.cancel}
          >
            {props.cancelLabel}
          </button>
        </Show>
        {/* Both modes: Submit on the right */}
        <button
          type="button"
          class={`pw-shell__btn pw-shell__btn--next${isLoading() ? " pw-shell__btn--loading" : ""}`}
          disabled={isLoading()}
          onClick={props.actions.next}
        >
          {submitLabel()}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Re-export core types for convenience
// ---------------------------------------------------------------------------

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
  SerializedPathState,
} from "@daltonr/pathwrite-core";

export { PathEngine } from "@daltonr/pathwrite-core";
