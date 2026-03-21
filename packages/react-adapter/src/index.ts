import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore
} from "react";
import type { PropsWithChildren, ReactElement, ReactNode } from "react";
import {
  PathData,
  PathDefinition,
  PathEngine,
  PathEvent,
  PathSnapshot
} from "@daltonr/pathwrite-core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UsePathOptions {
  /**
   * An externally-managed `PathEngine` to subscribe to — for example, the engine
   * obtained from `PathEngineWithStore.getEngine()` after calling `startOrRestore()`.
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
  /**
   * Tear down any active path (without firing hooks) and immediately start the
   * given path fresh. Safe to call whether or not a path is currently active.
   * Use for "Start over" / retry flows without remounting the component.
   */
  restart: (path: PathDefinition<any>, initialData?: PathData) => void;
}

export type PathProviderProps = PropsWithChildren<{
  /** Forwarded to the internal usePath hook. */
  onEvent?: (event: PathEvent) => void;
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

  const restart = useCallback(
    (path: PathDefinition<any>, initialData: PathData = {}) =>
      engine.restart(path, initialData),
    [engine]
  );

  return { snapshot, start, startSubPath, next, previous, cancel, goToStep, goToStepChecked, setData, restart };
}

// ---------------------------------------------------------------------------
// Context + Provider
// ---------------------------------------------------------------------------

const PathContext = createContext<UsePathReturn | null>(null);

/**
 * Provides a single `usePath` instance to all descendants.
 * Consume with `usePathContext()`.
 */
export function PathProvider({ children, onEvent }: PathProviderProps): ReactElement {
  const path = usePath({ onEvent });
  return createElement(PathContext.Provider, { value: path }, children);
}

/**
 * Access the nearest `PathProvider`'s path instance.
 * Throws if used outside of a `<PathProvider>`.
 *
 * The optional generic narrows `snapshot.data` for convenience — it is a
 * **type-level assertion**, not a runtime guarantee.
 */
export function usePathContext<TData extends PathData = PathData>(): UsePathReturn<TData> {
  const ctx = useContext(PathContext);
  if (ctx === null) {
    throw new Error("usePathContext must be used within a <PathProvider>.");
  }
  return ctx as UsePathReturn<TData>;
}

// ---------------------------------------------------------------------------
// Default UI — PathShell
// ---------------------------------------------------------------------------

export interface PathShellProps {
  /** The path definition to drive. */
  path: PathDefinition<any>;
  /**
   * An externally-managed engine (e.g. from `PathEngineWithStore.getEngine()`).
   * When supplied, `PathShell` will skip its own `start()` call and drive the
   * UI from the provided engine instead of creating a new one.
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
  /** Label for the Back button. Defaults to `"Back"`. */
  backLabel?: string;
  /** Label for the Next button. Defaults to `"Next"`. */
  nextLabel?: string;
  /** Label for the Finish button (shown on the last step). Defaults to `"Finish"`. */
  finishLabel?: string;
  /** Label for the Cancel button. Defaults to `"Cancel"`. */
  cancelLabel?: string;
  /** If true, hide the Cancel button. Defaults to `false`. */
  hideCancel?: boolean;
  /** If true, hide the progress indicator. Defaults to `false`. */
  hideProgress?: boolean;
  /** Optional extra CSS class on the root element. */
  className?: string;
  /** Render prop to replace the entire header (progress area). Receives the snapshot. */
  renderHeader?: (snapshot: PathSnapshot) => ReactNode;
  /** Render prop to replace the entire footer (navigation area). Receives the snapshot and actions. */
  renderFooter?: (snapshot: PathSnapshot, actions: PathShellActions) => ReactNode;
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
export function PathShell({
  path: pathDef,
  engine: externalEngine,
  steps,
  initialData = {},
  autoStart = true,
  onComplete,
  onCancel,
  onEvent,
  backLabel = "Back",
  nextLabel = "Next",
  finishLabel = "Finish",
  cancelLabel = "Cancel",
  hideCancel = false,
  hideProgress = false,
  className,
  renderHeader,
  renderFooter,
}: PathShellProps): ReactElement {
  const pathReturn = usePath({
    engine: externalEngine,
    onEvent(event) {
      onEvent?.(event);
      if (event.type === "completed") onComplete?.(event.data);
      if (event.type === "cancelled") onCancel?.(event.data);
    }
  });

  const { snapshot, start, next, previous, cancel, goToStep, goToStepChecked, setData, restart } = pathReturn;

  // Auto-start on mount — skipped when an external engine is provided since
  // the caller is responsible for starting it (e.g. PathEngineWithStore.startOrRestore).
  const startedRef = useRef(false);
  useEffect(() => {
    if (autoStart && !startedRef.current && !externalEngine) {
      startedRef.current = true;
      start(pathDef, initialData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Look up step content from the steps map
  const stepContent = snapshot ? (steps[snapshot.stepId] ?? null) : null;

  if (!snapshot) {
    return createElement(PathContext.Provider, { value: pathReturn },
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
    restart: () => restart(pathDef, initialData)
  };

  return createElement(PathContext.Provider, { value: pathReturn },
    createElement("div", { className: cls("pw-shell", className) },
      // Header — progress indicator
      !hideProgress && (renderHeader
        ? renderHeader(snapshot)
        : defaultHeader(snapshot)),
      // Body — step content
      createElement("div", { className: "pw-shell__body" }, stepContent),
      // Validation messages
      snapshot.validationMessages.length > 0 && createElement("ul", { className: "pw-shell__validation" },
        ...snapshot.validationMessages.map((msg, i) =>
          createElement("li", { key: i, className: "pw-shell__validation-item" }, msg)
        )
      ),
      // Footer — navigation buttons
      renderFooter
        ? renderFooter(snapshot, actions)
        : defaultFooter(snapshot, actions, {
            backLabel, nextLabel, finishLabel, cancelLabel, hideCancel
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
// Default footer (navigation buttons)
// ---------------------------------------------------------------------------

interface FooterLabels {
  backLabel: string;
  nextLabel: string;
  finishLabel: string;
  cancelLabel: string;
  hideCancel: boolean;
}

function defaultFooter(
  snapshot: PathSnapshot,
  actions: PathShellActions,
  labels: FooterLabels
): ReactElement {
  return createElement("div", { className: "pw-shell__footer" },
    createElement("div", { className: "pw-shell__footer-left" },
      !snapshot.isFirstStep && createElement("button", {
        type: "button",
        className: "pw-shell__btn pw-shell__btn--back",
        disabled: snapshot.isNavigating || !snapshot.canMovePrevious,
        onClick: actions.previous
      }, labels.backLabel)
    ),
    createElement("div", { className: "pw-shell__footer-right" },
      !labels.hideCancel && createElement("button", {
        type: "button",
        className: "pw-shell__btn pw-shell__btn--cancel",
        disabled: snapshot.isNavigating,
        onClick: actions.cancel
      }, labels.cancelLabel),
      createElement("button", {
        type: "button",
        className: "pw-shell__btn pw-shell__btn--next",
        disabled: snapshot.isNavigating || !snapshot.canMoveNext,
        onClick: actions.next
      }, snapshot.isLastStep ? labels.finishLabel : labels.nextLabel)
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
  PathDefinition,
  PathEvent,
  PathSnapshot,
  PathStep,
  PathStepContext,
  SerializedPathState
} from "@daltonr/pathwrite-core";

export { PathEngine } from "@daltonr/pathwrite-core";

