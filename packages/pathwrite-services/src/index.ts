// ---------------------------------------------------------------------------
// @daltonr/pathwrite-services
//
// Wraps plain async service functions with declarative caching, in-flight
// deduplication, configurable retry, and prefetch — without any dependency
// on the rest of the Pathwrite ecosystem.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Storage interface
//
// DESIGN NOTE — duck-typing, not import:
//   @daltonr/pathwrite-store exports StorageAdapter (sync) and
//   AsyncStorageAdapter (async), which mirror these interfaces exactly.
//   We intentionally redeclare them here rather than importing from that
//   package so that @daltonr/pathwrite-services has zero hard dependencies.
//   Any object that satisfies ServiceCacheStorage will work, including the
//   store package's adapters, a plain object, or a test double.
//   See docs/guides/DEFINE_SERVICES.md for rationale and migration guidance.
// ---------------------------------------------------------------------------

/** Synchronous key-value store (e.g. localStorage, sessionStorage). */
export interface SyncServiceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Asynchronous key-value store (e.g. React Native AsyncStorage). */
export interface AsyncServiceStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** Union accepted by defineServices — sync or async storage. */
export type ServiceCacheStorage = SyncServiceStorage | AsyncServiceStorage;

// ---------------------------------------------------------------------------
// Cache policy
// ---------------------------------------------------------------------------

export type CachePolicy = "auto" | "none";

// ---------------------------------------------------------------------------
// Per-method configuration
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => Promise<any>;

export interface ServiceMethodConfig<F extends AnyFn> {
  /** The underlying async function to wrap. */
  fn: F;
  /**
   * Cache strategy:
   *   "auto"  — cache the first successful result, return it on subsequent
   *             calls with the same serialised arguments. In-flight requests
   *             for the same key are deduplicated.
   *   "none"  — always call through; no caching, no deduplication.
   */
  cache: CachePolicy;
  /**
   * Number of retry attempts on failure (default 0 = no retry).
   * Retries use exponential back-off: 200 ms × 2^attempt.
   */
  retry?: number;
}

// ---------------------------------------------------------------------------
// defineServices input / output types
// ---------------------------------------------------------------------------

type ServiceConfig<T extends Record<string, AnyFn>> = {
  [K in keyof T]: ServiceMethodConfig<T[K]>;
};

export interface DefineServicesOptions {
  /**
   * Optional persistent storage for the in-memory cache.
   * On startup, cached values are rehydrated from storage before any
   * network calls are made.  Accepts both sync and async adapters.
   *
   * Compatible with @daltonr/pathwrite-store's StorageAdapter and
   * AsyncStorageAdapter via duck-typing — no import needed.
   */
  storage?: ServiceCacheStorage;
  /**
   * Prefix prepended to every storage key (default: "pw-svc:").
   * Set this to namespace entries when multiple service objects share
   * the same storage instance.
   */
  keyPrefix?: string;
}

/**
 * Thrown when all retry attempts for a service method have been exhausted.
 */
export class ServiceUnavailableError extends Error {
  constructor(
    public readonly method: string,
    public readonly attempts: number,
    public readonly cause: unknown
  ) {
    super(`Service method "${method}" failed after ${attempts} attempt(s).`);
    this.name = "ServiceUnavailableError";
  }
}

// ---------------------------------------------------------------------------
// Prefetch manifest
// ---------------------------------------------------------------------------

/**
 * Specifies which method/argument combinations to warm during prefetch().
 *
 * Keys are method names. Values are either:
 *   - undefined / omitted — call with no arguments (zero-arg methods)
 *   - an array of argument arrays — call once per entry
 *
 * Example:
 *   { getRoles: undefined, getRoleDetail: [["eng-1"], ["eng-2"]] }
 */
export type PrefetchManifest<T extends Record<string, AnyFn>> = {
  [K in keyof T]?: Parameters<T[K]>[] | undefined;
};

// ---------------------------------------------------------------------------
// Return type augmented with prefetch()
// ---------------------------------------------------------------------------

export type DefinedServices<T extends Record<string, AnyFn>> = T & {
  /**
   * Pre-warm the in-memory (and persistent) cache.
   *
   * Without a manifest: calls every zero-argument "auto" method once.
   * With a manifest: calls each listed method with the supplied arg sets.
   *
   * Errors are swallowed — a failed prefetch never rejects the caller.
   */
  prefetch(manifest?: PrefetchManifest<T>): Promise<void>;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isAsyncStorage(s: ServiceCacheStorage): s is AsyncServiceStorage {
  return s.getItem.length === 1 && s.getItem("__probe__") instanceof Object;
}

async function storageGet(
  storage: ServiceCacheStorage,
  key: string
): Promise<string | null> {
  const result = storage.getItem(key);
  if (result instanceof Promise) return result;
  return result;
}

async function storageSet(
  storage: ServiceCacheStorage,
  key: string,
  value: string
): Promise<void> {
  const result = storage.setItem(key, value);
  if (result instanceof Promise) await result;
}

function serializeArgs(args: unknown[]): string {
  try {
    return JSON.stringify(args);
  } catch {
    // Non-serialisable args (functions, circular refs) get a best-effort key.
    return args.map(String).join(",");
  }
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  methodName: string
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 200 * Math.pow(2, attempt)));
      }
    }
  }
  throw new ServiceUnavailableError(methodName, maxRetries + 1, lastErr);
}

// ---------------------------------------------------------------------------
// defineServices
// ---------------------------------------------------------------------------

/**
 * Wraps a set of async service methods with caching, deduplication, and retry.
 *
 * @example
 * ```ts
 * const services = defineServices(
 *   {
 *     getRoles:    { fn: api.getRoles,    cache: 'auto' },
 *     getUser:     { fn: api.getUser,     cache: 'auto', retry: 2 },
 *     submitForm:  { fn: api.submitForm,  cache: 'none' },
 *   },
 *   { storage: localStorage, keyPrefix: 'myapp:svc:' }
 * );
 *
 * await services.prefetch();          // warm zero-arg cached methods
 * const roles = await services.getRoles();
 * ```
 */
export function defineServices<T extends Record<string, AnyFn>>(
  config: ServiceConfig<T>,
  options: DefineServicesOptions = {}
): DefinedServices<T> {
  const { storage, keyPrefix = "pw-svc:" } = options;

  // In-memory value cache: cacheKey → resolved value
  const memCache = new Map<string, unknown>();

  // In-flight deduplication: cacheKey → pending Promise
  const inFlight = new Map<string, Promise<unknown>>();

  // Rehydrate from storage synchronously where possible.
  // Async storage is hydrated lazily on first access.
  if (storage) {
    const syncStorage = storage as SyncServiceStorage;
    if (typeof syncStorage.getItem === "function") {
      try {
        // Attempt synchronous hydration (works for localStorage etc.)
        for (const [methodName, methodConfig] of Object.entries(config)) {
          if (methodConfig.cache !== "auto") continue;
          const baseKey = `${keyPrefix}${methodName}`;
          const raw = syncStorage.getItem(baseKey);
          if (raw !== null && !(raw instanceof Promise)) {
            try {
              memCache.set(baseKey, JSON.parse(raw));
            } catch {
              // Corrupt entry — ignore, will be refreshed on next call.
            }
          }
        }
      } catch {
        // Storage unavailable — proceed without hydration.
      }
    }
  }

  function cacheKey(methodName: string, args: unknown[]): string {
    return args.length === 0
      ? `${keyPrefix}${methodName}`
      : `${keyPrefix}${methodName}:${serializeArgs(args)}`;
  }

  async function callMethod(
    methodName: string,
    methodConfig: ServiceMethodConfig<AnyFn>,
    args: unknown[]
  ): Promise<unknown> {
    if (methodConfig.cache === "none") {
      return withRetry(() => methodConfig.fn(...args), methodConfig.retry ?? 0, methodName);
    }

    const key = cacheKey(methodName, args);

    // Return from memory cache if available.
    if (memCache.has(key)) {
      return memCache.get(key);
    }

    // Async storage hydration (for async adapters like RN AsyncStorage).
    if (storage) {
      const existing = await storageGet(storage, key);
      if (existing !== null) {
        try {
          const parsed = JSON.parse(existing);
          memCache.set(key, parsed);
          return parsed;
        } catch {
          // Corrupt — fall through to network call.
        }
      }
    }

    // Deduplicate in-flight requests for the same key.
    if (inFlight.has(key)) {
      return inFlight.get(key);
    }

    const promise = withRetry(
      () => methodConfig.fn(...args),
      methodConfig.retry ?? 0,
      methodName
    )
      .then(async (value) => {
        memCache.set(key, value);
        inFlight.delete(key);
        if (storage) {
          try {
            await storageSet(storage, key, JSON.stringify(value));
          } catch {
            // Storage write failure is non-fatal.
          }
        }
        return value;
      })
      .catch((err) => {
        inFlight.delete(key);
        throw err;
      });

    inFlight.set(key, promise);
    return promise;
  }

  // Build the wrapped service object.
  const wrapped: Record<string, AnyFn> = {};

  for (const [methodName, methodConfig] of Object.entries(config)) {
    wrapped[methodName] = (...args: unknown[]) =>
      callMethod(methodName, methodConfig as ServiceMethodConfig<AnyFn>, args);
  }

  // Prefetch helper.
  wrapped.prefetch = async (manifest?: PrefetchManifest<T>): Promise<void> => {
    const tasks: Promise<unknown>[] = [];

    if (manifest) {
      for (const [methodName, argSets] of Object.entries(manifest) as [
        string,
        Parameters<AnyFn>[] | undefined
      ][]) {
        const methodConfig = config[methodName];
        if (!methodConfig || methodConfig.cache === "none") continue;

        if (!argSets || argSets.length === 0) {
          tasks.push(callMethod(methodName, methodConfig, []));
        } else {
          for (const argSet of argSets) {
            tasks.push(callMethod(methodName, methodConfig, argSet));
          }
        }
      }
    } else {
      // No manifest: prefetch all zero-arg "auto" methods.
      for (const [methodName, methodConfig] of Object.entries(config)) {
        if (methodConfig.cache !== "auto" || methodConfig.fn.length > 0) continue;
        tasks.push(callMethod(methodName, methodConfig, []));
      }
    }

    // Errors are swallowed — failed prefetch must never reject the caller.
    await Promise.allSettled(tasks);
  };

  return wrapped as DefinedServices<T>;
}
