import {
  createContext,
  createElement,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useSyncExternalStore
} from "react";
import type { ChangeEvent, PropsWithChildren, ReactElement, ReactNode } from "react";
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
  /** Called for every engine event (stateChanged, completed, cancelled, resumed). The callback ref is kept current — changing it does **not** re-subscribe to the engine. */
  onEvent?: (event: PathEvent) => void;
}

export interface UsePathReturn<TData extends PathData = PathData> {
  /** Current path snapshot, or `null` when no path is active. Triggers a React re-render on change. */
  snapshot: PathSnapshot<TData> | null;
  /** Start (or restart) a path. */
  start: (path: PathDefinition<any>, initialData?: PathData) => void;
  /** Push a sub-path onto the stack. Requires an active path. Pass an optional `meta` object for correlation — it is returned unchanged to the parent step's `onSubPathComplete` / `onSubPathCancel` hooks. */
  startSubPath: (path: PathDefinition<any>, initialData?: PathData, meta?: Record<string, unknown>) => void;
  /** Advance one step. Completes the path on the last step. */
  next: () => void;
  /** Go back one step. No-op when already on the first step of a top-level path. Pops back to the parent path when on the first step of a sub-path. */
  previous: () => void;
  /** Cancel the active path (or sub-path). */
  cancel: () => void;
  /** Jump directly to a step by ID. Calls onLeave / onEnter but bypasses guards and shouldSkip. */
  goToStep: (stepId: string) => void;
  /** Jump directly to a step by ID, checking the current step's canMoveNext (forward) or canMovePrevious (backward) guard first. Navigation is blocked if the guard returns false. */
  goToStepChecked: (stepId: string) => void;
  /** Update a single data value; triggers a re-render via stateChanged. When `TData` is specified, `key` and `value` are type-checked against your data shape. */
  setData: <K extends string & keyof TData>(key: K, value: TData[K]) => void;
  /** Reset the current step's data to what it was when the step was entered. Useful for "Clear" or "Reset" buttons. */
  resetStep: () => void;
  /**
   * Tear down any active path (without firing hooks) and immediately restart
   * the same path with the same initial data. Safe to call at any time.
   * Use for "Start over" / retry flows without remounting the component.
   */
  restart: () => void;
  /**
   * Re-runs the operation that set `snapshot.error`. Increments `snapshot.error.retryCount`
   * on repeated failure so shells can escalate from "Try again" to "Come back later".
   * No-op when there is no pending error.
   */
  retry: () => void;
  /**
   * Pauses the path with intent to return. Emits a `suspended` event that the application
   * listens for to dismiss the wizard UI. All state and data are preserved.
   */
  suspend: () => void;
  /** Trigger inline validation on all steps without navigating. Sets `snapshot.hasValidated`. */
  validate: () => void;
}

export type PathProviderProps = PropsWithChildren<{
  /** Forwarded to the internal usePath hook. */
  onEvent?: (event: PathEvent) => void;
  /**
   * Services object passed through context to all step components.
   * Step components access it via `usePathContext<TData, TServices>()`.
   * Typed as `unknown` here so `PathProvider` stays non-generic — provide a
   * typed services interface via the `TServices` type parameter on `usePathContext`.
   */
  services?: unknown;
}>;

// ---------------------------------------------------------------------------
// usePath hook
// ---------------------------------------------------------------------------

export function usePath<TData extends PathData = PathData>(options?: UsePathOptions): UsePathReturn<TData> {
  // Use provided engine or create a stable new one for this hook's lifetime.
  // options.engine must be a stable reference (don't recreate on every render).
  const engineRef = useRef<PathEngine | null>(null);
  if (engineRef.current === null) {
    engineRef.current = options?.engine ?? new PathEngine();
  }
  const engine = engineRef.current;

  // Keep the onEvent callback current without changing the subscribe identity
  const onEventRef = useRef(options?.onEvent);
  onEventRef.current = options?.onEvent;

  // Seed immediately from existing engine state — essential when restoring a
  // persisted path (the engine is already started before usePath is called).
  // We track whether we've seeded to avoid calling engine.snapshot() on every
  // re-render (React evaluates useRef's argument each time).
  const seededRef = useRef(false);
  const snapshotRef = useRef<PathSnapshot<TData> | null>(null);
  if (!seededRef.current) {
    seededRef.current = true;
    try {
      snapshotRef.current = engine.snapshot() as PathSnapshot<TData> | null;
    } catch {
      snapshotRef.current = null;
    }
  }

  const subscribe = useCallback(
    (callback: () => void) =>
      engine.subscribe((event: PathEvent) => {
        if (event.type === "stateChanged" || event.type === "resumed") {
          snapshotRef.current = event.snapshot as PathSnapshot<TData>;
        } else if (event.type === "completed" || event.type === "cancelled") {
          snapshotRef.current = null;
        }
        onEventRef.current?.(event);
        callback();
      }),
    [engine]
  );

  const getSnapshot = useCallback(() => snapshotRef.current, []);

  const snapshot = useSyncExternalStore(subscribe, getSnapshot);

  // Stable action callbacks
  const start = useCallback(
    (path: PathDefinition<any>, initialData: PathData = {}) =>
      engine.start(path, initialData),
    [engine]
  );

  const startSubPath = useCallback(
    (path: PathDefinition<any>, initialData: PathData = {}, meta?: Record<string, unknown>) =>
      engine.startSubPath(path, initialData, meta),
    [engine]
  );

  const next = useCallback(() => engine.next(), [engine]);
  const previous = useCallback(() => engine.previous(), [engine]);
  const cancel = useCallback(() => engine.cancel(), [engine]);

  const goToStep = useCallback(
    (stepId: string) => engine.goToStep(stepId),
    [engine]
  );

  const goToStepChecked = useCallback(
    (stepId: string) => engine.goToStepChecked(stepId),
    [engine]
  );

  const setData = useCallback(
    <K extends string & keyof TData>(key: K, value: TData[K]) => engine.setData(key, value as unknown),
    [engine]
  ) as UsePathReturn<TData>["setData"];

  const resetStep = useCallback(() => engine.resetStep(), [engine]);

  const restart = useCallback(() => engine.restart(), [engine]);

  const retry = useCallback(() => engine.retry(), [engine]);

  const suspend = useCallback(() => engine.suspend(), [engine]);

  const validate = useCallback(() => engine.validate(), [engine]);

  return { snapshot, start, startSubPath, next, previous, cancel, goToStep, goToStepChecked, setData, resetStep, restart, retry, suspend, validate };
}

// ---------------------------------------------------------------------------
// Context + Provider
// ---------------------------------------------------------------------------

interface PathContextValue {
  path: UsePathReturn;
  services: unknown;
}

const PathContext = createContext<PathContextValue | null>(null);

/**
 * Provides a single `usePath` instance to all descendants.
 * Consume with `usePathContext()`.
 */
export function PathProvider({ children, onEvent, services }: PathProviderProps): ReactElement {
  const path = usePath({ onEvent });
  return createElement(PathContext.Provider, { value: { path, services: services ?? null } }, children);
}

/**
 * Access the nearest `PathProvider`'s path instance and optional services object.
 * Throws if used outside of a `<PathProvider>` or `<PathShell>`.
 *
 * Both generics are type-level assertions, not runtime guarantees:
 * - `TData` narrows `snapshot.data`
 * - `TServices` types the `services` value — must match what was passed to `PathShell` or `PathProvider`
 *
 * @example
 * ```tsx
 * function OfficeStep() {
 *   const { snapshot, services } = usePathContext<HiringData, HiringServices>();
 *   // services is typed as HiringServices
 * }
 * ```
 */
export function usePathContext<TData extends PathData = PathData, TServices = unknown>(): Omit<UsePathReturn<TData>, "snapshot"> & { snapshot: PathSnapshot<TData>; services: TServices } {
  const ctx = useContext(PathContext);
  if (ctx === null) {
    throw new Error("usePathContext must be used within a <PathProvider>.");
  }
  return {
    ...(ctx.path as unknown as Omit<UsePathReturn<TData>, "snapshot"> & { snapshot: PathSnapshot<TData> }),
    services: ctx.services as TServices
  };
}

// ---------------------------------------------------------------------------
// useField — input binding helper
// ---------------------------------------------------------------------------

/**
 * Binding helper for a single `<input>`, `<select>`, or `<textarea>` field.
 *
 * Returns `{ value, onChange }` tied to `snapshot.data[field]`, so you can
 * spread it directly onto an element and eliminate the repetitive
 * `onChange={e => setData("field", e.target.value)}` pattern:
 *
 * ```tsx
 * function NameStep() {
 *   const name = useField<MyData, "name">("name");
 *   return <input type="text" {...name} />;
 * }
 * ```
 *
 * - `value` is always a `string` (falls back to `""` when the data key is unset).
 * - `onChange` calls `setData(field, e.target.value)`.
 *
 * For inputs that need a value transform (e.g. `.trim()`, `Number()`) keep
 * an explicit `onChange` handler — this helper is for the no-transform case.
 *
 * Must be called inside a `<PathShell>` or `<PathProvider>`.
 */
export function useField<TData extends PathData, K extends string & keyof TData>(
  field: K
): { value: string; onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void } {
  const { snapshot, setData } = usePathContext<TData>();
  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setData(field, e.target.value as TData[K]);
    },
    // field is a string literal at the call site and never changes; setData is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [field, setData]
  );
  return { value: String(snapshot.data[field] ?? ""), onChange };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Default UI — PathShell
// ---------------------------------------------------------------------------

export interface PathShellProps {
  /** The path definition to drive. */
  path: PathDefinition<any>;
  /**
   * An externally-managed engine — for example, the engine returned by
   * `createPersistedEngine()`. When supplied, `PathShell` will skip its own
   * `start()` call and drive the UI from the provided engine instead.
   */
  engine?: PathEngine;
  /** Map of step ID → content. The shell renders `steps[snapshot.stepId]` for the current step. */
  steps: Record<string, ReactNode>;
  /** Initial data passed to `engine.start()`. */
  initialData?: PathData;
  /** If true, the path is started automatically on mount. Defaults to `true`. */
  autoStart?: boolean;
  /** Called when the path completes. Receives the final data. */
  onComplete?: (data: PathData) => void;
  /** Called when the path is cancelled. Receives the data at time of cancellation. */
  onCancel?: (data: PathData) => void;
  /** Called for every engine event. */
  onEvent?: (event: PathEvent) => void;
  /** Label for the Previous button. Defaults to `"Previous"`. */
  backLabel?: string;
  /** Label for the Next button. Defaults to `"Next"`. */
  nextLabel?: string;
  /** Label for the Complete button (shown on the last step). Defaults to `"Complete"`. */
  completeLabel?: string;
  /** Label shown on the Next/Complete button while an async operation is in progress. Defaults to `undefined` (button shows a CSS spinner but keeps its label). */
  loadingLabel?: string;
  /** Label for the Cancel button. Defaults to `"Cancel"`. */
  cancelLabel?: string;
  /** If true, hide the Cancel button. Defaults to `false`. */
  hideCancel?: boolean;
  /** If true, hide the progress indicator. Also hidden automatically when the path has only one step. Defaults to `false`. */
  hideProgress?: boolean;
  /** If true, hide the footer (navigation buttons). Defaults to `false`. The error panel is still shown on async failure regardless of this prop. */
  hideFooter?: boolean;
  /** When true, calls `validate()` on the engine so all steps show inline errors simultaneously. Useful when this shell is nested inside a step of an outer shell: bind to the outer snapshot's `hasAttemptedNext`. */
  validateWhen?: boolean;
  /**
   * Footer layout mode:
   * - `"auto"` (default): Uses "form" for single-step top-level paths, "wizard" otherwise.
   * - `"wizard"`: Back button on left, Cancel and Submit together on right.
   * - `"form"`: Cancel on left, Submit alone on right. Back button never shown.
   */
  footerLayout?: "wizard" | "form" | "auto";
  /** Optional extra CSS class on the root element. */
  className?: string;
  /** Render prop to replace the entire header (progress area). Receives the snapshot. */
  renderHeader?: (snapshot: PathSnapshot) => ReactNode;
  /** Render prop to replace the entire footer (navigation area). Receives the snapshot and actions. */
  renderFooter?: (snapshot: PathSnapshot, actions: PathShellActions) => ReactNode;
  /**
   * Controls whether the shell renders its auto-generated field-error summary box.
   * - `"summary"` (default): Shell renders the labeled error list below the step body.
   * - `"inline"`: Suppress the summary — handle errors inside the step template instead.
   * - `"both"`: Render the shell summary AND whatever the step template renders.
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
   *
   * The same services object that was passed to your path factory function
   * should be passed here so step components can call service methods directly
   * (e.g. parameterised queries that depend on mid-step user input).
   *
   * @example
   * ```tsx
   * const svc = new LiveHiringServices();
   * const path = createHiringPath(svc);
   * <PathShell path={path} services={svc} steps={{ ... }} />
   * ```
   */
  services?: unknown;
}

export interface PathShellHandle {
  /** Restart the shell's current path with its original `initialData`, without unmounting. */
  restart: () => void;
}

export interface PathShellActions {
  next: () => void;
  previous: () => void;
  cancel: () => void;
  goToStep: (stepId: string) => void;
  goToStepChecked: (stepId: string) => void;
  setData: (key: string, value: unknown) => void;
  /** Restart the shell's current path with its current `initialData`. */
  restart: () => void;
  /** Re-run the operation that set `snapshot.error`. See `PathEngine.retry()`. */
  retry: () => void;
  /** Pause with intent to return, preserving all state. Emits `suspended`. */
  suspend: () => void;
}

/**
 * Default UI shell that renders a progress indicator, step content, and navigation
 * buttons. Pass a `steps` map to define per-step content.
 *
 * ```tsx
 * <PathShell
 *   path={myPath}
 *   initialData={{ name: "" }}
 *   onComplete={handleDone}
 *   steps={{
 *     details: <DetailsForm />,
 *     review: <ReviewPanel />,
 *   }}
 * />
 * ```
 */
export const PathShell = forwardRef<PathShellHandle, PathShellProps>(function PathShell({
  path: pathDef,
  engine: externalEngine,
  steps,
  initialData = {},
  autoStart = true,
  onComplete,
  onCancel,
  onEvent,
  backLabel = "Previous",
  nextLabel = "Next",
  completeLabel = "Complete",
  loadingLabel,
  cancelLabel = "Cancel",
  hideCancel = false,
  hideProgress = false,
  hideFooter = false,
  footerLayout = "auto",
  className,
  renderHeader,
  renderFooter,
  validationDisplay = "summary",
  progressLayout = "merged",
  services,
  validateWhen = false,
}: PathShellProps, ref): ReactElement {
  const pathReturn = usePath({
    engine: externalEngine,
    onEvent(event) {
      onEvent?.(event);
      if (event.type === "completed") onComplete?.(event.data);
      if (event.type === "cancelled") onCancel?.(event.data);
    }
  });

  const { snapshot, start, next, previous, cancel, goToStep, goToStepChecked, setData, restart, retry, suspend, validate } = pathReturn;

  useEffect(() => {
    if (validateWhen) validate();
  }, [validateWhen, validate]);

  useImperativeHandle(ref, () => ({
    restart: () => restart(),
  }));

  // Auto-start on mount — skipped when an external engine is provided since
  // the caller is responsible for starting it (e.g. via createPersistedEngine).
  const startedRef = useRef(false);
  useEffect(() => {
    if (autoStart && !startedRef.current && !externalEngine) {
      startedRef.current = true;
      start(pathDef, initialData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Look up step content from the steps map.
  // When the current slot is a StepChoice, prefer the inner step id (formId)
  // so consumers can register components by their inner step ids directly,
  // without needing a wrapper dispatcher component.
  const stepContent = snapshot
    ? ((snapshot.formId ? steps[snapshot.formId] : undefined) ?? steps[snapshot.stepId] ?? null)
    : null;

  const contextValue: PathContextValue = { path: pathReturn, services: services ?? null };

  if (!snapshot) {
    return createElement(PathContext.Provider, { value: contextValue },
      createElement("div", { className: cls("pw-shell", className) },
        createElement("div", { className: "pw-shell__empty" },
          createElement("p", null, "No active path."),
          !autoStart && createElement("button", {
            type: "button",
            className: "pw-shell__start-btn",
            onClick: () => start(pathDef, initialData)
          }, "Start")
        )
      )
    );
  }

  const actions: PathShellActions = {
    next, previous, cancel, goToStep, goToStepChecked, setData,
    restart: () => restart(),
    retry: () => retry(),
    suspend: () => suspend(),
  };

  const showRoot = !hideProgress && !!snapshot.rootProgress && progressLayout !== "activeOnly";
  const showActive = !hideProgress && (renderHeader
    ? true
    : (snapshot.stepCount > 1 || snapshot.nestingLevel > 0) && progressLayout !== "rootOnly");

  return createElement(PathContext.Provider, { value: contextValue },
    createElement("div", { className: cls("pw-shell", progressLayout !== "merged" && `pw-shell--progress-${progressLayout}`, className) },
      // Root progress — persistent top-level bar visible during sub-paths
      showRoot && defaultRootProgress(snapshot.rootProgress!),
      // Header — progress indicator (active path)
      showActive && (renderHeader
        ? renderHeader(snapshot)
        : (snapshot.stepCount > 1 || snapshot.nestingLevel > 0) && defaultHeader(snapshot)),
      // Body — step content
      createElement("div", { className: "pw-shell__body" }, stepContent),
      // Validation messages — suppressed when validationDisplay="inline"
      validationDisplay !== "inline" && (snapshot.hasAttemptedNext || snapshot.hasValidated) && Object.keys(snapshot.fieldErrors).length > 0 && createElement("ul", { className: "pw-shell__validation" },
        ...Object.entries(snapshot.fieldErrors).map(([key, msg]) =>
          createElement("li", { key, className: "pw-shell__validation-item" },
            key !== "_" && createElement("span", { className: "pw-shell__validation-label" }, formatFieldKey(key)),
            msg
          )
        )
      ),
      // Warning messages — non-blocking, shown immediately (no hasAttemptedNext gate)
      validationDisplay !== "inline" && Object.keys(snapshot.fieldWarnings).length > 0 && createElement("ul", { className: "pw-shell__warnings" },
        ...Object.entries(snapshot.fieldWarnings).map(([key, msg]) =>
          createElement("li", { key, className: "pw-shell__warnings-item" },
            key !== "_" && createElement("span", { className: "pw-shell__warnings-label" }, formatFieldKey(key)),
            msg
          )
        )
      ),
      // Blocking error — guard returned { allowed: false, reason }
      validationDisplay !== "inline" && (snapshot.hasAttemptedNext || snapshot.hasValidated) && snapshot.blockingError &&
        createElement("p", { className: "pw-shell__blocking-error" }, snapshot.blockingError),
      // Error panel — replaces footer when an async operation has failed
      snapshot.status === "error" && snapshot.error
        ? defaultErrorPanel(snapshot, actions)
        // Footer — navigation buttons
        : !hideFooter
          ? renderFooter
            ? renderFooter(snapshot, actions)
            : defaultFooter(snapshot, actions, {
                backLabel, nextLabel, completeLabel, loadingLabel, cancelLabel, hideCancel, footerLayout
              })
          : null
    )
  );
});

// ---------------------------------------------------------------------------
// Root progress (compact top-level bar visible during sub-paths)
// ---------------------------------------------------------------------------

function defaultRootProgress(root: RootProgress): ReactElement {
  return createElement("div", { className: "pw-shell__root-progress" },
    createElement("div", { className: "pw-shell__steps" },
      ...root.steps.map((step, i) =>
        createElement("div", {
          key: step.id,
          className: cls("pw-shell__step", `pw-shell__step--${step.status}`)
        },
          createElement("span", { className: "pw-shell__step-dot" },
            step.status === "completed" ? "✓" : String(i + 1)
          ),
          createElement("span", { className: "pw-shell__step-label" },
            step.title ?? step.id
          )
        )
      )
    ),
    createElement("div", { className: "pw-shell__track" },
      createElement("div", {
        className: "pw-shell__track-fill",
        style: { width: `${root.progress * 100}%` }
      })
    )
  );
}

// ---------------------------------------------------------------------------
// Default header (progress indicator)
// ---------------------------------------------------------------------------

function defaultHeader(snapshot: PathSnapshot): ReactElement {
  return createElement("div", { className: "pw-shell__header" },
    createElement("div", { className: "pw-shell__steps" },
      ...snapshot.steps.map((step, i) =>
        createElement("div", {
          key: step.id,
          className: cls("pw-shell__step", `pw-shell__step--${step.status}`)
        },
          createElement("span", { className: "pw-shell__step-dot" },
            step.status === "completed" ? "✓" : String(i + 1)
          ),
          createElement("span", { className: "pw-shell__step-label" },
            step.title ?? step.id
          )
        )
      )
    ),
    createElement("div", { className: "pw-shell__track" },
      createElement("div", {
        className: "pw-shell__track-fill",
        style: { width: `${snapshot.progress * 100}%` }
      })
    )
  );
}

// ---------------------------------------------------------------------------
// Default error panel
// ---------------------------------------------------------------------------


function defaultErrorPanel(
  snapshot: PathSnapshot,
  actions: PathShellActions
): ReactElement {
  const { error, hasPersistence } = snapshot;
  if (!error) return createElement("div", null);
  const escalated = error.retryCount >= 2;
  const title = escalated ? "Still having trouble." : "Something went wrong.";
  const phaseMsg = errorPhaseMessage(error.phase);

  return createElement("div", { className: "pw-shell__error" },
    createElement("div", { className: "pw-shell__error-title" }, title),
    createElement("div", { className: "pw-shell__error-message" },
      phaseMsg,
      error.message && ` ${error.message}`
    ),
    createElement("div", { className: "pw-shell__error-actions" },
      !escalated && createElement("button", {
        type: "button",
        className: "pw-shell__btn pw-shell__btn--retry",
        onClick: actions.retry
      }, "Try again"),
      hasPersistence && createElement("button", {
        type: "button",
        className: cls("pw-shell__btn", escalated ? "pw-shell__btn--retry" : "pw-shell__btn--suspend"),
        onClick: actions.suspend
      }, "Save and come back later"),
      escalated && !hasPersistence && createElement("button", {
        type: "button",
        className: "pw-shell__btn pw-shell__btn--retry",
        onClick: actions.retry
      }, "Try again")
    )
  );
}

// ---------------------------------------------------------------------------
// Default footer (navigation buttons)
// ---------------------------------------------------------------------------

interface FooterLabels {
  backLabel: string;
  nextLabel: string;
  completeLabel: string;
  loadingLabel?: string;
  cancelLabel: string;
  hideCancel: boolean;
  footerLayout: "wizard" | "form" | "auto";
}

function defaultFooter(
  snapshot: PathSnapshot,
  actions: PathShellActions,
  labels: FooterLabels
): ReactElement {
  // Auto-detect layout: single-step top-level paths use "form", everything else uses "wizard"
  const resolvedLayout = labels.footerLayout === "auto"
    ? (snapshot.stepCount === 1 && snapshot.nestingLevel === 0 ? "form" : "wizard")
    : labels.footerLayout;
  
  const isFormMode = resolvedLayout === "form";
  
  return createElement("div", { className: "pw-shell__footer" },
    createElement("div", { className: "pw-shell__footer-left" },
      // Form mode: Cancel on the left
      isFormMode && !labels.hideCancel && createElement("button", {
        type: "button",
        className: "pw-shell__btn pw-shell__btn--cancel",
        disabled: snapshot.status !== "idle",
        onClick: actions.cancel
      }, labels.cancelLabel),
      // Wizard mode: Back on the left
      !isFormMode && !snapshot.isFirstStep && createElement("button", {
        type: "button",
        className: "pw-shell__btn pw-shell__btn--back",
        disabled: snapshot.status !== "idle" || !snapshot.canMovePrevious,
        onClick: actions.previous
      }, labels.backLabel)
    ),
    createElement("div", { className: "pw-shell__footer-right" },
      // Wizard mode: Cancel on the right
      !isFormMode && !labels.hideCancel && createElement("button", {
        type: "button",
        className: "pw-shell__btn pw-shell__btn--cancel",
        disabled: snapshot.status !== "idle",
        onClick: actions.cancel
      }, labels.cancelLabel),
      // Both modes: Submit on the right
      createElement("button", {
        type: "button",
        className: cls("pw-shell__btn pw-shell__btn--next", snapshot.status !== "idle" && "pw-shell__btn--loading"),
        disabled: snapshot.status !== "idle",
        onClick: actions.next
      }, snapshot.status !== "idle" && labels.loadingLabel
          ? labels.loadingLabel
          : snapshot.isLastStep ? labels.completeLabel : labels.nextLabel)
    )
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cls(...parts: (string | undefined | false | null)[]): string {
  return parts.filter(Boolean).join(" ");
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
  StepChoice,
} from "@daltonr/pathwrite-core";

export { PathEngine } from "@daltonr/pathwrite-core";

