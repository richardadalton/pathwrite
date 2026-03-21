/**
 * @daltonr/pathwrite-store-http
 * 
 * REST API storage adapter for PathEngine state.
 * Calls your custom endpoints to save/load serialized path state.
 */

import type { SerializedPathState, PathEngine, PathEvent, PathDefinition, PathData } from "@daltonr/pathwrite-core";

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

export class HttpStore {
  private options: Required<Omit<HttpStoreOptions, "headers" | "onError">> & 
    Pick<HttpStoreOptions, "headers" | "onError">;

  constructor(options: HttpStoreOptions) {
    const baseUrl = options.baseUrl.replace(/\/$/, ""); // strip trailing slash

    this.options = {
      baseUrl,
      saveUrl: options.saveUrl ?? ((key) => `${baseUrl}/state/${encodeURIComponent(key)}`),
      loadUrl: options.loadUrl ?? ((key) => `${baseUrl}/state/${encodeURIComponent(key)}`),
      deleteUrl: options.deleteUrl ?? ((key) => `${baseUrl}/state/${encodeURIComponent(key)}`),
      fetch: options.fetch ?? fetch,
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

/**
 * Persistence strategy determines when the wizard state is saved.
 */
export type PersistenceStrategy =
  | "onEveryChange"        // Save on every stateChanged event (default)
  | "onNext"               // Save only on successful next() navigation
  | "onSubPathComplete"    // Save when sub-paths complete
  | "onComplete"           // Save only when the entire wizard completes
  | "manual";              // Never auto-save; call save() explicitly

export interface PathEngineWithStoreOptions {
  /**
   * The storage key to use for this wizard.
   * Example: "user:123:onboarding" or "document:456"
   */
  key: string;

  /**
   * The HttpStore instance to use for persistence.
   */
  store: HttpStore;

  /**
   * When to automatically persist state. Defaults to "onNext".
   */
  persistenceStrategy?: PersistenceStrategy;

  /**
   * Debounce time in milliseconds. If > 0, saves are debounced to avoid
   * excessive API calls. Defaults to 0 (no debouncing).
   */
  debounceMs?: number;

  /**
   * Called when a save operation fails. The wrapper will continue to
   * function normally even if saves fail.
   */
  onSaveError?: (error: Error) => void;

  /**
   * Called after a successful save operation.
   */
  onSaveSuccess?: () => void;
}

/**
 * Wraps a PathEngine with automatic persistence to an HttpStore.
 * 
 * Usage:
 * ```ts
 * const store = new HttpStore({ baseUrl: "/api/wizard" });
 * const wrapper = new PathEngineWithStore({
 *   key: "user:123:onboarding",
 *   store,
 *   persistenceStrategy: "onNext",
 *   debounceMs: 500,
 * });
 * 
 * // Start fresh or restore from saved state
 * await wrapper.startOrRestore(myPath, myPathDefinitions);
 * 
 * // Use the engine normally
 * await wrapper.next();
 * await wrapper.setData("name", "Alice");
 * 
 * // State is automatically persisted based on strategy
 * ```
 */
export class PathEngineWithStore {
  private engine: PathEngine | null = null;
  private unsubscribe: (() => void) | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingSave: Promise<void> | null = null;

  constructor(private options: PathEngineWithStoreOptions) {
    this.options.persistenceStrategy ??= "onNext";
    this.options.debounceMs ??= 0;
  }

  /**
   * Loads saved state from the store and restores the engine, or starts
   * a fresh path if no saved state exists.
   * 
   * @param path The path definition to start (if no saved state)
   * @param pathDefinitions Map of all path definitions (for restoration)
   * @param initialData Initial data if starting fresh
   */
  async startOrRestore(
    path: PathDefinition,
    pathDefinitions: Record<string, PathDefinition>,
    initialData?: PathData
  ): Promise<void> {
    // Import PathEngine here to avoid circular dependency issues
    const { PathEngine } = await import("@daltonr/pathwrite-core");

    // Clean up previous engine if any
    this.cleanup();

    // Try to load saved state
    const saved = await this.options.store.load(this.options.key);

    if (saved) {
      // Restore from saved state
      this.engine = PathEngine.fromState(saved, pathDefinitions);
    } else {
      // Start fresh
      this.engine = new PathEngine();
      await this.engine.start(path, initialData);
    }

    // Subscribe to events for auto-persistence
    this.unsubscribe = this.engine.subscribe((event) => {
      this.handleEvent(event);
    });
  }

  /**
   * Get the underlying PathEngine instance. Use this to call navigation
   * methods like next(), previous(), setData(), etc.
   */
  getEngine(): PathEngine {
    if (!this.engine) {
      throw new Error("Engine not initialized. Call startOrRestore() first.");
    }
    return this.engine;
  }

  /**
   * Manually trigger a save operation. Useful when persistenceStrategy is "manual"
   * or when you want to force a save at a specific point.
   */
  async save(): Promise<void> {
    if (!this.engine) return;

    const state = this.engine.exportState();
    if (!state) return; // No active path

    try {
      await this.options.store.save(this.options.key, state);
      this.options.onSaveSuccess?.();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.options.onSaveError?.(err);
    }
  }

  /**
   * Delete the saved state from the store.
   */
  async deleteSavedState(): Promise<void> {
    await this.options.store.delete(this.options.key);
  }

  /**
   * Wait for any pending save operations to complete.
   * Useful for testing or ensuring data is persisted before critical operations.
   */
  async waitForPendingSave(): Promise<void> {
    if (this.saveTimer) {
      // Force the debounced save to execute now
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
      await this.save();
    }
    
    if (this.pendingSave) {
      await this.pendingSave;
    }
  }

  /**
   * Clean up resources (unsubscribe from events, cancel pending saves).
   * Call this when unmounting the component or before creating a new wrapper.
   */
  cleanup(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;

    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }

    this.engine = null;
  }

  private handleEvent(event: PathEvent): void {
    const strategy = this.options.persistenceStrategy!;

    let shouldSave = false;

    switch (strategy) {
      case "onEveryChange":
        shouldSave = event.type === "stateChanged" || event.type === "resumed";
        break;

      case "onNext":
        // Save on stateChanged events that represent forward navigation
        // We can detect this by checking if the event happened after a next() call
        // For simplicity, we'll save on all stateChanged for now
        // A more sophisticated approach would track the last operation
        shouldSave = event.type === "stateChanged";
        break;

      case "onSubPathComplete":
        shouldSave = event.type === "resumed"; // Sub-path completed and resumed parent
        break;

      case "onComplete":
        // Special handling for onComplete - save the final state from the completed event
        if (event.type === "completed") {
          // Build a final SerializedPathState from the completed event data
          // This is mainly for record-keeping, not for restoration
          const finalState: import("@daltonr/pathwrite-core").SerializedPathState = {
            version: 1,
            pathId: event.pathId,
            currentStepIndex: -1, // Wizard is complete
            data: event.data,
            visitedStepIds: [],
            pathStack: [],
            _isNavigating: false,
          };

          // Save the final state
          this.options.store.save(this.options.key, finalState)
            .then(() => this.options.onSaveSuccess?.())
            .catch((error) => {
              const err = error instanceof Error ? error : new Error(String(error));
              this.options.onSaveError?.(err);
            });
        }
        break;

      case "manual":
        shouldSave = false;
        break;
    }

    if (shouldSave) {
      this.scheduleSave();
    }

    // Delete saved state when wizard completes (unless strategy is onComplete, which saves the final record)
    if (event.type === "completed" && strategy !== "onComplete") {
      this.deleteSavedState().catch((err) => {
        console.warn("Failed to delete saved state after completion:", err);
      });
    }
  }

  private scheduleSave(): void {
    if (this.options.debounceMs! > 0) {
      // Debounced save
      if (this.saveTimer) {
        clearTimeout(this.saveTimer);
      }

      this.saveTimer = setTimeout(() => {
        this.saveTimer = null;
        this.performSave();
      }, this.options.debounceMs);
    } else {
      // Immediate save
      this.performSave();
    }
  }

  private performSave(): Promise<void> {
    // Avoid overlapping saves
    if (this.pendingSave) return this.pendingSave;

    this.pendingSave = this.save().finally(() => {
      this.pendingSave = null;
    });

    return this.pendingSave;
  }
}
