import type { PropsWithChildren, ReactElement, ReactNode } from "react";
import { PathData, PathDefinition, PathEngine, PathEvent, PathSnapshot } from "@daltonr/pathwrite-core";
export interface UsePathOptions {
    /**
     * An externally-managed `PathEngine` to subscribe to — for example, the engine
     * returned by `createPersistedEngine()` from `@daltonr/pathwrite-store-http`.
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
export declare function usePath<TData extends PathData = PathData>(options?: UsePathOptions): UsePathReturn<TData>;
/**
 * Provides a single `usePath` instance to all descendants.
 * Consume with `usePathContext()`.
 */
export declare function PathProvider({ children, onEvent }: PathProviderProps): ReactElement;
/**
 * Access the nearest `PathProvider`'s path instance.
 * Throws if used outside of a `<PathProvider>`.
 *
 * The optional generic narrows `snapshot.data` for convenience — it is a
 * **type-level assertion**, not a runtime guarantee.
 */
export declare function usePathContext<TData extends PathData = PathData>(): UsePathReturn<TData>;
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
export declare function PathShell({ path: pathDef, engine: externalEngine, steps, initialData, autoStart, onComplete, onCancel, onEvent, backLabel, nextLabel, completeLabel, cancelLabel, hideCancel, hideProgress, className, renderHeader, renderFooter, }: PathShellProps): ReactElement;
export type { PathData, PathDefinition, PathEvent, PathSnapshot, PathStep, PathStepContext, SerializedPathState } from "@daltonr/pathwrite-core";
export { PathEngine } from "@daltonr/pathwrite-core";
