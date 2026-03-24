/**
 * @daltonr/pathwrite-store-http
 *
 * REST API storage adapter for PathEngine state.
 * Calls your custom endpoints to save/load serialized path state.
 */

import { PathEngine, matchesStrategy } from "@daltonr/pathwrite-core";
import type {
  SerializedPathState,
  PathEvent,
  PathDefinition,
  PathData,
  PathObserver,
  PathEngineOptions,
  ObserverStrategy,
  PathStore,
} from "@daltonr/pathwrite-core";

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

export class HttpStore implements PathStore {
  private options: Required<Omit<HttpStoreOptions, "headers" | "onError">> &
    Pick<HttpStoreOptions, "headers" | "onError">;

  constructor(options: HttpStoreOptions) {
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

  private async getHeaders(): Promise<HeadersInit> {
    if (!this.options.headers) return {};
    if (typeof this.options.headers === "function") {
      return await this.options.headers();
    }
    return this.options.headers;
  }

  async save(key: string, state: SerializedPathState): Promise<void> {
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
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.options.onError?.(err, "save", key);
      throw err;
    }
  }

  async load(key: string): Promise<SerializedPathState | null> {
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
      return data as SerializedPathState;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.options.onError?.(err, "load", key);
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
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
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.options.onError?.(err, "delete", key);
      throw err;
    }
  }
}


// ---------------------------------------------------------------------------
// httpPersistence — PathObserver factory
// ---------------------------------------------------------------------------

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
export function httpPersistence(options: HttpPersistenceOptions): PathObserver {
  const strategy = options.strategy ?? "onNext";
  const debounceMs = options.debounceMs ?? 0;

  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingSave: Promise<void> | null = null;

  const performSave = (engine: PathEngine): Promise<void> => {
    if (pendingSave) return pendingSave;

    pendingSave = (async () => {
      const state = engine.exportState();
      if (!state) return;
      try {
        await options.store.save(options.key, state);
        options.onSaveSuccess?.();
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        options.onSaveError?.(err);
      }
    })().finally(() => { pendingSave = null; });

    return pendingSave;
  };

  const scheduleSave = (engine: PathEngine): void => {
    if (debounceMs > 0) {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        saveTimer = null;
        performSave(engine);
      }, debounceMs);
    } else {
      performSave(engine);
    }
  };

  return (event: PathEvent, engine: PathEngine): void => {
    // "onComplete" requires a synthetic state built from the event (exportState()
    // returns null once the path finishes), so it is handled separately.
    if (strategy === "onComplete") {
      if (event.type === "completed") {
        const finalState: SerializedPathState = {
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

    if (matchesStrategy(strategy, event)) scheduleSave(engine);

    // Clean up persisted state once the path completes (restore would restart from scratch)
    if (event.type === "completed") {
      options.store.delete(options.key).catch((err) => {
        console.warn("[pathwrite] Failed to delete saved state after completion:", err);
      });
    }
  };
}

// ---------------------------------------------------------------------------
// createPersistedEngine — convenience factory
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// restoreOrStart — convenience factory for the load/restore-or-start pattern
// ---------------------------------------------------------------------------

export interface RestoreOrStartOptions {
  /** The store to load saved state from. Any PathStore implementation works. */
  store: PathStore;
  /** Storage key that identifies this path's saved state. */
  key: string;
  /** Path definition to start when no saved state exists. */
  path: PathDefinition<any>;
  /**
   * Map of all path definitions that may appear in serialized state
   * (active path + any sub-paths). Defaults to `{ [path.id]: path }`.
   */
  pathDefinitions?: Record<string, PathDefinition<any>>;
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
export async function restoreOrStart(
  options: RestoreOrStartOptions
): Promise<{ engine: PathEngine; restored: boolean }> {
  const observers = options.observers ?? [];
  const pathDefs = options.pathDefinitions ?? { [options.path.id]: options.path };
  const saved = await options.store.load(options.key);

  let engine: PathEngine;
  let restored: boolean;

  if (saved) {
    engine = PathEngine.fromState(saved, pathDefs, { observers });
    restored = true;
  } else {
    engine = new PathEngine({ observers });
    await engine.start(options.path, options.initialData);
    restored = false;
  }

  return { engine, restored };
}

// Re-export core types and utilities for convenience
export { matchesStrategy } from "@daltonr/pathwrite-core";
export type {
  PathData,
  PathDefinition,
  PathEvent,
  PathObserver,
  PathEngineOptions,
  PathSnapshot,
  PathStep,
  PathStepContext,
  SerializedPathState,
  ObserverStrategy,
  PathStore,
} from "@daltonr/pathwrite-core";

export { LocalStorageStore } from "./local-store";
export type { LocalStorageStoreOptions, StorageAdapter } from "./local-store";

