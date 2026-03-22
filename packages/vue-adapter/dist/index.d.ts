import { type Ref, type DeepReadonly, type PropType, type VNode } from "vue";
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
    /** Called for every engine event (stateChanged, completed, cancelled, resumed). */
    onEvent?: (event: PathEvent) => void;
}
export interface UsePathReturn<TData extends PathData = PathData> {
    /** Current path snapshot, or `null` when no path is active. Reactive — triggers Vue re-renders on change. */
    snapshot: DeepReadonly<Ref<PathSnapshot<TData> | null>>;
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
    /** Update a single data value; triggers a re-render via stateChanged. When `TData` is specified, `key` and `value` are type-checked against your data shape. */
    setData: <K extends string & keyof TData>(key: K, value: TData[K]) => Promise<void>;
    /**
     * Tear down any active path (without firing hooks) and immediately start the
     * given path fresh. Safe to call whether or not a path is currently active.
     * Use for "Start over" / retry flows without remounting the component.
     */
    restart: (path: PathDefinition<any>, initialData?: PathData) => Promise<void>;
}
export declare function usePath<TData extends PathData = PathData>(options?: UsePathOptions): UsePathReturn<TData>;
/**
 * Access the nearest `PathShell`'s path instance via Vue `inject`.
 * Throws if used outside of a PathShell component.
 *
 * The optional generic narrows `snapshot.data` for convenience — it is a
 * **type-level assertion**, not a runtime guarantee.
 */
export declare function usePathContext<TData extends PathData = PathData>(): UsePathReturn<TData>;
export interface PathShellActions {
    next: () => Promise<void>;
    previous: () => Promise<void>;
    cancel: () => Promise<void>;
    goToStep: (stepId: string) => Promise<void>;
    goToStepChecked: (stepId: string) => Promise<void>;
    setData: (key: string, value: unknown) => Promise<void>;
    /** Restart the shell's current path with its current `initialData`. */
    restart: () => Promise<void>;
}
/**
 * `<PathShell>` — default UI shell that renders a progress indicator,
 * step content, and navigation buttons. Step content is provided via
 * **named slots** matching each step's `id`.
 *
 * ```vue
 * <PathShell :path="myPath" :initial-data="{ name: '' }" @complete="handleDone">
 *   <template #details><DetailsForm /></template>
 *   <template #review><ReviewPanel /></template>
 * </PathShell>
 * ```
 */
export declare const PathShell: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    path: {
        type: PropType<PathDefinition<any>>;
        required: true;
    };
    /**
     * An externally-managed engine — for example, the engine returned by
     * `createPersistedEngine()`. When supplied, `PathShell` will skip its own
     * `start()` call and drive the UI from the provided engine instead.
     */
    engine: {
        type: PropType<PathEngine>;
        default: undefined;
    };
    initialData: {
        type: PropType<PathData>;
        default: () => {};
    };
    autoStart: {
        type: BooleanConstructor;
        default: boolean;
    };
    backLabel: {
        type: StringConstructor;
        default: string;
    };
    nextLabel: {
        type: StringConstructor;
        default: string;
    };
    completeLabel: {
        type: StringConstructor;
        default: string;
    };
    cancelLabel: {
        type: StringConstructor;
        default: string;
    };
    hideCancel: {
        type: BooleanConstructor;
        default: boolean;
    };
    hideProgress: {
        type: BooleanConstructor;
        default: boolean;
    };
}>, () => VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, ("complete" | "cancel" | "event")[], "complete" | "cancel" | "event", import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    path: {
        type: PropType<PathDefinition<any>>;
        required: true;
    };
    /**
     * An externally-managed engine — for example, the engine returned by
     * `createPersistedEngine()`. When supplied, `PathShell` will skip its own
     * `start()` call and drive the UI from the provided engine instead.
     */
    engine: {
        type: PropType<PathEngine>;
        default: undefined;
    };
    initialData: {
        type: PropType<PathData>;
        default: () => {};
    };
    autoStart: {
        type: BooleanConstructor;
        default: boolean;
    };
    backLabel: {
        type: StringConstructor;
        default: string;
    };
    nextLabel: {
        type: StringConstructor;
        default: string;
    };
    completeLabel: {
        type: StringConstructor;
        default: string;
    };
    cancelLabel: {
        type: StringConstructor;
        default: string;
    };
    hideCancel: {
        type: BooleanConstructor;
        default: boolean;
    };
    hideProgress: {
        type: BooleanConstructor;
        default: boolean;
    };
}>> & Readonly<{
    onEvent?: ((...args: any[]) => any) | undefined;
    onComplete?: ((...args: any[]) => any) | undefined;
    onCancel?: ((...args: any[]) => any) | undefined;
}>, {
    engine: PathEngine;
    initialData: PathData;
    autoStart: boolean;
    backLabel: string;
    nextLabel: string;
    completeLabel: string;
    cancelLabel: string;
    hideCancel: boolean;
    hideProgress: boolean;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
export type { PathData, PathDefinition, PathEvent, PathSnapshot, PathStep, PathStepContext, SerializedPathState } from "@daltonr/pathwrite-core";
export { PathEngine } from "@daltonr/pathwrite-core";
