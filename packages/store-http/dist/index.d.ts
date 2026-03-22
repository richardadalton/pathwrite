/**
 * @daltonr/pathwrite-store-http
 *
 * REST API storage adapter for PathEngine state.
 * Calls your custom endpoints to save/load serialized path state.
 */
import { PathEngine } from "@daltonr/pathwrite-core";
import type { SerializedPathState, PathDefinition, PathData, PathObserver, ObserverStrategy, PathStore } from "@daltonr/pathwrite-core";
export interface HttpStoreOptions {
    /**
     * Base URL for the API. Individual endpoint paths are appended to this.
     * Example: "https://api.example.com" or "/api/wizard"
     */
    baseUrl: string;
    /**
     * Function that builds the save endpoint URL.
     * Receives the key and should return the full URL.
     * Default: `${baseUrl}/state/${key}`
     */
    saveUrl?: (key: string) => string;
    /**
     * Function that builds the load endpoint URL.
     * Default: `${baseUrl}/state/${key}`
     */
    loadUrl?: (key: string) => string;
    /**
     * Function that builds the delete endpoint URL.
     * Default: `${baseUrl}/state/${key}`
     */
    deleteUrl?: (key: string) => string;
    /**
     * Custom headers to include in all requests (e.g. auth tokens).
     * Can be a static object or a function that returns headers.
     */
    headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
    /**
     * Custom fetch implementation (useful for testing or SSR).
     * Defaults to global fetch.
     */
    fetch?: typeof fetch;
    /**
     * Called when a request fails. Can be used for logging or error handling.
     */
    onError?: (error: Error, operation: "save" | "load" | "delete", key: string) => void;
}
export declare class HttpStore implements PathStore {
    private options;
    constructor(options: HttpStoreOptions);
    private getHeaders;
    save(key: string, state: SerializedPathState): Promise<void>;
    load(key: string): Promise<SerializedPathState | null>;
    delete(key: string): Promise<void>;
}
export interface HttpPersistenceOptions {
    /** The store to persist state to. Any PathStore implementation works — HttpStore, MongoStore, RedisStore, etc. */
    store: PathStore;
    /** Storage key that identifies this path's saved state. */
    key: string;
    /** When to automatically save. Defaults to `"onNext"`. */
    strategy?: ObserverStrategy;
    /**
     * Debounce window in milliseconds. When > 0, rapid events are collapsed into
     * a single save after the window expires. Only useful with `"onEveryChange"`.
     * Defaults to 0 (no debouncing).
     */
    debounceMs?: number;
    /** Called after every successful save. */
    onSaveSuccess?: () => void;
    /** Called when a save fails. The engine continues regardless. */
    onSaveError?: (error: Error) => void;
}
/**
 * Returns a `PathObserver` that automatically persists engine state to an
 * `HttpStore` based on the chosen strategy.
 *
 * Pass the returned observer to `PathEngine` (or `PathEngine.fromState`) via
 * the `observers` option:
 *
 * ```typescript
 * const store = new HttpStore({ baseUrl: "/api/wizard" });
 * const engine = new PathEngine({
 *   observers: [
 *     httpPersistence({ store, key: "user:123:onboarding", strategy: "onNext" }),
 *   ],
 * });
 * await engine.start(myPath, initialData);
 * ```
 *
 * The observer is stateless from the engine's perspective — it closes over its
 * own save-timer and pending-save state internally.
 */
export declare function httpPersistence(options: HttpPersistenceOptions): PathObserver;
export interface RestoreOrStartOptions {
    /** The store to load saved state from. Any PathStore implementation works. */
    store: PathStore;
    /** Storage key that identifies this path's saved state. */
    key: string;
    /** Path definition to start when no saved state exists. */
    path: PathDefinition;
    /**
     * Map of all path definitions that may appear in serialized state
     * (active path + any sub-paths). Defaults to `{ [path.id]: path }`.
     */
    pathDefinitions?: Record<string, PathDefinition>;
    /** Initial data for a fresh (non-restored) start. Defaults to `{}`. */
    initialData?: PathData;
    /**
     * Observers to wire on the engine before the first event fires.
     * Build these explicitly — e.g. `httpPersistence({ store, key })` — and
     * pass them here. `restoreOrStart` does not create any observers itself.
     */
    observers?: PathObserver[];
}
/**
 * Handles the load/restore-or-start pattern in a single call.
 *
 * Tries to load saved state from the store. If found, restores the engine
 * to the saved position. If not found, starts a fresh path.
 *
 * Build your observers separately and pass them in — `restoreOrStart` does
 * not create or configure observers itself.
 *
 * ```typescript
 * const store = new HttpStore({ baseUrl: "/api/wizard" });
 * const key = "user:123:onboarding";
 *
 * const { engine, restored } = await restoreOrStart({
 *   store,
 *   key,
 *   path: onboardingWizard,
 *   initialData: { name: "", email: "" },
 *   observers: [
 *     httpPersistence({ store, key, strategy: "onNext" }),
 *   ],
 * });
 * ```
 */
export declare function restoreOrStart(options: RestoreOrStartOptions): Promise<{
    engine: PathEngine;
    restored: boolean;
}>;
export { matchesStrategy } from "@daltonr/pathwrite-core";
export type { PathData, PathDefinition, PathEvent, PathObserver, PathEngineOptions, PathSnapshot, PathStep, PathStepContext, SerializedPathState, ObserverStrategy, PathStore, } from "@daltonr/pathwrite-core";
//# sourceMappingURL=index.d.ts.map