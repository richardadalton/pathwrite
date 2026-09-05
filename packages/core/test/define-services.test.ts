import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  defineServices,
  ServiceUnavailableError,
} from "@daltonr/pathwrite-core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStorage(): {
  store: Record<string, string>;
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
  removeItem: (k: string) => void;
} {
  const store: Record<string, string> = {};
  return {
    store,
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = v; },
    removeItem: (k) => { delete store[k]; },
  };
}

function makeAsyncStorage(): {
  store: Record<string, string>;
  getItem: (k: string) => Promise<string | null>;
  setItem: (k: string, v: string) => Promise<void>;
  removeItem: (k: string) => Promise<void>;
} {
  const store: Record<string, string> = {};
  return {
    store,
    getItem: (k) => Promise.resolve(k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = v; return Promise.resolve(); },
    removeItem: (k) => { delete store[k]; return Promise.resolve(); },
  };
}

// ---------------------------------------------------------------------------
// Basic call-through
// ---------------------------------------------------------------------------

describe("defineServices — basic", () => {
  it("calls the underlying fn and returns its value", async () => {
    const fn = vi.fn().mockResolvedValue([1, 2, 3]);
    const svc = defineServices({ getItems: { fn, cache: "none" } });
    const result = await svc.getItems();
    expect(result).toEqual([1, 2, 3]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("passes arguments through to fn", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const svc = defineServices({ fetchById: { fn, cache: "none" } });
    await svc.fetchById("abc", 42);
    expect(fn).toHaveBeenCalledWith("abc", 42);
  });
});

// ---------------------------------------------------------------------------
// cache: 'auto' — in-memory
// ---------------------------------------------------------------------------

describe("defineServices — cache: 'auto' (in-memory)", () => {
  it("returns cached value on second call without calling fn again", async () => {
    const fn = vi.fn().mockResolvedValue(["role-1"]);
    const svc = defineServices({ getRoles: { fn, cache: "auto" } });

    const r1 = await svc.getRoles();
    const r2 = await svc.getRoles();

    expect(r1).toEqual(["role-1"]);
    expect(r2).toEqual(["role-1"]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("caches per distinct arguments", async () => {
    const fn = vi.fn((id: string) => Promise.resolve({ id }));
    const svc = defineServices({ getUser: { fn, cache: "auto" } });

    await svc.getUser("alice");
    await svc.getUser("bob");
    await svc.getUser("alice");

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does NOT cache when cache is 'none'", async () => {
    const fn = vi.fn().mockResolvedValue("fresh");
    const svc = defineServices({ submit: { fn, cache: "none" } });

    await svc.submit();
    await svc.submit();

    expect(fn).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// In-flight deduplication
// ---------------------------------------------------------------------------

describe("defineServices — in-flight deduplication", () => {
  it("only makes one network request when called concurrently", async () => {
    let resolveFirst!: (v: string[]) => void;
    const fn = vi.fn(() => new Promise<string[]>((res) => { resolveFirst = res; }));
    const svc = defineServices({ getRoles: { fn, cache: "auto" } });

    const p1 = svc.getRoles();
    const p2 = svc.getRoles();
    const p3 = svc.getRoles();

    resolveFirst(["r1", "r2"]);

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
    expect(r1).toEqual(["r1", "r2"]);
    expect(r2).toEqual(["r1", "r2"]);
    expect(r3).toEqual(["r1", "r2"]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("removes the in-flight entry after the promise resolves", async () => {
    const fn = vi.fn().mockResolvedValue("val");
    const svc = defineServices({ get: { fn, cache: "auto" } });

    await svc.get();
    // Second call should hit memory cache, not create a new in-flight.
    await svc.get();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Retry
// ---------------------------------------------------------------------------

describe("defineServices — retry", () => {
  // The retry backoff waits on setTimeout; fake timers keep these tests instant.
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  /** Await a call while draining every backoff timer it schedules. */
  async function settle<T>(call: Promise<T>): Promise<T> {
    const guarded = call.catch((e: unknown) => ({ __rejected: e }));
    await vi.runAllTimersAsync();
    const r = await guarded;
    if (r && typeof r === "object" && "__rejected" in (r as object)) throw (r as { __rejected: unknown }).__rejected;
    return r as T;
  }

  it("retries on failure and succeeds if fn eventually resolves", async () => {
    let calls = 0;
    const fn = vi.fn(() => {
      calls++;
      if (calls < 3) return Promise.reject(new Error("transient"));
      return Promise.resolve("ok");
    });
    const svc = defineServices({ load: { fn, cache: "none", retry: 3 } });
    expect(await settle(svc.load())).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws ServiceUnavailableError when all retries exhausted", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("network down"));
    const svc = defineServices({ load: { fn, cache: "none", retry: 2 } });
    await expect(settle(svc.load())).rejects.toBeInstanceOf(ServiceUnavailableError);
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("ServiceUnavailableError exposes method name and attempt count", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    const svc = defineServices({ fetchData: { fn, cache: "none", retry: 1 } });
    const err = await settle(svc.fetchData()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableError);
    expect((err as ServiceUnavailableError).method).toBe("fetchData");
    expect((err as ServiceUnavailableError).attempts).toBe(2);
  });

  it("clears in-flight entry on failure", async () => {
    let callCount = 0;
    const fn = vi.fn(() => {
      callCount++;
      return callCount === 1
        ? Promise.reject(new Error("first call fails"))
        : Promise.resolve("second ok");
    });
    const svc = defineServices({ get: { fn, cache: "auto" } });

    await expect(svc.get()).rejects.toThrow();
    // After failure, a new call should reach the network again.
    const result = await svc.get();
    expect(result).toBe("second ok");
  });
});

// ---------------------------------------------------------------------------
// Persistent storage — sync
// ---------------------------------------------------------------------------

describe("defineServices — sync storage", () => {
  it("persists a cached value to storage after first call", async () => {
    const storage = makeStorage();
    const fn = vi.fn().mockResolvedValue(["role-1"]);
    const svc = defineServices(
      { getRoles: { fn, cache: "auto" } },
      { storage, keyPrefix: "test:" }
    );

    await svc.getRoles();
    expect(storage.store["test:getRoles"]).toBe(JSON.stringify(["role-1"]));
  });

  it("rehydrates memory cache from storage on creation", async () => {
    const storage = makeStorage();
    storage.store["pw-svc:getRoles"] = JSON.stringify(["cached-role"]);

    const fn = vi.fn().mockResolvedValue(["fresh-role"]);
    const svc = defineServices({ getRoles: { fn, cache: "auto" } }, { storage });

    const result = await svc.getRoles();
    expect(result).toEqual(["cached-role"]);
    expect(fn).not.toHaveBeenCalled();
  });

  it("ignores corrupt storage entries and fetches fresh", async () => {
    const storage = makeStorage();
    storage.store["pw-svc:getRoles"] = "not-valid-json{{{";

    const fn = vi.fn().mockResolvedValue(["fresh"]);
    const svc = defineServices({ getRoles: { fn, cache: "auto" } }, { storage });

    const result = await svc.getRoles();
    expect(result).toEqual(["fresh"]);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Persistent storage — async
// ---------------------------------------------------------------------------

describe("defineServices — async storage", () => {
  it("persists a cached value to async storage after first call", async () => {
    const storage = makeAsyncStorage();
    const fn = vi.fn().mockResolvedValue({ id: 1 });
    const svc = defineServices(
      { getProfile: { fn, cache: "auto" } },
      { storage, keyPrefix: "rn:" }
    );

    await svc.getProfile();
    expect(storage.store["rn:getProfile"]).toBe(JSON.stringify({ id: 1 }));
  });

  it("reads from async storage on cache miss", async () => {
    const storage = makeAsyncStorage();
    storage.store["pw-svc:getProfile"] = JSON.stringify({ id: 99 });

    const fn = vi.fn().mockResolvedValue({ id: 1 });
    const svc = defineServices({ getProfile: { fn, cache: "auto" } }, { storage });

    const result = await svc.getProfile();
    expect(result).toEqual({ id: 99 });
    expect(fn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// prefetch()
// ---------------------------------------------------------------------------

describe("defineServices — prefetch()", () => {
  it("prefetches all zero-arg 'auto' methods when called without manifest", async () => {
    const fn1 = vi.fn().mockResolvedValue([]);
    const fn2 = vi.fn().mockResolvedValue([]);
    const fn3 = vi.fn().mockResolvedValue([]);
    const svc = defineServices({
      getRoles:   { fn: fn1, cache: "auto" },
      getCountry: { fn: fn2, cache: "auto" },
      submit:     { fn: fn3, cache: "none" },
    });

    await svc.prefetch();

    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).toHaveBeenCalledTimes(1);
    expect(fn3).not.toHaveBeenCalled(); // cache: 'none' skipped
  });

  it("does not re-fetch already cached values during prefetch", async () => {
    const fn = vi.fn().mockResolvedValue(["r"]);
    const svc = defineServices({ getRoles: { fn, cache: "auto" } });

    await svc.getRoles(); // primes cache
    await svc.prefetch();

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("prefetches specific methods and arg sets from manifest", async () => {
    const fn = vi.fn((id: string) => Promise.resolve({ id }));
    const svc = defineServices({ getUser: { fn, cache: "auto" } });

    await svc.prefetch({ getUser: [["alice"], ["bob"]] });

    expect(fn).toHaveBeenCalledWith("alice");
    expect(fn).toHaveBeenCalledWith("bob");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("swallows errors during prefetch", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("network error"));
    const svc = defineServices({ getRoles: { fn, cache: "auto" } });

    await expect(svc.prefetch()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Type safety smoke-test (compile-time, not runtime)
// ---------------------------------------------------------------------------

describe("defineServices — type shape", () => {
  it("exposes all configured method names on the returned object", () => {
    const svc = defineServices({
      alpha: { fn: async () => 1, cache: "auto" },
      beta:  { fn: async (_x: string) => "ok", cache: "none" },
    });
    expect(typeof svc.alpha).toBe("function");
    expect(typeof svc.beta).toBe("function");
    expect(typeof svc.prefetch).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// Edge cases (review): async storage pre-hydration, reserved names,
// undefined results, failing cache storage
// ---------------------------------------------------------------------------

describe("defineServices — edge cases", () => {
  function makeAsyncStorage(seed: Record<string, string> = {}, opts: { failGet?: boolean } = {}) {
    const store: Record<string, string> = { ...seed };
    return {
      store,
      getItem: vi.fn(async (k: string) => { if (opts.failGet) throw new Error("storage down"); return k in store ? store[k] : null; }),
      setItem: vi.fn(async (k: string, v: string) => { store[k] = v; }),
      removeItem: vi.fn(async (k: string) => { delete store[k]; })
    };
  }
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it("pre-hydrates from an async storage without discarding the promise (and without an unhandled rejection)", async () => {
    const storage = makeAsyncStorage({ "pw-svc:config": JSON.stringify({ theme: "dark" }) });
    const fn = vi.fn(async () => ({ theme: "fresh" }));
    const svc = defineServices({ config: { fn, cache: "auto" } }, { storage });
    await flush();
    expect(await svc.config()).toEqual({ theme: "dark" }); // served from the hydrated cache
    expect(fn).not.toHaveBeenCalled();
  });

  it("a rejecting async storage during pre-hydration is swallowed", async () => {
    const rejections: unknown[] = [];
    const onRejection = (e: unknown) => rejections.push(e);
    process.on("unhandledRejection", onRejection);
    try {
      const storage = makeAsyncStorage({}, { failGet: true });
      const fn = vi.fn(async () => 1);
      const svc = defineServices({ n: { fn, cache: "auto" } }, { storage });
      await flush();
      expect(await svc.n()).toBe(1); // the failing cache read falls through to fn
      await flush();
      expect(rejections).toHaveLength(0);
    } finally {
      process.off("unhandledRejection", onRejection);
    }
  });

  it("rejects a method named prefetch at definition time", () => {
    expect(() => defineServices({ prefetch: { fn: async () => 1, cache: "none" } } as any)).toThrow(/prefetch/);
  });

  it("does not persist an undefined result as the string 'undefined'", async () => {
    const storage = makeAsyncStorage();
    const fn = vi.fn(async () => undefined);
    const svc = defineServices({ nothing: { fn, cache: "auto" } }, { storage });
    expect(await svc.nothing()).toBeUndefined();
    expect(await svc.nothing()).toBeUndefined();
    expect(fn).toHaveBeenCalledTimes(1);           // in-memory cache still works
    expect(storage.setItem).not.toHaveBeenCalled(); // nothing written to storage
    expect(Object.values(storage.store)).not.toContain("undefined");

    // A fresh instance over the same storage must not choke on anything left behind
    const fn2 = vi.fn(async () => undefined);
    const svc2 = defineServices({ nothing: { fn: fn2, cache: "auto" } }, { storage });
    expect(await svc2.nothing()).toBeUndefined();
  });

  it("prefetch() without a manifest calls methods whose parameters are all optional, and skips those with required ones", async () => {
    const noArgs = vi.fn(async () => "a");
    const withDefault = vi.fn(async (opts: { verbose?: boolean } = {}) => `b:${String(opts.verbose)}`);
    const withRest = vi.fn(async (..._ids: string[]) => "c");
    const required = vi.fn(async (id: string) => `d:${id}`);
    const svc = defineServices({
      noArgs: { fn: noArgs, cache: "auto" },
      withDefault: { fn: withDefault, cache: "auto" },
      withRest: { fn: withRest, cache: "auto" },
      required: { fn: required, cache: "auto" }
    });
    await svc.prefetch();
    expect(noArgs).toHaveBeenCalledTimes(1);
    expect(withDefault).toHaveBeenCalledTimes(1);
    expect(withRest).toHaveBeenCalledTimes(1);
    expect(required).not.toHaveBeenCalled();
  });
});
