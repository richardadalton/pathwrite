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
  /** Called for every engine event (stateChanged, completed, cancelled, resumed). */
  onEvent?: (event: PathEvent) => void;
}

export interface UsePathReturn {
  /** Current path snapshot, or `null` when no path is active. Triggers a React re-render on change. */
  snapshot: PathSnapshot | null;
  /** Start (or restart) a path. */
  start: (path: PathDefinition, initialData?: PathData) => void;
  /** Push a sub-path onto the stack. Requires an active path. */
  startSubPath: (path: PathDefinition, initialData?: PathData) => void;
  /** Advance one step. Completes the path on the last step. */
  next: () => void;
  /** Go back one step. Cancels the path from the first step. */
  previous: () => void;
  /** Cancel the active path (or sub-path). */
  cancel: () => void;
  /** Jump directly to a step by ID. Calls onLeave / onEnter but bypasses guards and shouldSkip. */
  goToStep: (stepId: string) => void;
  /** Update a single data value; triggers a re-render via stateChanged. */
  setData: (key: string, value: unknown) => void;
}

export type PathProviderProps = PropsWithChildren<{
  /** Forwarded to the internal usePath hook. */
  onEvent?: (event: PathEvent) => void;
}>;

// ---------------------------------------------------------------------------
// usePath hook
// ---------------------------------------------------------------------------

export function usePath(options?: UsePathOptions): UsePathReturn {
  // Stable engine instance for the lifetime of the hook
  const engineRef = useRef<PathEngine | null>(null);
  if (engineRef.current === null) {
    engineRef.current = new PathEngine();
  }
  const engine = engineRef.current;

  // Keep the onEvent callback current without changing the subscribe identity
  const onEventRef = useRef(options?.onEvent);
  onEventRef.current = options?.onEvent;

  // Cached snapshot — updated only inside the subscribe callback
  const snapshotRef = useRef<PathSnapshot | null>(null);

  const subscribe = useCallback(
    (callback: () => void) =>
      engine.subscribe((event: PathEvent) => {
        if (event.type === "stateChanged" || event.type === "resumed") {
          snapshotRef.current = event.snapshot;
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
    (path: PathDefinition, initialData: PathData = {}) =>
      engine.start(path, initialData),
    [engine]
  );

  const startSubPath = useCallback(
    (path: PathDefinition, initialData: PathData = {}) =>
      engine.startSubPath(path, initialData),
    [engine]
  );

  const next = useCallback(() => engine.next(), [engine]);
  const previous = useCallback(() => engine.previous(), [engine]);
  const cancel = useCallback(() => engine.cancel(), [engine]);

  const goToStep = useCallback(
    (stepId: string) => engine.goToStep(stepId),
    [engine]
  );

  const setData = useCallback(
    (key: string, value: unknown) => engine.setData(key, value),
    [engine]
  );

  return { snapshot, start, startSubPath, next, previous, cancel, goToStep, setData };
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
 */
export function usePathContext(): UsePathReturn {
  const ctx = useContext(PathContext);
  if (ctx === null) {
    throw new Error("usePathContext must be used within a <PathProvider>.");
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Default UI — PathShell + PathStep
// ---------------------------------------------------------------------------

export interface PathStepProps {
  /** Must match a step `id` in the path definition. */
  id: string;
  children: ReactNode;
}

/**
 * Wraps step content. Only renders its children when the current step matches `id`.
 * Must be used inside a `<PathShell>`.
 */
export function PathStep(_props: PathStepProps): ReactElement | null {
  // Rendering is handled by PathShell — PathStep is never rendered directly.
  // It exists purely as a typed container so PathShell can inspect its props.
  return null;
}

export interface PathShellProps {
  /** The path definition to drive. */
  path: PathDefinition;
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
  /** `<PathStep>` children. */
  children: ReactNode;
}

export interface PathShellActions {
  next: () => void;
  previous: () => void;
  cancel: () => void;
  goToStep: (stepId: string) => void;
  setData: (key: string, value: unknown) => void;
}

/**
 * Default UI shell that renders a progress indicator, step content, and navigation
 * buttons. Wrap `<PathStep>` children inside to define per-step content.
 *
 * ```tsx
 * <PathShell path={myPath} initialData={{ name: "" }} onComplete={handleDone}>
 *   <PathStep id="details"><DetailsForm /></PathStep>
 *   <PathStep id="review"><ReviewPanel /></PathStep>
 * </PathShell>
 * ```
 */
export function PathShell({
  path: pathDef,
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
  children
}: PathShellProps): ReactElement {
  const pathReturn = usePath({
    onEvent(event) {
      onEvent?.(event);
      if (event.type === "completed") onComplete?.(event.data);
      if (event.type === "cancelled") onCancel?.(event.data);
    }
  });

  const { snapshot, start, next, previous, cancel, goToStep, setData } = pathReturn;

  // Auto-start on mount
  const startedRef = useRef(false);
  useEffect(() => {
    if (autoStart && !startedRef.current) {
      startedRef.current = true;
      start(pathDef, initialData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolve which <PathStep> children to display
  const stepContent = resolveStepContent(children, snapshot);

  if (!snapshot) {
    return createElement("div", { className: cls("pw-shell", className) },
      createElement("div", { className: "pw-shell__empty" },
        createElement("p", null, "No active path."),
        !autoStart && createElement("button", {
          type: "button",
          className: "pw-shell__start-btn",
          onClick: () => start(pathDef, initialData)
        }, "Start")
      )
    );
  }

  const actions: PathShellActions = { next, previous, cancel, goToStep, setData };

  return createElement("div", { className: cls("pw-shell", className) },
    // Header — progress indicator
    !hideProgress && (renderHeader
      ? renderHeader(snapshot)
      : defaultHeader(snapshot)),
    // Body — step content
    createElement("div", { className: "pw-shell__body" }, stepContent),
    // Footer — navigation buttons
    renderFooter
      ? renderFooter(snapshot, actions)
      : defaultFooter(snapshot, actions, {
          backLabel, nextLabel, finishLabel, cancelLabel, hideCancel
        })
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

function resolveStepContent(children: ReactNode, snapshot: PathSnapshot | null): ReactNode {
  if (!snapshot || !children) return null;

  const arr = Array.isArray(children) ? children : [children];
  for (const child of arr) {
    if (
      child &&
      typeof child === "object" &&
      "type" in child &&
      child.type === PathStep &&
      child.props?.id === snapshot.stepId
    ) {
      return child.props.children ?? null;
    }
  }
  return null;
}

function cls(...parts: (string | undefined | false | null)[]): string {
  return parts.filter(Boolean).join(" ");
}
