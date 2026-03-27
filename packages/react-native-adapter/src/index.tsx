import {
  createContext,
  createElement,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useSyncExternalStore,
} from "react";
import type { PropsWithChildren, ReactElement, ReactNode } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import type { StyleProp, ViewStyle, TextStyle } from "react-native";
import {
  PathData,
  PathDefinition,
  PathEngine,
  PathEvent,
  PathSnapshot,
  ProgressLayout,
} from "@daltonr/pathwrite-core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UsePathOptions {
  /**
   * An externally-managed `PathEngine` to subscribe to — for example, one
   * returned by `restoreOrStart()` from `@daltonr/pathwrite-store-http`.
   *
   * When provided:
   * - `usePath` will **not** create its own engine.
   * - The snapshot is seeded immediately from the engine's current state.
   * - The engine lifecycle (start / cleanup) is the **caller's responsibility**.
   */
  engine?: PathEngine;
  /** Called for every engine event. The callback ref is kept current — changing it does not re-subscribe. */
  onEvent?: (event: PathEvent) => void;
}

export interface UsePathReturn<TData extends PathData = PathData> {
  /** Current path snapshot, or `null` when no path is active. Triggers a re-render on change. */
  snapshot: PathSnapshot<TData> | null;
  /** Start (or restart) a path. */
  start: (path: PathDefinition<any>, initialData?: PathData) => void;
  /** Push a sub-path onto the stack. */
  startSubPath: (path: PathDefinition<any>, initialData?: PathData, meta?: Record<string, unknown>) => void;
  /** Advance one step. Completes the path on the last step. */
  next: () => void;
  /** Go back one step. */
  previous: () => void;
  /** Cancel the active path (or sub-path). */
  cancel: () => void;
  /** Jump directly to a step by ID, bypassing guards and shouldSkip. */
  goToStep: (stepId: string) => void;
  /** Jump directly to a step by ID, checking the current step's guard first. */
  goToStepChecked: (stepId: string) => void;
  /** Update a single data value. When `TData` is specified, key and value are type-checked. */
  setData: <K extends string & keyof TData>(key: K, value: TData[K]) => void;
  /** Reset the current step's data to what it was when the step was entered. */
  resetStep: () => void;
  /** Tear down any active path and immediately start the given path fresh. */
  restart: (path: PathDefinition<any>, initialData?: PathData) => void;
}

export type PathProviderProps = PropsWithChildren<{
  onEvent?: (event: PathEvent) => void;
}>;

// ---------------------------------------------------------------------------
// usePath hook
// ---------------------------------------------------------------------------

export function usePath<TData extends PathData = PathData>(options?: UsePathOptions): UsePathReturn<TData> {
  const engineRef = useRef<PathEngine | null>(null);
  if (engineRef.current === null) {
    engineRef.current = options?.engine ?? new PathEngine();
  }
  const engine = engineRef.current;

  const onEventRef = useRef(options?.onEvent);
  onEventRef.current = options?.onEvent;

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

  const start = useCallback(
    (path: PathDefinition<any>, initialData: PathData = {}) => engine.start(path, initialData),
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
  const goToStep = useCallback((stepId: string) => engine.goToStep(stepId), [engine]);
  const goToStepChecked = useCallback((stepId: string) => engine.goToStepChecked(stepId), [engine]);
  const setData = useCallback(
    <K extends string & keyof TData>(key: K, value: TData[K]) => engine.setData(key, value as unknown),
    [engine]
  ) as UsePathReturn<TData>["setData"];
  const resetStep = useCallback(() => engine.resetStep(), [engine]);
  const restart = useCallback(
    (path: PathDefinition<any>, initialData: PathData = {}) => engine.restart(path, initialData),
    [engine]
  );

  return { snapshot, start, startSubPath, next, previous, cancel, goToStep, goToStepChecked, setData, resetStep, restart };
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
export function usePathContext<TData extends PathData = PathData>(): Omit<UsePathReturn<TData>, "snapshot"> & { snapshot: PathSnapshot<TData> } {
  const ctx = useContext(PathContext);
  if (ctx === null) {
    throw new Error("usePathContext must be used within a <PathProvider>.");
  }
  return ctx as Omit<UsePathReturn<TData>, "snapshot"> & { snapshot: PathSnapshot<TData> };
}

// ---------------------------------------------------------------------------
// PathShell — React Native UI
// ---------------------------------------------------------------------------

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
  restart: () => void;
}

export interface PathShellProps {
  /** The path definition to drive. */
  path: PathDefinition<any>;
  /** An externally-managed engine. When supplied, PathShell skips its own start() call. */
  engine?: PathEngine;
  /** Map of step ID → React Native content. The shell renders `steps[snapshot.stepId]` for the current step. */
  steps: Record<string, ReactNode>;
  /** Initial data passed to engine.start(). */
  initialData?: PathData;
  /** If true, the path is started automatically on mount. Defaults to true. */
  autoStart?: boolean;
  /** Called when the path completes. */
  onComplete?: (data: PathData) => void;
  /** Called when the path is cancelled. */
  onCancel?: (data: PathData) => void;
  /** Called for every engine event. */
  onEvent?: (event: PathEvent) => void;
  /** Label for the Previous button. Defaults to "Previous". */
  backLabel?: string;
  /** Label for the Next button. Defaults to "Next". */
  nextLabel?: string;
  /** Label for the Complete button (last step). Defaults to "Complete". */
  completeLabel?: string;
  /** Label for the Cancel button. Defaults to "Cancel". */
  cancelLabel?: string;
  /** If true, hide the Cancel button. */
  hideCancel?: boolean;
  /** If true, hide the progress dots. Also hidden automatically when the path has only one step. */
  hideProgress?: boolean;
  /**
   * Footer layout mode:
   * - `"auto"` (default): "form" for single-step top-level paths, "wizard" otherwise.
   * - `"wizard"`: Back on left, Cancel and Next on right.
   * - `"form"`: Cancel on left, Next alone on right.
   */
  footerLayout?: "wizard" | "form" | "auto";
  /** Render prop to replace the header (progress area). */
  renderHeader?: (snapshot: PathSnapshot) => ReactNode;
  /** Render prop to replace the footer (navigation area). */
  renderFooter?: (snapshot: PathSnapshot, actions: PathShellActions) => ReactNode;
  /** Style override for the root container. */
  style?: StyleProp<ViewStyle>;
  /**
   * Passed to the internal `KeyboardAvoidingView`. Use this to account for
   * any header or navigation bar above the shell (e.g. a React Navigation header).
   * Defaults to `0`.
   */
  keyboardVerticalOffset?: number;
}

/**
 * Default UI shell for React Native. Renders a progress dot indicator,
 * step content, and navigation buttons.
 *
 * ```tsx
 * <PathShell
 *   path={myPath}
 *   initialData={{ name: "" }}
 *   onComplete={handleDone}
 *   steps={{
 *     details: <DetailsStep />,
 *     review:  <ReviewStep />,
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
  cancelLabel = "Cancel",
  hideCancel = false,
  hideProgress = false,
  footerLayout = "auto",
  renderHeader,
  renderFooter,
  style,
  keyboardVerticalOffset = 0,
}: PathShellProps, ref): ReactElement {
  const pathReturn = usePath({
    engine: externalEngine,
    onEvent(event) {
      onEvent?.(event);
      if (event.type === "completed") onComplete?.(event.data);
      if (event.type === "cancelled") onCancel?.(event.data);
    },
  });

  const { snapshot, start, next, previous, cancel, goToStep, goToStepChecked, setData, restart } = pathReturn;

  useImperativeHandle(ref, () => ({
    restart: () => restart(pathDef, initialData),
  }));

  const startedRef = useRef(false);
  useEffect(() => {
    if (autoStart && !startedRef.current && !externalEngine) {
      startedRef.current = true;
      start(pathDef, initialData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Look up step content — prefer formId (StepChoice inner step) over stepId
  const stepContent = snapshot
    ? ((snapshot.formId ? steps[snapshot.formId] : undefined) ?? steps[snapshot.stepId] ?? null)
    : null;

  const actions: PathShellActions = {
    next, previous, cancel, goToStep, goToStepChecked, setData,
    restart: () => restart(pathDef, initialData),
  };

  if (!snapshot) {
    return (
      <PathContext.Provider value={pathReturn}>
        <View style={[styles.shell, style]}>
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No active path.</Text>
            {!autoStart && (
              <Pressable style={styles.btnPrimary} onPress={() => start(pathDef, initialData)}>
                <Text style={styles.btnPrimaryText}>Start</Text>
              </Pressable>
            )}
          </View>
        </View>
      </PathContext.Provider>
    );
  }

  const resolvedLayout =
    footerLayout === "auto"
      ? snapshot.stepCount === 1 && snapshot.nestingLevel === 0
        ? "form"
        : "wizard"
      : footerLayout;
  const isFormMode = resolvedLayout === "form";
  const showProgress =
    !hideProgress && (snapshot.stepCount > 1 || snapshot.nestingLevel > 0);

  return (
    <PathContext.Provider value={pathReturn}>
      <KeyboardAvoidingView
        style={[styles.shell, style]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        {/* Header — progress dots or custom */}
        {showProgress && (
          renderHeader
            ? renderHeader(snapshot)
            : (
              <View style={styles.header}>
                <View style={styles.stepper}>
                  {snapshot.steps.map((step) => (
                    <View
                      key={step.id}
                      style={[
                        styles.dot,
                        step.status === "completed" && styles.dotCompleted,
                        step.status === "current" && styles.dotCurrent,
                      ]}
                    />
                  ))}
                </View>
                <View style={styles.track}>
                  <View style={[styles.trackFill, { width: `${snapshot.progress * 100}%` as any }]} />
                </View>
              </View>
            )
        )}

        {/* Body — step content */}
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {stepContent}
        </ScrollView>

        {/* Validation messages */}
        {snapshot.hasAttemptedNext && Object.keys(snapshot.fieldErrors).length > 0 && (
          <View style={styles.validation}>
            {Object.entries(snapshot.fieldErrors).map(([key, msg]) => (
              <Text key={key} style={styles.validationItem}>
                {key !== "_" && <Text style={styles.validationLabel}>{formatFieldKey(key)}: </Text>}
                {msg}
              </Text>
            ))}
          </View>
        )}

        {/* Warning messages */}
        {Object.keys(snapshot.fieldWarnings).length > 0 && (
          <View style={styles.warnings}>
            {Object.entries(snapshot.fieldWarnings).map(([key, msg]) => (
              <Text key={key} style={styles.warningItem}>
                {key !== "_" && <Text style={styles.warningLabel}>{formatFieldKey(key)}: </Text>}
                {msg}
              </Text>
            ))}
          </View>
        )}

        {/* Footer — navigation or custom */}
        {renderFooter
          ? renderFooter(snapshot, actions)
          : (
            <View style={styles.footer}>
              <View style={styles.footerLeft}>
                {isFormMode && !hideCancel && (
                  <Pressable
                    style={[styles.btn, styles.btnCancel, snapshot.isNavigating && styles.btnDisabled]}
                    onPress={cancel}
                    disabled={snapshot.isNavigating}
                  >
                    <Text style={styles.btnCancelText}>{cancelLabel}</Text>
                  </Pressable>
                )}
                {!isFormMode && !snapshot.isFirstStep && (
                  <Pressable
                    style={[styles.btn, styles.btnBack, (snapshot.isNavigating || !snapshot.canMovePrevious) && styles.btnDisabled]}
                    onPress={previous}
                    disabled={snapshot.isNavigating || !snapshot.canMovePrevious}
                  >
                    <Text style={styles.btnBackText}>← {backLabel}</Text>
                  </Pressable>
                )}
              </View>
              <View style={styles.footerRight}>
                {!isFormMode && !hideCancel && (
                  <Pressable
                    style={[styles.btn, styles.btnCancel, snapshot.isNavigating && styles.btnDisabled]}
                    onPress={cancel}
                    disabled={snapshot.isNavigating}
                  >
                    <Text style={styles.btnCancelText}>{cancelLabel}</Text>
                  </Pressable>
                )}
                <Pressable
                  style={[styles.btn, styles.btnPrimary, snapshot.isNavigating && styles.btnDisabled]}
                  onPress={next}
                  disabled={snapshot.isNavigating || !snapshot.canMoveNext}
                >
                  {snapshot.isNavigating
                    ? <ActivityIndicator size="small" color="#ffffff" />
                    : <Text style={styles.btnPrimaryText}>{snapshot.isLastStep ? completeLabel : `${nextLabel} →`}</Text>
                  }
                </Pressable>
              </View>
            </View>
          )
        }
      </KeyboardAvoidingView>
    </PathContext.Provider>
  );
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFieldKey(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim();
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    overflow: "hidden",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    color: "#6b7280",
    marginBottom: 16,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  stepper: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#e5e7eb",
  },
  dotCompleted: {
    backgroundColor: "#10b981",
  },
  dotCurrent: {
    backgroundColor: "#6366f1",
  },
  track: {
    height: 4,
    backgroundColor: "#e5e7eb",
    borderRadius: 2,
    overflow: "hidden",
  },
  trackFill: {
    height: 4,
    backgroundColor: "#6366f1",
    borderRadius: 2,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 20,
  },
  validation: {
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 12,
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#ef4444",
  },
  validationItem: {
    fontSize: 13,
    color: "#991b1b",
    marginBottom: 2,
  },
  validationLabel: {
    fontWeight: "600",
  },
  warnings: {
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 12,
    backgroundColor: "#fffbeb",
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#f59e0b",
  },
  warningItem: {
    fontSize: 13,
    color: "#92400e",
    marginBottom: 2,
  },
  warningLabel: {
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    gap: 8,
  },
  footerLeft: {
    flexDirection: "row",
    gap: 8,
  },
  footerRight: {
    flexDirection: "row",
    gap: 8,
    marginLeft: "auto",
  },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 80,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnPrimary: {
    backgroundColor: "#6366f1",
  },
  btnPrimaryText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 15,
  },
  btnBack: {
    backgroundColor: "#f3f4f6",
  },
  btnBackText: {
    color: "#374151",
    fontWeight: "500",
    fontSize: 15,
  },
  btnCancel: {
    backgroundColor: "transparent",
  },
  btnCancelText: {
    color: "#6b7280",
    fontWeight: "500",
    fontSize: 15,
  },
});

// ---------------------------------------------------------------------------
// Re-export core types
// ---------------------------------------------------------------------------

export type {
  PathData,
  FieldErrors,
  PathDefinition,
  PathEngine,
  PathEvent,
  PathSnapshot,
  PathStep,
  PathStepContext,
  ProgressLayout,
  RootProgress,
  SerializedPathState,
  StepChoice,
} from "@daltonr/pathwrite-core";
