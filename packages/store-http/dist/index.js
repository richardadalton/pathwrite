/**
 * @daltonr/pathwrite-store-http
 *
 * REST API storage adapter for PathEngine state.
 * Calls your custom endpoints to save/load serialized path state.
 */
import { PathEngine, matchesStrategy } from "@daltonr/pathwrite-core";
export class HttpStore {
    options;
    constructor(options) {
        const baseUrl = options.baseUrl.replace(/\/$/, ""); // strip trailing slash
        this.options = {
            baseUrl,
            saveUrl: options.saveUrl ?? ((key) => `${baseUrl}/state/${encodeURIComponent(key)}`),
            loadUrl: options.loadUrl ?? ((key) => `${baseUrl}/state/${encodeURIComponent(key)}`),
            deleteUrl: options.deleteUrl ?? ((key) => `${baseUrl}/state/${encodeURIComponent(key)}`),
            // fetch.bind(globalThis) is intentional: storing window.fetch as a bare
            // reference and calling it as a method later loses the window binding,
            // throwing "Illegal invocation" in every browser.
            fetch: options.fetch ?? fetch.bind(globalThis),
            headers: options.headers,
            onError: options.onError,
        };
    }
    async getHeaders() {
        if (!this.options.headers)
            return {};
        if (typeof this.options.headers === "function") {
            return await this.options.headers();
        }
        return this.options.headers;
    }
    async save(key, state) {
        try {
            const url = this.options.saveUrl(key);
            const headers = await this.getHeaders();
            const response = await this.options.fetch(url, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    ...headers,
                },
                body: JSON.stringify(state),
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            this.options.onError?.(err, "save", key);
            throw err;
        }
    }
    async load(key) {
        try {
            const url = this.options.loadUrl(key);
            const headers = await this.getHeaders();
            const response = await this.options.fetch(url, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    ...headers,
                },
            });
            if (response.status === 404) {
                return null; // Not found is not an error
            }
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            return data;
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            this.options.onError?.(err, "load", key);
            throw err;
        }
    }
    async delete(key) {
        try {
            const url = this.options.deleteUrl(key);
            const headers = await this.getHeaders();
            const response = await this.options.fetch(url, {
                method: "DELETE",
                headers: {
                    ...headers,
                },
            });
            if (response.status === 404) {
                return; // Already gone, that's fine
            }
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            this.options.onError?.(err, "delete", key);
            throw err;
        }
    }
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
export function httpPersistence(options) {
    const strategy = options.strategy ?? "onNext";
    const debounceMs = options.debounceMs ?? 0;
    let saveTimer = null;
    let pendingSave = null;
    const performSave = (engine) => {
        if (pendingSave)
            return pendingSave;
        pendingSave = (async () => {
            const state = engine.exportState();
            if (!state)
                return;
            try {
                await options.store.save(options.key, state);
                options.onSaveSuccess?.();
            }
            catch (error) {
                const err = error instanceof Error ? error : new Error(String(error));
                options.onSaveError?.(err);
            }
        })().finally(() => { pendingSave = null; });
        return pendingSave;
    };
    const scheduleSave = (engine) => {
        if (debounceMs > 0) {
            if (saveTimer)
                clearTimeout(saveTimer);
            saveTimer = setTimeout(() => {
                saveTimer = null;
                performSave(engine);
            }, debounceMs);
        }
        else {
            performSave(engine);
        }
    };
    return (event, engine) => {
        // "onComplete" requires a synthetic state built from the event (exportState()
        // returns null once the path finishes), so it is handled separately.
        if (strategy === "onComplete") {
            if (event.type === "completed") {
                const finalState = {
                    version: 1,
                    pathId: event.pathId,
                    currentStepIndex: -1,
                    data: event.data,
                    visitedStepIds: [],
                    pathStack: [],
                    _isNavigating: false,
                };
                options.store.save(options.key, finalState)
                    .then(() => options.onSaveSuccess?.())
                    .catch((error) => {
                    const err = error instanceof Error ? error : new Error(String(error));
                    options.onSaveError?.(err);
                });
            }
            return; // onComplete never auto-deletes
        }
        if (matchesStrategy(strategy, event))
            scheduleSave(engine);
        // Clean up persisted state once the path completes (restore would restart from scratch)
        if (event.type === "completed") {
            options.store.delete(options.key).catch((err) => {
                console.warn("[pathwrite] Failed to delete saved state after completion:", err);
            });
        }
    };
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
export async function restoreOrStart(options) {
    const observers = options.observers ?? [];
    const pathDefs = options.pathDefinitions ?? { [options.path.id]: options.path };
    const saved = await options.store.load(options.key);
    let engine;
    let restored;
    if (saved) {
        engine = PathEngine.fromState(saved, pathDefs, { observers });
        restored = true;
    }
    else {
        engine = new PathEngine({ observers });
        await engine.start(options.path, options.initialData);
        restored = false;
    }
    return { engine, restored };
}
// Re-export core types and utilities for convenience
export { matchesStrategy } from "@daltonr/pathwrite-core";
//# sourceMappingURL=index.js.map