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
  /** `credentials` for every request (e.g. `"include"` to send cookies cross-origin). */
  credentials?: RequestCredentials;
  /** An `AbortSignal` that cancels every request when aborted (e.g. on navigation away). */
  signal?: AbortSignal;
  /** Abort any single request that takes longer than this many milliseconds. */
  timeoutMs?: number;
}

export class HttpStore implements PathStore {
  private options: Required<
    Omit<HttpStoreOptions, "headers" | "onError" | "credentials" | "signal" | "timeoutMs">
  > &
    Pick<HttpStoreOptions, "headers" | "onError" | "credentials" | "signal" | "timeoutMs">;

  constructor(options: HttpStoreOptions) {
    const baseUrl = options.baseUrl.replace(/\/$/, "");

    this.options = {
      baseUrl,
      saveUrl: options.saveUrl ?? ((key) => `${baseUrl}/state/${encodeURIComponent(key)}`),
      loadUrl: options.loadUrl ?? ((key) => `${baseUrl}/state/${encodeURIComponent(key)}`),
      deleteUrl: options.deleteUrl ?? ((key) => `${baseUrl}/state/${encodeURIComponent(key)}`),
      fetch: options.fetch ?? fetch.bind(globalThis),
      headers: options.headers,
      credentials: options.credentials,
      signal: options.signal,
      timeoutMs: options.timeoutMs,
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

  /**
   * Merges the request defaults with the user's headers into a `Headers`
   * object. `HeadersInit` may be a plain object, an array of `[name, value]`
   * tuples or a `Headers` instance; spreading the latter two into an object
   * literal yields nothing (a `Headers` instance has no own enumerable
   * properties), which silently dropped auth headers. Going through `Headers`
   * handles every form, and user headers override the defaults as before.
   */
  private async buildHeaders(defaults: Record<string, string>): Promise<Headers> {
    const merged = new Headers(defaults);
    new Headers(await this.getHeaders()).forEach((value, name) => merged.set(name, value));
    return merged;
  }

  /**
   * Runs one request with the store's `credentials`, the caller's `signal` and
   * the `timeoutMs` budget applied. The timeout and the external signal are
   * combined into one `AbortSignal`; the timer is cleared when the request
   * settles so it never fires afterwards.
   */
  private async request(url: string, init: RequestInit): Promise<Response> {
    const { credentials, signal, timeoutMs } = this.options;
    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let detach: (() => void) | null = null;
    if (signal || timeoutMs) {
      controller = new AbortController();
      if (signal) {
        if (signal.aborted) controller.abort(signal.reason);
        else {
          const onAbort = () => controller!.abort(signal.reason);
          signal.addEventListener("abort", onAbort, { once: true });
          detach = () => signal.removeEventListener("abort", onAbort);
        }
      }
      if (timeoutMs) {
        timer = setTimeout(
          () => controller!.abort(new Error(`HttpStore: request timed out after ${timeoutMs} ms`)),
          timeoutMs
        );
      }
    }
    try {
      // Mirror fetch(): a request started with an already-aborted signal
      // rejects at once, whatever the fetch implementation does.
      if (controller?.signal.aborted)
        throw controller.signal.reason ?? new Error("HttpStore: request aborted");
      return await this.options.fetch(url, {
        ...init,
        ...(credentials ? { credentials } : {}),
        ...(controller ? { signal: controller.signal } : {}),
      });
    } finally {
      if (timer) clearTimeout(timer);
      detach?.();
    }
  }

  async save(key: string, state: SerializedPathState): Promise<void> {
    try {
      const url = this.options.saveUrl(key);
      const response = await this.request(url, {
        method: "PUT",
        headers: await this.buildHeaders({ "Content-Type": "application/json" }),
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
      const response = await this.request(url, {
        method: "GET",
        headers: await this.buildHeaders({ "Content-Type": "application/json" }),
      });
      if (response.status === 404 || response.status === 204) return null;
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      // Read as text so an empty body ("no record") is distinguishable from a
      // corrupt one; `json()` would throw the same SyntaxError for both.
      const raw =
        typeof response.text === "function" ? await response.text() : JSON.stringify(await response.json());
      if (raw.trim() === "") return null;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error(`HttpStore.load: the response for "${key}" is not valid JSON.`);
      }
      if (parsed === null) return null; // a JSON `null` body: nothing stored
      const problem = describeInvalidState(parsed);
      if (problem) {
        throw new Error(
          `HttpStore.load: the response for "${key}" is not a SerializedPathState (${problem}).`
        );
      }
      return parsed as SerializedPathState;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.options.onError?.(err, "load", key);
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const url = this.options.deleteUrl(key);
      const response = await this.request(url, {
        method: "DELETE",
        headers: await this.buildHeaders({}),
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
/**
 * The observer returned by `persistence()`: a `PathObserver` with two extra
 * methods for host components and page-unload handlers.
 */
export interface PersistenceObserver extends PathObserver {
  /**
   * Save now. Cancels a pending debounce window, writes the engine's current
   * state if anything changed since the last save (or if the strategy is
   * `"manual"`), and resolves once every queued store operation has landed.
   * Call it from `beforeunload` / `visibilitychange` handlers or before a
   * host component unmounts. Resolves immediately when no engine has been
   * seen yet.
   */
  flush(): Promise<void>;
  /**
   * Stop persisting. Cancels a pending debounce window and ignores every
   * later event, so a timer never outlives the host component. Does not wait
   * for in-flight saves; call `flush()` first if you need them.
   */
  dispose(): void;
}

export function persistence(options: PersistenceOptions): PersistenceObserver {
  const strategy = options.strategy ?? "onNext";
  const debounceMs = options.debounceMs ?? 0;

  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  // All store operations for this key run one at a time, in the order they
  // were requested, whatever the store's own latency. Two things depend on it:
  //
  // - A save requested while one is on the wire must run *after* it, with the
  //   engine's state as it is then; the in-flight save carries older state and
  //   exports happen when a save starts. Several such requests collapse into a
  //   single follow-up (`saveQueued`).
  // - The delete issued on completion must land before any save of the next
  //   session. With `completionBehaviour: "reset"` the engine restarts (and
  //   saves) immediately after emitting `completed`; an unserialised DELETE
  //   that finished after that PUT wiped the new session.
  let queue: Promise<void> = Promise.resolve();
  let saveQueued = false;
  // For flush(): the engine the observer is attached to, whether the engine
  // has changed since the last export, and whether dispose() has been called.
  let lastEngine: PathEngine | null = null;
  let changedSinceSave = false;
  let disposed = false;

  /** Runs `op` after every previously queued operation, whether they succeeded or not. */
  const enqueue = (op: () => Promise<void>): Promise<void> => {
    queue = queue.then(op, op);
    return queue;
  };

  const performSave = (engine: PathEngine): Promise<void> => {
    // A save is already waiting its turn; when it runs it exports the state
    // current at that moment, so this request is covered by it.
    if (saveQueued) return queue;
    saveQueued = true;
    return enqueue(async () => {
      saveQueued = false;
      changedSinceSave = false;
      const state = engine.exportState();
      if (!state) return;
      try {
        await options.store.save(options.key, state);
        options.onSaveSuccess?.();
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        options.onSaveError?.(err);
      }
    });
  };

  const performDelete = (): Promise<void> =>
    enqueue(() =>
      options.store.delete(options.key).catch((err) => {
        console.warn("[pathwrite] Failed to delete saved state after completion:", err);
      })
    );

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

  const observer = ((event: PathEvent, engine: PathEngine): void => {
    if (disposed) return;
    lastEngine = engine;
    if (event.type === "stateChanged" || event.type === "resumed") changedSinceSave = true;

    if (strategy === "onComplete") {
      if (event.type === "completed") {
        // An audit record of the finished path. It is a valid
        // SerializedPathState (so nothing that loads it can crash) and is
        // marked "completed" so restoreOrStart knows to start fresh rather
        // than resume it. The engine still holds the finished path for
        // "stayOnFinal" / "reset"; for "dismiss" it is already gone, so the
        // record is synthesised from the event.
        const exported = engine.exportState();
        const finalState: SerializedPathState = {
          ...(exported ?? {
            version: 1 as const,
            pathId: event.pathId,
            currentStepIndex: 0,
            visitedStepIds: [],
            pathStack: [],
          }),
          data: event.data,
          _status: "completed",
        };
        options.store
          .save(options.key, finalState)
          .then(() => options.onSaveSuccess?.())
          .catch((error) => {
            const err = error instanceof Error ? error : new Error(String(error));
            options.onSaveError?.(err);
          });
      }
      return;
    }

    if (matchesStrategy(strategy, event)) scheduleSave(engine);

    if (event.type === "completed") performDelete();
  }) as PersistenceObserver;

  observer.flush = async (): Promise<void> => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
      changedSinceSave = true; // the debounced save never ran
    }
    if (lastEngine && !disposed && (changedSinceSave || strategy === "manual")) {
      void performSave(lastEngine);
    }
    await queue;
  };

  observer.dispose = (): void => {
    disposed = true;
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
  };

  return observer;
}

/**
 * Returns a short description of why `value` is not a usable
 * `SerializedPathState`, or `null` when it is. Only the shape `fromState()`
 * dereferences is checked; the engine validates the rest.
 */
function describeInvalidState(value: unknown): string | null {
  if (!value || typeof value !== "object") return "not an object";
  const v = value as Record<string, unknown>;
  if (v.version !== 1) return `unsupported version ${String(v.version)}`;
  if (typeof v.pathId !== "string") return "missing pathId";
  if (typeof v.currentStepIndex !== "number") return "missing currentStepIndex";
  if (!v.data || typeof v.data !== "object") return "missing data";
  if (!Array.isArray(v.visitedStepIds)) return "missing visitedStepIds";
  if (!Array.isArray(v.pathStack)) return "missing pathStack";
  return null;
}

// ---------------------------------------------------------------------------
// restoreOrStart — convenience factory
// ---------------------------------------------------------------------------

export interface RestoreOrStartOptions<TData extends PathData = PathData> {
  /** The store to load saved state from. Any PathStore implementation works. */
  store: PathStore;
  /** Storage key that identifies this path's saved state. */
  key: string;
  /** Path definition to start when no saved state exists. */
  path: PathDefinition<TData>;
  /**
   * Map of all path definitions that may appear in serialized state
   * (active path + any sub-paths). Defaults to `{ [path.id]: path }`.
   */
  pathDefinitions?: Record<string, PathDefinition>;
  /** Initial data for a fresh (non-restored) start. Defaults to `{}`. */
  initialData?: Partial<TData>;
  /**
   * Observers to wire on the engine before the first event fires.
   * Build these explicitly — e.g. `persistence({ store, key })` — and
   * pass them here. `restoreOrStart` does not create any observers itself.
   */
  observers?: PathObserver<TData>[];
  /**
   * Called when saved state exists but cannot be used — the store failed to
   * load it (corrupt JSON, network), its `version` is unsupported, or it
   * references a path id not in `pathDefinitions` (a renamed path). The bad
   * record is deleted (best effort) and the path starts fresh; without this
   * callback the error is logged with `console.warn`.
   */
  onRestoreError?: (error: Error) => void;
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
export async function restoreOrStart<TData extends PathData = PathData>(
  options: RestoreOrStartOptions<TData>
): Promise<{ engine: PathEngine<TData>; restored: boolean }> {
  const observers = options.observers ?? [];
  const pathDefs = options.pathDefinitions ?? { [options.path.id]: options.path };
  // A store is attached in both branches, so tell the engine: shells read
  // snapshot.hasPersistence to offer "your progress is saved, come back
  // later" copy when retries are exhausted.
  const engineOptions = { observers, hasPersistence: true };

  // Saved state that cannot be used must never block the app: the user would
  // be stuck until storage is cleared by hand. Anything that goes wrong
  // between load and a restored engine — corrupt JSON, an unsupported
  // version, a path id that no longer exists — is reported, the record is
  // dropped (best effort) and the path starts fresh.
  try {
    const saved = await options.store.load(options.key);

    // A finished path is never resumed. The "onComplete" strategy leaves its
    // audit record in place (status "completed"; older versions wrote
    // currentStepIndex -1), and a state saved with status "completed" by any
    // other strategy is one whose completion-time delete never landed. Either
    // way the user starts fresh; the record is left for the app to deal with.
    const isFinished = saved !== null && (saved._status === "completed" || saved.currentStepIndex < 0);

    if (saved && !isFinished) {
      const engine = PathEngine.fromState<TData>(saved, pathDefs, engineOptions);
      return { engine, restored: true };
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    if (options.onRestoreError) {
      options.onRestoreError(err);
    } else {
      console.warn(`[pathwrite] Could not restore saved state for "${options.key}"; starting fresh.`, err);
    }
    await options.store.delete(options.key).catch(() => {
      /* best effort */
    });
  }

  const engine = new PathEngine<TData>(engineOptions);
  await engine.start(options.path, options.initialData);
  return { engine, restored: false };
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
