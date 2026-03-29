/**
 * @daltonr/pathwrite-store
 *
 * Persistence adapters and observer utilities for PathEngine state.
 *
 * Stores (implement PathStore):
 *   - HttpStore        — persists to a REST API
 *   - LocalStorageStore — persists to browser localStorage (or any sync key-value adapter)
 *   - AsyncStorageStore — persists to any async key-value store (e.g. AsyncStorage on React Native)
 *
 * Observer utilities:
 *   - persistence      — PathObserver factory; wires any PathStore to an engine's event stream
 *   - restoreOrStart   — convenience factory for the load/restore-or-start pattern
 *
 * Bring your own store:
 *   Implement the PathStore interface (save / load / delete) to use any backend —
 *   MongoDB Atlas SDK, SQLite, MMKV, IndexedDB, or anything else.
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

// ---------------------------------------------------------------------------
// HttpStore
// ---------------------------------------------------------------------------

export interface HttpStoreOptions {
  /**
   * Base URL for the API. Individual endpoint paths are appended to this.
   * Example: "https://api.example.com" or "/api/wizard"
   */
  baseUrl: string;
  /** Function that builds the save endpoint URL. Default: `${baseUrl}/state/${key}` */
  saveUrl?: (key: string) => string;
  /** Function that builds the load endpoint URL. Default: `${baseUrl}/state/${key}` */
  loadUrl?: (key: string) => string;
  /** Function that builds the delete endpoint URL. Default: `${baseUrl}/state/${key}` */
  deleteUrl?: (key: string) => string;
  /**
   * Custom headers to include in all requests (e.g. auth tokens).
   * Can be a static object or a function that returns headers (sync or async).
   */
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
  /** Custom fetch implementation (useful for testing or SSR). Defaults to global fetch. */
  fetch?: typeof fetch;
  /** Called when a request fails. Can be used for logging or error handling. */
  onError?: (error: Error, operation: "save" | "load" | "delete", key: string) => void;
}

export class HttpStore implements PathStore {
  private options: Required<Omit<HttpStoreOptions, "headers" | "onError">> &
    Pick<HttpStoreOptions, "headers" | "onError">;

  constructor(options: HttpStoreOptions) {
    const baseUrl = options.baseUrl.replace(/\/$/, "");

    this.options = {
      baseUrl,
      saveUrl: options.saveUrl ?? ((key) => `${baseUrl}/state/${encodeURIComponent(key)}`),
      loadUrl: options.loadUrl ?? ((key) => `${baseUrl}/state/${encodeURIComponent(key)}`),
      deleteUrl: options.deleteUrl ?? ((key) => `${baseUrl}/state/${encodeURIComponent(key)}`),
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
        headers: { "Content-Type": "application/json", ...headers },
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
        headers: { "Content-Type": "application/json", ...headers },
      });
      if (response.status === 404) return null;
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
        headers: { ...headers },
      });
      if (response.status === 404) return;
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
// persistence — PathObserver factory
// ---------------------------------------------------------------------------

export interface PersistenceOptions {
  /** The store to persist state to. Any PathStore implementation works. */
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
 * Returns a `PathObserver` that automatically persists engine state to the
 * provided store based on the chosen strategy.
 *
 * Works with any PathStore — HttpStore, LocalStorageStore, AsyncStorageStore,
 * or a custom implementation.
 *
 * ```typescript
 * const store = new LocalStorageStore();
 * const engine = new PathEngine({
 *   observers: [
 *     persistence({ store, key: "user:123:onboarding", strategy: "onNext" }),
 *   ],
 * });
 * ```
 */
export function persistence(options: PersistenceOptions): PathObserver {
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
    if (strategy === "onComplete") {
      if (event.type === "completed") {
        const finalState: SerializedPathState = {
          version: 1,
          pathId: event.pathId,
          currentStepIndex: -1,
          data: event.data,
          visitedStepIds: [],
          pathStack: [],
          _status: "idle",
        };
        options.store.save(options.key, finalState)
          .then(() => options.onSaveSuccess?.())
          .catch((error) => {
            const err = error instanceof Error ? error : new Error(String(error));
            options.onSaveError?.(err);
          });
      }
      return;
    }

    if (matchesStrategy(strategy, event)) scheduleSave(engine);

    if (event.type === "completed") {
      options.store.delete(options.key).catch((err) => {
        console.warn("[pathwrite] Failed to delete saved state after completion:", err);
      });
    }
  };
}

// ---------------------------------------------------------------------------
// restoreOrStart — convenience factory
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
   * Build these explicitly — e.g. `persistence({ store, key })` — and
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
 * ```typescript
 * const store = new AsyncStorageStore({ storage: AsyncStorage });
 * const key = "user:123:onboarding";
 *
 * const { engine, restored } = await restoreOrStart({
 *   store,
 *   key,
 *   path: onboardingWizard,
 *   initialData: { name: "", email: "" },
 *   observers: [
 *     persistence({ store, key, strategy: "onNext" }),
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

export { AsyncStorageStore } from "./async-store";
export type { AsyncStorageStoreOptions, AsyncStorageAdapter } from "./async-store";
