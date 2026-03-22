import { createContext, createElement, useCallback, useContext, useEffect, useRef, useSyncExternalStore } from "react";
import { PathEngine } from "@daltonr/pathwrite-core";
// ---------------------------------------------------------------------------
// usePath hook
// ---------------------------------------------------------------------------
export function usePath(options) {
    // Use provided engine or create a stable new one for this hook's lifetime.
    // options.engine must be a stable reference (don't recreate on every render).
    const engineRef = useRef(null);
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
    const snapshotRef = useRef(null);
    if (!seededRef.current) {
        seededRef.current = true;
        try {
            snapshotRef.current = engine.snapshot();
        }
        catch {
            snapshotRef.current = null;
        }
    }
    const subscribe = useCallback((callback) => engine.subscribe((event) => {
        if (event.type === "stateChanged" || event.type === "resumed") {
            snapshotRef.current = event.snapshot;
        }
        else if (event.type === "completed" || event.type === "cancelled") {
            snapshotRef.current = null;
        }
        onEventRef.current?.(event);
        callback();
    }), [engine]);
    const getSnapshot = useCallback(() => snapshotRef.current, []);
    const snapshot = useSyncExternalStore(subscribe, getSnapshot);
    // Stable action callbacks
    const start = useCallback((path, initialData = {}) => engine.start(path, initialData), [engine]);
    const startSubPath = useCallback((path, initialData = {}, meta) => engine.startSubPath(path, initialData, meta), [engine]);
    const next = useCallback(() => engine.next(), [engine]);
    const previous = useCallback(() => engine.previous(), [engine]);
    const cancel = useCallback(() => engine.cancel(), [engine]);
    const goToStep = useCallback((stepId) => engine.goToStep(stepId), [engine]);
    const goToStepChecked = useCallback((stepId) => engine.goToStepChecked(stepId), [engine]);
    const setData = useCallback((key, value) => engine.setData(key, value), [engine]);
    const restart = useCallback((path, initialData = {}) => engine.restart(path, initialData), [engine]);
    return { snapshot, start, startSubPath, next, previous, cancel, goToStep, goToStepChecked, setData, restart };
}
// ---------------------------------------------------------------------------
// Context + Provider
// ---------------------------------------------------------------------------
const PathContext = createContext(null);
/**
 * Provides a single `usePath` instance to all descendants.
 * Consume with `usePathContext()`.
 */
export function PathProvider({ children, onEvent }) {
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
export function usePathContext() {
    const ctx = useContext(PathContext);
    if (ctx === null) {
        throw new Error("usePathContext must be used within a <PathProvider>.");
    }
    return ctx;
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
export function PathShell({ path: pathDef, engine: externalEngine, steps, initialData = {}, autoStart = true, onComplete, onCancel, onEvent, backLabel = "Previous", nextLabel = "Next", completeLabel = "Complete", cancelLabel = "Cancel", hideCancel = false, hideProgress = false, className, renderHeader, renderFooter, }) {
    const pathReturn = usePath({
        engine: externalEngine,
        onEvent(event) {
            onEvent?.(event);
            if (event.type === "completed")
                onComplete?.(event.data);
            if (event.type === "cancelled")
                onCancel?.(event.data);
        }
    });
    const { snapshot, start, next, previous, cancel, goToStep, goToStepChecked, setData, restart } = pathReturn;
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
    // Look up step content from the steps map
    const stepContent = snapshot ? (steps[snapshot.stepId] ?? null) : null;
    if (!snapshot) {
        return createElement(PathContext.Provider, { value: pathReturn }, createElement("div", { className: cls("pw-shell", className) }, createElement("div", { className: "pw-shell__empty" }, createElement("p", null, "No active path."), !autoStart && createElement("button", {
            type: "button",
            className: "pw-shell__start-btn",
            onClick: () => start(pathDef, initialData)
        }, "Start"))));
    }
    const actions = {
        next, previous, cancel, goToStep, goToStepChecked, setData,
        restart: () => restart(pathDef, initialData)
    };
    return createElement(PathContext.Provider, { value: pathReturn }, createElement("div", { className: cls("pw-shell", className) }, 
    // Header — progress indicator
    !hideProgress && (renderHeader
        ? renderHeader(snapshot)
        : defaultHeader(snapshot)), 
    // Body — step content
    createElement("div", { className: "pw-shell__body" }, stepContent), 
    // Validation messages
    snapshot.validationMessages.length > 0 && createElement("ul", { className: "pw-shell__validation" }, ...snapshot.validationMessages.map((msg, i) => createElement("li", { key: i, className: "pw-shell__validation-item" }, msg))), 
    // Footer — navigation buttons
    renderFooter
        ? renderFooter(snapshot, actions)
        : defaultFooter(snapshot, actions, {
            backLabel, nextLabel, completeLabel, cancelLabel, hideCancel
        })));
}
// ---------------------------------------------------------------------------
// Default header (progress indicator)
// ---------------------------------------------------------------------------
function defaultHeader(snapshot) {
    return createElement("div", { className: "pw-shell__header" }, createElement("div", { className: "pw-shell__steps" }, ...snapshot.steps.map((step, i) => createElement("div", {
        key: step.id,
        className: cls("pw-shell__step", `pw-shell__step--${step.status}`)
    }, createElement("span", { className: "pw-shell__step-dot" }, step.status === "completed" ? "✓" : String(i + 1)), createElement("span", { className: "pw-shell__step-label" }, step.title ?? step.id)))), createElement("div", { className: "pw-shell__track" }, createElement("div", {
        className: "pw-shell__track-fill",
        style: { width: `${snapshot.progress * 100}%` }
    })));
}
function defaultFooter(snapshot, actions, labels) {
    return createElement("div", { className: "pw-shell__footer" }, createElement("div", { className: "pw-shell__footer-left" }, !snapshot.isFirstStep && createElement("button", {
        type: "button",
        className: "pw-shell__btn pw-shell__btn--back",
        disabled: snapshot.isNavigating || !snapshot.canMovePrevious,
        onClick: actions.previous
    }, labels.backLabel)), createElement("div", { className: "pw-shell__footer-right" }, !labels.hideCancel && createElement("button", {
        type: "button",
        className: "pw-shell__btn pw-shell__btn--cancel",
        disabled: snapshot.isNavigating,
        onClick: actions.cancel
    }, labels.cancelLabel), createElement("button", {
        type: "button",
        className: "pw-shell__btn pw-shell__btn--next",
        disabled: snapshot.isNavigating || !snapshot.canMoveNext,
        onClick: actions.next
    }, snapshot.isLastStep ? labels.completeLabel : labels.nextLabel)));
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function cls(...parts) {
    return parts.filter(Boolean).join(" ");
}
export { PathEngine } from "@daltonr/pathwrite-core";
//# sourceMappingURL=index.js.map