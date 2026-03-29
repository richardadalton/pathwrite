import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  defineServices,
  ServiceUnavailableError,
} from "../src/index.js";

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
  it("retries on failure and succeeds if fn eventually resolves", async () => {
    let calls = 0;
    const fn = vi.fn(() => {
      calls++;
      if (calls < 3) return Promise.reject(new Error("transient"));
      return Promise.resolve("ok");
    });
    const svc = defineServices({ load: { fn, cache: "none", retry: 3 } });
    const result = await svc.load();
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  }, 5000);

  it("throws ServiceUnavailableError when all retries exhausted", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("network down"));
    const svc = defineServices({ load: { fn, cache: "none", retry: 2 } });
    await expect(svc.load()).rejects.toBeInstanceOf(ServiceUnavailableError);
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  }, 5000);

  it("ServiceUnavailableError exposes method name and attempt count", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    const svc = defineServices({ fetchData: { fn, cache: "none", retry: 1 } });
    const err = await svc.fetchData().catch((e) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableError);
    expect((err as ServiceUnavailableError).method).toBe("fetchData");
    expect((err as ServiceUnavailableError).attempts).toBe(2);
  }, 5000);

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
