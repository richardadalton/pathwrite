import { onDestroy, getContext, setContext } from "svelte";
import type { PathData, PathDefinition, PathEngine, PathEvent, PathSnapshot } from "@daltonr/pathwrite-core";
import { PathEngine as PathEngineClass } from "@daltonr/pathwrite-core";

// Re-export core utilities and types for convenience
export { formatFieldKey, errorPhaseMessage } from "@daltonr/pathwrite-core";
export type {
  PathData,
  FieldErrors,
  PathDefinition,
  PathEngine,
  PathEvent,
  PathSnapshot,
  StepStatus,
  PathStep,
  PathStepContext,
  ProgressLayout,
  RootProgress,
  SerializedPathState,
} from "@daltonr/pathwrite-core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UsePathOptions<TData extends PathData = PathData> {
  /**
   * An externally-managed `PathEngine` to subscribe to — for example, the engine
   * returned by `restoreOrStart()` from `@daltonr/pathwrite-store`.
   *
   * When provided:
   * - `usePath` will **not** create its own engine.
   * - The snapshot is seeded immediately from the engine's current state.
   * - The engine lifecycle (start / cleanup) is the **caller's responsibility**.
   * - `PathShell` will skip its own `autoStart` call.
   */
  /**
   * An externally managed engine. Pass it as a getter (`get engine() { … }`)
   * over a reactive prop to have the hook track it: an engine that arrives
   * later (e.g. from an async `restoreOrStart()`) or is swapped is adopted —
   * the hook re-subscribes and re-seeds its snapshot from the new engine.
   */
  engine?: PathEngine<TData>;
  /** Called for every engine event (stateChanged, completed, cancelled, resumed). */
  onEvent?: (event: PathEvent<TData>) => void;
}

export interface UsePathReturn<TData extends PathData = PathData> {
  /**
   * Current path snapshot, or `null` when no path is active. Reactive via `$state.raw`.
   *
   * ⚠️ **Do not destructure.** `const { snapshot } = usePath()` captures the value
   * once and loses reactivity. Always access as `path.snapshot`.
   */
  readonly snapshot: PathSnapshot<TData> | null;
  /** Start (or restart) a path. */
  start: (path: PathDefinition<TData>, initialData?: Partial<TData>) => Promise<void>;
  /** Push a sub-path onto the stack. Requires an active path. A sub-path has its own data, so any definition is accepted. Pass an optional `meta` object for correlation — it is returned unchanged to the parent step's `onSubPathComplete` / `onSubPathCancel` hooks. */
  startSubPath: (
    path: PathDefinition,
    initialData?: PathData,
    meta?: Record<string, unknown>
  ) => Promise<void>;
  /** Advance one step. Completes the path on the last step. */
  next: () => Promise<void>;
  /** Go back one step. No-op when already on the first step of a top-level path. Pops back to the parent path when on the first step of a sub-path. */
  previous: () => Promise<void>;
  /** Cancel the active path (or sub-path). */
  cancel: () => Promise<void>;
  /** Jump directly to a step by ID. Calls onLeave / onEnter but bypasses guards and shouldSkip. Pass `{ validateOnLeave: true }` to mark the departing step as attempted before navigating. */
  goToStep: (stepId: string, options?: { validateOnLeave?: boolean }) => Promise<void>;
  /** Jump directly to a step by ID, checking the current step's canMoveNext (forward) or canMovePrevious (backward) guard first. Navigation is blocked if the guard returns false. */
  goToStepChecked: (stepId: string, options?: { validateOnLeave?: boolean }) => Promise<void>;
  /** Update a single data value; triggers a re-render via stateChanged. When `TData` is specified, `key` and `value` are type-checked against your data shape. */
  setData: <K extends string & keyof TData>(key: K, value: TData[K]) => Promise<void>;
  /** Reset the current step's data to what it was when the step was entered. Useful for "Clear" or "Reset" buttons. */
  resetStep: () => Promise<void>;
  /**
   * Tear down any active path (without firing hooks) and immediately restart
   * the root path with the `initialData` from the original `start()` call.
   * Takes no arguments; rejects if the engine has never been started.
   * Use for "Start over" / retry flows without remounting the component.
   */
  restart: () => Promise<void>;
  /** Re-runs the operation that set `snapshot.error`. Increments `retryCount` on repeated failure. No-op when there is no pending error. */
  retry: () => Promise<void>;
  /** Pauses the path with intent to return. Emits `suspended`. All state is preserved. */
  suspend: () => Promise<void>;
  /** Trigger inline validation on all steps without navigating. Sets `snapshot.hasValidated`. */
  validate: () => void;
}

// ---------------------------------------------------------------------------
// usePath - Runes-based API for Svelte 5
// ---------------------------------------------------------------------------

/**
 * Create a Pathwrite engine with Svelte 5 runes-based reactivity.
 * Call this from inside a Svelte component to get a reactive snapshot.
 * Cleanup is automatic via onDestroy.
 *
 * ---
 *
 * ⚠️ **Do not destructure `snapshot`.**
 *
 * `snapshot` is a reactive getter. Destructuring it copies the value once
 * and severs the reactive connection — your component will stop updating.
 *
 * ```svelte
 * // ❌ Broken — snapshot is captured once and never updates
 * const { snapshot, next } = usePath();
 *
 * // ✅ Correct — snapshot is read through the live object on every render
 * const path = usePath();
 * // use path.snapshot in your template
 * ```
 *
 * Other properties (`next`, `previous`, `setData`, etc.) are plain functions
 * and are safe to destructure.
 *
 * If you need a local variable that stays reactive, use `$derived`:
 * ```svelte
 * const path = usePath();
 * const snapshot = $derived(path.snapshot);
 * ```
 *
 * This is expected Svelte 5 behaviour — see the
 * [Svelte $state docs](https://svelte.dev/docs/svelte/$state) for details.
 *
 * ---
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
  options?: UsePathOptions<TData>
): UsePathReturn<TData> {
  let ownEngine: PathEngine<TData> | null = null;
  const resolveEngine = (): PathEngine<TData> =>
    options?.engine ?? (ownEngine ??= new PathEngineClass<TData>());
  let engine = resolveEngine();

  // `$state.raw`, not `$state`: snapshots are immutable values the engine
  // replaces wholesale on every change and nothing mutates them in place, so a
  // deep proxy over each one (and its `data`) would be pure overhead. Every
  // update below reassigns the whole value, which is what `$state.raw` tracks.
  let _snapshot: PathSnapshot<TData> | null = $state.raw(engine.snapshot());

  const onEngineEvent = (event: PathEvent<TData>): void => {
    if (event.type === "stateChanged" || event.type === "resumed") {
      _snapshot = event.snapshot;
    } else if (event.type === "completed" || event.type === "cancelled") {
      _snapshot = engine.snapshot();
    }
    options?.onEvent?.(event);
  };
  let unsubscribe = engine.subscribe(onEngineEvent);

  // Adopt a late or swapped engine (the `engine` option is a getter over a
  // reactive prop): re-subscribe and re-seed the snapshot. Created in its own
  // effect root so usePath() also works outside a component.
  const stopWatching = $effect.root(() => {
    $effect(() => {
      const next = resolveEngine();
      if (next === engine) return;
      unsubscribe();
      engine = next;
      _snapshot = engine.snapshot();
      unsubscribe = engine.subscribe(onEngineEvent);
    });
  });

  // Auto-cleanup when component is destroyed
  onDestroy(() => {
    unsubscribe();
    stopWatching();
  });

  const start = (path: PathDefinition<TData>, initialData: Partial<TData> = {}): Promise<void> =>
    engine.start(path, initialData);

  const startSubPath = (
    path: PathDefinition,
    initialData: PathData = {},
    meta?: Record<string, unknown>
  ): Promise<void> => engine.startSubPath(path, initialData, meta);

  const next = (): Promise<void> => engine.next();
  const previous = (): Promise<void> => engine.previous();
  const cancel = (): Promise<void> => engine.cancel();

  const goToStep = (stepId: string, options?: { validateOnLeave?: boolean }): Promise<void> =>
    engine.goToStep(stepId, options);
  const goToStepChecked = (stepId: string, options?: { validateOnLeave?: boolean }): Promise<void> =>
    engine.goToStepChecked(stepId, options);

  const setData = <K extends string & keyof TData>(key: K, value: TData[K]): Promise<void> =>
    engine.setData(key, value);

  const resetStep = (): Promise<void> => engine.resetStep();

  const restart = (): Promise<void> => engine.restart();
  const retry = (): Promise<void> => engine.retry();
  const suspend = (): Promise<void> => engine.suspend();

  const validate = (): void => engine.validate();

  return {
    get snapshot() {
      return _snapshot;
    },
    start,
    startSubPath,
    next,
    previous,
    cancel,
    goToStep,
    goToStepChecked,
    setData,
    resetStep,
    restart,
    retry,
    suspend,
    validate,
  };
}

/**
 * Navigation actions handed to a custom `footer` snippet of `<PathShell>`
 * (`{#snippet footer(snap, actions)}`). Same shape as the other adapters'
 * `PathShellActions`.
 */
export interface PathShellActions {
  next: () => Promise<void>;
  previous: () => Promise<void>;
  cancel: () => Promise<void>;
  goToStep: (stepId: string, options?: { validateOnLeave?: boolean }) => Promise<void>;
  goToStepChecked: (stepId: string, options?: { validateOnLeave?: boolean }) => Promise<void>;
  setData: (key: string, value: unknown) => Promise<void>;
  /** Restart the shell's current path with its current `initialData`. */
  restart: () => Promise<void>;
  /** Re-run the operation that set `snapshot.error`. */
  retry: () => Promise<void>;
  /** Pause with intent to return, preserving all state. Emits `suspended`. */
  suspend: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context API for PathShell
// ---------------------------------------------------------------------------

const PATH_CONTEXT_KEY = Symbol("pathwrite-context");

/**
 * What step components receive from `usePathContext()`: everything `usePath()`
 * returns (derived from `UsePathReturn`, so the two cannot drift apart) plus
 * the `services` object given to `<PathShell>`.
 */
export interface PathContext<
  TData extends PathData = PathData,
  TServices = unknown,
> extends UsePathReturn<TData> {
  services: TServices;
}

/**
 * Access the nearest `PathShell`'s path instance and optional services object.
 * Use this inside step components to access the path engine.
 *
 * - `TData` narrows `ctx.snapshot?.data`
 * - `TServices` types the `services` value — must match what was passed to `PathShell`
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { usePathContext } from '@daltonr/pathwrite-svelte';
 *
 *   const ctx = usePathContext();
 * </script>
 *
 * <input value={ctx.snapshot?.data.name}
 *        oninput={(e) => ctx.setData('name', e.target.value)} />
 * <button onclick={ctx.next}>Next</button>
 * ```
 */
export function usePathContext<TData extends PathData = PathData, TServices = unknown>(): PathContext<
  TData,
  TServices
> {
  const ctx = getContext<PathContext<TData, TServices>>(PATH_CONTEXT_KEY);
  if (!ctx) {
    throw new Error(
      "usePathContext() must be called from a component inside a <PathShell>. " +
        "Ensure the PathShell component is a parent in the component tree."
    );
  }
  return ctx;
}

/**
 * Internal: Set the PathContext for child components.
 * Used by PathShell component.
 */
export function setPathContext<TData extends PathData = PathData, TServices = unknown>(
  ctx: PathContext<TData, TServices>
): void {
  setContext(PATH_CONTEXT_KEY, ctx);
}

/**
 * Internal: Get the PathContext from the nearest ancestor PathShell, or
 * `undefined` if no PathShell is present. Used by PathShell itself to access
 * the outer shell's context for `restoreKey` auto-wiring — must be called
 * before `setPathContext()` so it reads the parent rather than self.
 */
export function getPathContextOrNull<TData extends PathData = PathData, TServices = unknown>():
  PathContext<TData, TServices> | undefined {
  return getContext<PathContext<TData, TServices>>(PATH_CONTEXT_KEY);
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
    },
  };
}

/**
 * Converts a hyphenated step ID to camelCase.
 * Used internally by PathShell as a fallback key into its `steps` record, so a
 * hyphenated step ID (e.g. "cover-letter") also resolves an entry registered
 * under its camelCase form ("coverLetter").
 */
export function stepIdToCamelCase(id: string): string {
  return id.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

// Export PathShell component
export { default as PathShell } from "./PathShell.svelte";
