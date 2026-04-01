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
  formatFieldKey,
  errorPhaseMessage,
} from "@daltonr/pathwrite-core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UsePathOptions {
  /**
   * An externally-managed `PathEngine` to subscribe to — for example, one
   * returned by `restoreOrStart()` from `@daltonr/pathwrite-store`.
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
  restart: () => void;
  /** Re-runs the operation that set `snapshot.error`. Increments `retryCount` on repeated failure. No-op when there is no pending error. */
  retry: () => void;
  /** Pauses the path with intent to return. Emits `suspended`. All state is preserved. */
  suspend: () => void;
  /** Trigger inline validation on all steps without navigating. Sets `snapshot.hasValidated`. */
  validate: () => void;
}

export type PathProviderProps = PropsWithChildren<{
  onEvent?: (event: PathEvent) => void;
  /**
   * Services object passed through context to all step components.
   * Step components access it via `usePathContext<TData, TServices>()`.
   */
  services?: unknown;
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
          snapshotRef.current = engine.snapshot() as PathSnapshot<TData> | null;
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
 * `TData` narrows `snapshot.data`; `TServices` types the `services` value.
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
  retry: () => void;
  suspend: () => void;
}

export interface PathShellProps {
  /** The path definition to drive. */
  path: PathDefinition<any>;
  /** An externally-managed engine. When supplied, PathShell skips its own start() call. */
  engine?: PathEngine;
  /** Map of step ID → React Native content. The shell renders `steps[snapshot.stepId]` for the current step. */
  steps: Record<string, ReactNode>;
  /** Initial data passed to `engine.start()`. Used on first visit. Overridden by a stored snapshot when `restoreKey` is set. */
  initialData?: PathData;
  /**
   * When set, this shell automatically saves its state into the nearest outer `PathShell`'s
   * data under this key on every change, and restores from that stored state on remount.
   * No-op when used on a top-level shell with no outer `PathShell` ancestor.
   */
  restoreKey?: string;
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
  /** Label shown on the Next/Complete button while an async operation is in progress. When undefined, an ActivityIndicator spinner is shown instead. */
  loadingLabel?: string;
  /** Label for the Cancel button. Defaults to "Cancel". */
  cancelLabel?: string;
  /** If true, hide the Cancel button. */
  hideCancel?: boolean;
  /** If true, hide the progress dots. Also hidden automatically when the path has only one step. */
  hideProgress?: boolean;
  /** If true, hide the footer (navigation buttons). Defaults to `false`. The error panel is still shown on async failure regardless of this prop. */
  hideFooter?: boolean;
  /** When true, calls `validate()` on the engine so all steps show inline errors simultaneously. Useful when this shell is nested inside a step of an outer shell: bind to the outer snapshot's `hasAttemptedNext`. */
  validateWhen?: boolean;
  /**
   * Shell layout mode:
   * - `"auto"` (default): "form" for single-step top-level paths, "wizard" otherwise.
   * - `"wizard"`: Progress header + Back on left, Cancel and Next on right.
   * - `"form"`: Progress header + Cancel on left, Next alone on right.
   * - `"tabs"`: No progress header, no footer. Use for tabbed interfaces with a custom tab bar inside the step body.
   */
  layout?: "wizard" | "form" | "auto" | "tabs";
  /**
   * Controls whether the shell renders its auto-generated field-error summary box.
   * - `"summary"` (default): Shell renders the labeled error list below the step body.
   * - `"inline"`: Suppress the summary — handle errors inside the step component instead.
   * - `"both"`: Render the shell summary AND whatever the step component renders.
   */
  validationDisplay?: "summary" | "inline" | "both";
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
  /**
   * When `true`, replaces the `ScrollView` body wrapper with a plain `View`.
   * Use this when the step content contains a `FlatList`, `SectionList`, or
   * other virtualized list to avoid the "VirtualizedList inside ScrollView"
   * warning. The step is then responsible for managing its own scroll.
   */
  disableBodyScroll?: boolean;
  /**
   * Services object passed through context to all step components.
   * Step components access it via `usePathContext<TData, TServices>()`.
   */
  services?: unknown;
  /**
   * Content to render when `snapshot.status === "completed"` (i.e. after the
   * path finishes with `completionBehaviour: "stayOnFinal"`). Defaults to a
   * simple "All done." panel with a Restart button.
   */
  completionContent?: ReactNode;
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
  restoreKey,
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
  layout = "auto",
  validationDisplay = "summary",
  renderHeader,
  renderFooter,
  style,
  keyboardVerticalOffset = 0,
  disableBodyScroll = false,
  services,
  validateWhen = false,
  completionContent,
}: PathShellProps, ref): ReactElement {
  const outerCtx = useContext(PathContext);

  const pathReturn = usePath({
    engine: externalEngine,
    onEvent(event) {
      onEvent?.(event);
      if (event.type === "completed") onComplete?.(event.data);
      if (event.type === "cancelled") onCancel?.(event.data);
      if (restoreKey && outerCtx && event.type === "stateChanged") {
        (outerCtx.path.setData as unknown as (key: string, value: unknown) => void)(
          restoreKey, event.snapshot
        );
      }
    },
  });

  const { snapshot, start, next, previous, cancel, goToStep, goToStepChecked, setData, restart, retry, suspend, validate } = pathReturn;

  useEffect(() => {
    if (validateWhen) validate();
  }, [validateWhen, validate]);

  useImperativeHandle(ref, () => ({
    restart: () => restart(),
  }));

  const startedRef = useRef(false);
  useEffect(() => {
    if (autoStart && !startedRef.current && !externalEngine) {
      startedRef.current = true;
      let startData: PathData = initialData;
      let restoreStepId: string | undefined;
      if (restoreKey && outerCtx) {
        const stored = outerCtx.path.snapshot?.data[restoreKey] as PathSnapshot | undefined;
        if (stored != null && typeof stored === "object" && "stepId" in stored) {
          startData = stored.data as PathData;
          if (stored.stepIndex > 0) restoreStepId = stored.stepId as string;
        }
      }
      const p = start(pathDef, startData);
      if (restoreStepId) {
        Promise.resolve(p).then(() => goToStep(restoreStepId!));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Look up step content — prefer formId (StepChoice inner step) over stepId
  const stepContent = snapshot
    ? ((snapshot.formId ? steps[snapshot.formId] : undefined) ?? steps[snapshot.stepId] ?? null)
    : null;

  const contextValue: PathContextValue = { path: pathReturn, services: services ?? null };

  const actions: PathShellActions = {
    next, previous, cancel, goToStep, goToStepChecked, setData,
    restart: () => restart(),
    retry: () => retry(),
    suspend: () => suspend(),
  };

  if (!snapshot) {
    return (
      <PathContext.Provider value={contextValue}>
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

  if (snapshot.status === "completed") {
    return (
      <PathContext.Provider value={contextValue}>
        <View style={[styles.shell, style]}>
          {completionContent ?? (
            <View style={styles.completionPanel}>
              <Text style={styles.completionMessage}>All done.</Text>
              <Pressable style={styles.btnPrimary} onPress={() => restart()}>
                <Text style={styles.btnPrimaryText}>Start over</Text>
              </Pressable>
            </View>
          )}
        </View>
      </PathContext.Provider>
    );
  }

  const effectiveHideProgress = hideProgress || layout === "tabs";
  const effectiveHideFooter = hideFooter || layout === "tabs";
  const resolvedLayout =
    layout === "auto" || layout === "tabs"
      ? snapshot.stepCount === 1 && snapshot.nestingLevel === 0
        ? "form"
        : "wizard"
      : layout;
  const isFormMode = resolvedLayout === "form";
  const showProgress =
    !effectiveHideProgress && (snapshot.stepCount > 1 || snapshot.nestingLevel > 0);

  return (
    <PathContext.Provider value={contextValue}>
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
                  {snapshot.steps.map((step, i) => (
                    <View
                      key={step.id}
                      style={[
                        styles.dot,
                        step.status === "completed" && styles.dotCompleted,
                        step.status === "current" && styles.dotCurrent,
                      ]}
                    >
                      <Text style={[styles.dotLabel, step.status === "upcoming" && styles.dotLabelUpcoming]}>
                        {step.status === "completed" ? "✓" : String(i + 1)}
                      </Text>
                    </View>
                  ))}
                </View>
                {(() => {
                  const cur = snapshot.steps.find(s => s.status === "current");
                  const title = cur?.title ?? cur?.id;
                  return title ? <Text style={styles.stepTitle}>{title}</Text> : null;
                })()}
                <View style={styles.track}>
                  <View style={[styles.trackFill, { width: `${snapshot.progress * 100}%` as any }]} />
                </View>
              </View>
            )
        )}

        {/* Body — step content */}
        {disableBodyScroll
          ? <View style={[styles.body, styles.bodyContent]}>{stepContent}</View>
          : <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>{stepContent}</ScrollView>
        }

        {/* Validation messages */}
        {validationDisplay !== "inline" && (snapshot.hasAttemptedNext || snapshot.hasValidated) && Object.keys(snapshot.fieldErrors).length > 0 && (
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

        {/* Blocking error — guard returned { allowed: false, reason } */}
        {validationDisplay !== "inline" && (snapshot.hasAttemptedNext || snapshot.hasValidated) && snapshot.blockingError && (
          <Text style={styles.blockingError}>{snapshot.blockingError}</Text>
        )}

        {/* Error panel — replaces footer when an async operation has failed */}
        {snapshot.status === "error" && snapshot.error
          ? (() => {
              const err = snapshot.error!;
              const escalated = err.retryCount >= 2;
              return (
                <View style={styles.errorPanel}>
                  <Text style={styles.errorTitle}>
                    {escalated ? "Still having trouble." : "Something went wrong."}
                  </Text>
                  <Text style={styles.errorMessage}>
                    {errorPhaseMessage(err.phase)}{err.message ? ` ${err.message}` : ""}
                  </Text>
                  <View style={styles.errorActions}>
                    {!escalated && (
                      <Pressable style={[styles.btn, styles.btnRetry]} onPress={retry}>
                        <Text style={styles.btnPrimaryText}>Try again</Text>
                      </Pressable>
                    )}
                    {snapshot.hasPersistence && (
                      <Pressable
                        style={[styles.btn, escalated ? styles.btnRetry : styles.btnSuspend]}
                        onPress={suspend}
                      >
                        <Text style={escalated ? styles.btnPrimaryText : styles.btnCancelText}>
                          Save and come back later
                        </Text>
                      </Pressable>
                    )}
                    {escalated && !snapshot.hasPersistence && (
                      <Pressable style={[styles.btn, styles.btnRetry]} onPress={retry}>
                        <Text style={styles.btnPrimaryText}>Try again</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })()
          : !effectiveHideFooter
          ? renderFooter
            ? renderFooter(snapshot, actions)
            : (
            <View style={styles.footer}>
              <View style={styles.footerLeft}>
                {isFormMode && !hideCancel && (
                  <Pressable
                    style={[styles.btn, styles.btnCancel, snapshot.status !== "idle" && styles.btnDisabled]}
                    onPress={cancel}
                    disabled={snapshot.status !== "idle"}
                  >
                    <Text style={styles.btnCancelText}>{cancelLabel}</Text>
                  </Pressable>
                )}
                {!isFormMode && !snapshot.isFirstStep && (
                  <Pressable
                    style={[styles.btn, styles.btnBack, (snapshot.status !== "idle" || !snapshot.canMovePrevious) && styles.btnDisabled]}
                    onPress={previous}
                    disabled={snapshot.status !== "idle" || !snapshot.canMovePrevious}
                  >
                    <Text style={styles.btnBackText}>← {backLabel}</Text>
                  </Pressable>
                )}
              </View>
              <View style={styles.footerRight}>
                {!isFormMode && !hideCancel && (
                  <Pressable
                    style={[styles.btn, styles.btnCancel, snapshot.status !== "idle" && styles.btnDisabled]}
                    onPress={cancel}
                    disabled={snapshot.status !== "idle"}
                  >
                    <Text style={styles.btnCancelText}>{cancelLabel}</Text>
                  </Pressable>
                )}
                <Pressable
                  style={[styles.btn, styles.btnPrimary, snapshot.status !== "idle" && styles.btnDisabled]}
                  onPress={next}
                  disabled={snapshot.status !== "idle" || !snapshot.canMoveNext}
                >
                  {snapshot.status !== "idle" && loadingLabel
                    ? <Text style={styles.btnPrimaryText}>{loadingLabel}</Text>
                    : snapshot.status !== "idle"
                      ? <ActivityIndicator size="small" color="#ffffff" />
                      : <Text style={styles.btnPrimaryText}>{snapshot.isLastStep ? completeLabel : `${nextLabel} →`}</Text>
                  }
                </Pressable>
              </View>
            </View>
          )
          : null
        }
      </KeyboardAvoidingView>
    </PathContext.Provider>
  );
});



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
  completionPanel: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  completionMessage: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 20,
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
    marginBottom: 6,
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  dotCompleted: {
    backgroundColor: "#10b981",
  },
  dotCurrent: {
    backgroundColor: "#6366f1",
  },
  dotLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#ffffff",
  },
  dotLabelUpcoming: {
    color: "#9ca3af",
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 8,
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
  blockingError: {
    fontSize: 13,
    color: "#dc2626",
    marginTop: 4,
  },
  btnRetry: {
    backgroundColor: "#dc2626",
  },
  btnSuspend: {
    backgroundColor: "transparent",
  },
  errorPanel: {
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
    padding: 16,
    gap: 8,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#dc2626",
  },
  errorMessage: {
    fontSize: 13,
    color: "#6b7280",
  },
  errorActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
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
