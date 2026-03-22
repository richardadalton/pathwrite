import { onDestroy, getContext, setContext } from "svelte";
import { PathEngine as PathEngineClass } from "@daltonr/pathwrite-core";
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
export function usePath(options) {
    const engine = options?.engine ?? new PathEngineClass();
    // Reactive snapshot via $state rune
    let _snapshot = $state(engine.snapshot());
    // Subscribe to engine events
    const unsubscribe = engine.subscribe((event) => {
        if (event.type === "stateChanged" || event.type === "resumed") {
            _snapshot = event.snapshot;
        }
        else if (event.type === "completed" || event.type === "cancelled") {
            _snapshot = null;
        }
        options?.onEvent?.(event);
    });
    // Auto-cleanup when component is destroyed
    onDestroy(unsubscribe);
    const start = (path, initialData = {}) => engine.start(path, initialData);
    const startSubPath = (path, initialData = {}, meta) => engine.startSubPath(path, initialData, meta);
    const next = () => engine.next();
    const previous = () => engine.previous();
    const cancel = () => engine.cancel();
    const goToStep = (stepId) => engine.goToStep(stepId);
    const goToStepChecked = (stepId) => engine.goToStepChecked(stepId);
    const setData = ((key, value) => engine.setData(key, value));
    const restart = (path, initialData = {}) => engine.restart(path, initialData);
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
export function getPathContext() {
    const ctx = getContext(PATH_CONTEXT_KEY);
    if (!ctx) {
        throw new Error("getPathContext() must be called from a component inside a <PathShell>. " +
            "Ensure the PathShell component is a parent in the component tree.");
    }
    return ctx;
}
/**
 * Internal: Set the PathContext for child components.
 * Used by PathShell component.
 */
export function setPathContext(ctx) {
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
export function bindData(getSnapshot, setData, key) {
    return {
        get value() {
            return (getSnapshot()?.data[key] ?? undefined);
        },
        set(value) {
            setData(key, value);
        }
    };
}
// Export PathShell component
export { default as PathShell } from "./PathShell.svelte";
