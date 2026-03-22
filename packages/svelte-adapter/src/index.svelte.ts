import { onDestroy, getContext, setContext } from "svelte";
import type {
  PathData,
  PathDefinition,
  PathEngine,
  PathEvent,
  PathSnapshot
} from "@daltonr/pathwrite-core";
import { PathEngine as PathEngineClass } from "@daltonr/pathwrite-core";

// Re-export core types for convenience
export type {
  PathData,
  PathDefinition,
  PathEngine,
  PathEvent,
  PathSnapshot,
  PathStep,
  PathStepContext,
  SerializedPathState
} from "@daltonr/pathwrite-core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UsePathOptions {
  /**
   * An externally-managed `PathEngine` to subscribe to — for example, the engine
   * returned by `restoreOrStart()` from `@daltonr/pathwrite-store-http`.
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
  /** Current path snapshot, or `null` when no path is active. Reactive via `$state`. */
  readonly snapshot: PathSnapshot<TData> | null;
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

// ---------------------------------------------------------------------------
// usePath - Runes-based API for Svelte 5
// ---------------------------------------------------------------------------

/**
 * Create a Pathwrite engine with Svelte 5 runes-based reactivity.
 * Call this from inside a Svelte component to get a reactive snapshot.
 * Cleanup is automatic via onDestroy.
 *
 * **Note:** `snapshot` is a reactive getter — access it via the returned
 * object (e.g. `path.snapshot`). Destructuring `snapshot` will lose reactivity.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { usePath } from '@daltonr/pathwrite-svelte';
 *
 *   const path = usePath();
 *
 *   onMount(() => {
 *     path.start(myPath, { name: '' });
 *   });
 * </script>
 *
 * {#if path.snapshot}
 *   <h2>{path.snapshot.stepId}</h2>
 *   <button onclick={path.previous} disabled={path.snapshot.isFirstStep}>Previous</button>
 *   <button onclick={path.next} disabled={!path.snapshot.canMoveNext}>Next</button>
 * {/if}
 * ```
 */
export function usePath<TData extends PathData = PathData>(
  options?: UsePathOptions
): UsePathReturn<TData> {
  const engine = options?.engine ?? new PathEngineClass();

  // Reactive snapshot via $state rune
  let _snapshot: PathSnapshot<TData> | null = $state(
    engine.snapshot() as PathSnapshot<TData> | null
  );

  // Subscribe to engine events
  const unsubscribe = engine.subscribe((event: PathEvent) => {
    if (event.type === "stateChanged" || event.type === "resumed") {
      _snapshot = event.snapshot as PathSnapshot<TData>;
    } else if (event.type === "completed" || event.type === "cancelled") {
      _snapshot = null;
    }
    options?.onEvent?.(event);
  });

  // Auto-cleanup when component is destroyed
  onDestroy(unsubscribe);

  const start = (path: PathDefinition<any>, initialData: PathData = {}): Promise<void> =>
    engine.start(path, initialData);

  const startSubPath = (
    path: PathDefinition<any>,
    initialData: PathData = {},
    meta?: Record<string, unknown>
  ): Promise<void> => engine.startSubPath(path, initialData, meta);

  const next = (): Promise<void> => engine.next();
  const previous = (): Promise<void> => engine.previous();
  const cancel = (): Promise<void> => engine.cancel();

  const goToStep = (stepId: string): Promise<void> => engine.goToStep(stepId);
  const goToStepChecked = (stepId: string): Promise<void> => engine.goToStepChecked(stepId);

  const setData = (<K extends string & keyof TData>(key: K, value: TData[K]): Promise<void> =>
    engine.setData(key, value as unknown)) as UsePathReturn<TData>["setData"];

  const restart = (path: PathDefinition<any>, initialData: PathData = {}): Promise<void> =>
    engine.restart(path, initialData);

  return {
    get snapshot() { return _snapshot; },
    start,
    startSubPath,
    next,
    previous,
    cancel,
    goToStep,
    goToStepChecked,
    setData,
    restart
  };
}

// ---------------------------------------------------------------------------
// Context API for PathShell
// ---------------------------------------------------------------------------

const PATH_CONTEXT_KEY = Symbol("pathwrite-context");

export interface PathContext<TData extends PathData = PathData> {
  readonly snapshot: PathSnapshot<TData> | null;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  cancel: () => Promise<void>;
  goToStep: (stepId: string) => Promise<void>;
  goToStepChecked: (stepId: string) => Promise<void>;
  setData: <K extends string & keyof TData>(key: K, value: TData[K]) => Promise<void>;
  restart: () => Promise<void>;
}

/**
 * Get the PathContext from a parent PathShell component.
 * Use this inside step components to access the path engine.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { getPathContext } from '@daltonr/pathwrite-svelte';
 *
 *   const ctx = getPathContext();
 * </script>
 *
 * <input value={ctx.snapshot?.data.name}
 *        oninput={(e) => ctx.setData('name', e.target.value)} />
 * <button onclick={ctx.next}>Next</button>
 * ```
 */
export function getPathContext<TData extends PathData = PathData>(): PathContext<TData> {
  const ctx = getContext<PathContext<TData>>(PATH_CONTEXT_KEY);
  if (!ctx) {
    throw new Error(
      "getPathContext() must be called from a component inside a <PathShell>. " +
        "Ensure the PathShell component is a parent in the component tree."
    );
  }
  return ctx;
}

/**
 * Internal: Set the PathContext for child components.
 * Used by PathShell component.
 */
export function setPathContext<TData extends PathData = PathData>(ctx: PathContext<TData>): void {
  setContext(PATH_CONTEXT_KEY, ctx);
}

// ---------------------------------------------------------------------------
// Helper for binding form inputs
// ---------------------------------------------------------------------------

/**
 * Create a two-way binding helper for form inputs.
 * Returns an object with a reactive `value` property.
 *
 * @param getSnapshot - A getter function returning the current snapshot (e.g. `() => path.snapshot`)
 * @param setData - The `setData` function from `usePath()`
 * @param key - The data key to bind
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { usePath, bindData } from '@daltonr/pathwrite-svelte';
 *
 *   const path = usePath();
 *   const name = bindData(() => path.snapshot, path.setData, 'name');
 * </script>
 *
 * <input value={name.value} oninput={(e) => name.value = e.target.value} />
 * ```
 */
export function bindData<TData extends PathData, K extends string & keyof TData>(
  getSnapshot: () => PathSnapshot<TData> | null,
  setData: <Key extends string & keyof TData>(key: Key, value: TData[Key]) => Promise<void>,
  key: K
): { readonly value: TData[K]; set: (value: TData[K]) => void } {
  return {
    get value(): TData[K] {
      return (getSnapshot()?.data[key] ?? undefined) as TData[K];
    },
    set(value: TData[K]) {
      setData(key, value);
    }
  };
}

// Export PathShell component
export { default as PathShell } from "./PathShell.svelte";

