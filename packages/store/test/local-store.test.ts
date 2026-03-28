import { describe, it, expect, vi, beforeEach } from "vitest";
import { LocalStorageStore } from "../src/local-store";
import type { StorageAdapter } from "../src/local-store";
import type { SerializedPathState, PathDefinition } from "@daltonr/pathwrite-core";
import { PathEngine } from "@daltonr/pathwrite-core";
import { persistence, restoreOrStart } from "../src/index";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockState: SerializedPathState = {
  version: 1,
  pathId: "test-path",
  currentStepIndex: 1,
  data: { name: "Alice", email: "alice@example.com" },
  visitedStepIds: ["step1", "step2"],
  pathStack: [],
  _isNavigating: false,
};

const simplePath: PathDefinition = {
  id: "simple",
  steps: [{ id: "step1" }, { id: "step2" }, { id: "step3" }],
};

function makeStorageSpy(): StorageAdapter & {
  _data: Map<string, string>;
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
  removeItem: ReturnType<typeof vi.fn>;
  getAllKeys: ReturnType<typeof vi.fn>;
} {
  const _data = new Map<string, string>();
  return {
    _data,
    getItem: vi.fn((k: string) => _data.has(k) ? _data.get(k)! : null),
    setItem: vi.fn((k: string, v: string) => { _data.set(k, v); }),
    removeItem: vi.fn((k: string) => { _data.delete(k); }),
    getAllKeys: vi.fn(() => Array.from(_data.keys())),
  };
}

// ---------------------------------------------------------------------------
// Core save / load / delete
// ---------------------------------------------------------------------------

describe("LocalStorageStore — core operations", () => {
  it("save then load returns the original state", async () => {
    const store = new LocalStorageStore();
    await store.save("user:1", mockState);
    const loaded = await store.load("user:1");
    expect(loaded).toEqual(mockState);
  });

  it("load returns null for a key that was never saved", async () => {
    const store = new LocalStorageStore();
    const result = await store.load("nonexistent");
    expect(result).toBeNull();
  });

  it("save then delete then load returns null", async () => {
    const store = new LocalStorageStore();
    await store.save("user:2", mockState);
    await store.delete("user:2");
    const result = await store.load("user:2");
    expect(result).toBeNull();
  });

  it("delete on a non-existent key does not throw", async () => {
    const store = new LocalStorageStore();
    await expect(store.delete("ghost-key")).resolves.toBeUndefined();
  });

  it("overwrites an existing entry on a second save", async () => {
    const store = new LocalStorageStore();
    await store.save("user:3", mockState);
    const updated: SerializedPathState = { ...mockState, currentStepIndex: 2, data: { name: "Bob" } };
    await store.save("user:3", updated);
    const loaded = await store.load("user:3");
    expect(loaded?.currentStepIndex).toBe(2);
    expect(loaded?.data.name).toBe("Bob");
  });

  it("different keys do not collide", async () => {
    const store = new LocalStorageStore();
    const stateA: SerializedPathState = { ...mockState, pathId: "path-a" };
    const stateB: SerializedPathState = { ...mockState, pathId: "path-b" };
    await store.save("keyA", stateA);
    await store.save("keyB", stateB);
    expect((await store.load("keyA"))?.pathId).toBe("path-a");
    expect((await store.load("keyB"))?.pathId).toBe("path-b");
  });

  it("deleting one key does not affect another", async () => {
    const store = new LocalStorageStore();
    await store.save("keep", mockState);
    await store.save("remove", mockState);
    await store.delete("remove");
    expect(await store.load("keep")).toEqual(mockState);
    expect(await store.load("remove")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Key encoding and prefix
// ---------------------------------------------------------------------------

describe("LocalStorageStore — key encoding and prefix", () => {
  it("uses the default prefix @daltonr/pathwrite:", async () => {
    const spy = makeStorageSpy();
    const store = new LocalStorageStore({ storage: spy });
    await store.save("user:123", mockState);
    const calledKey = spy.setItem.mock.calls[0][0] as string;
    expect(calledKey.startsWith("@daltonr/pathwrite:")).toBe(true);
  });

  it("URL-encodes special characters in the key", async () => {
    const spy = makeStorageSpy();
    const store = new LocalStorageStore({ storage: spy });
    await store.save("user:123/doc:456", mockState);
    const calledKey = spy.setItem.mock.calls[0][0] as string;
    expect(calledKey).toBe("@daltonr/pathwrite:user%3A123%2Fdoc%3A456");
  });

  it("uses a custom prefix when provided", async () => {
    const spy = makeStorageSpy();
    const store = new LocalStorageStore({ prefix: "myapp:", storage: spy });
    await store.save("wizard", mockState);
    const calledKey = spy.setItem.mock.calls[0][0] as string;
    expect(calledKey).toBe("myapp:wizard");
  });

  it("two stores with different prefixes do not collide in the same backend", async () => {
    const spy = makeStorageSpy();
    const storeA = new LocalStorageStore({ prefix: "a:", storage: spy });
    const storeB = new LocalStorageStore({ prefix: "b:", storage: spy });
    const stateA: SerializedPathState = { ...mockState, pathId: "path-a" };
    const stateB: SerializedPathState = { ...mockState, pathId: "path-b" };
    await storeA.save("wizard", stateA);
    await storeB.save("wizard", stateB);
    expect((await storeA.load("wizard"))?.pathId).toBe("path-a");
    expect((await storeB.load("wizard"))?.pathId).toBe("path-b");
  });
});

// ---------------------------------------------------------------------------
// Storage injection
// ---------------------------------------------------------------------------

describe("LocalStorageStore — storage injection", () => {
  it("uses the injected StorageAdapter for all operations", async () => {
    const spy = makeStorageSpy();
    const store = new LocalStorageStore({ storage: spy });
    await store.save("k", mockState);
    expect(spy.setItem).toHaveBeenCalledOnce();
    await store.load("k");
    expect(spy.getItem).toHaveBeenCalledOnce();
    await store.delete("k");
    expect(spy.removeItem).toHaveBeenCalledOnce();
  });

  it("storage: null forces in-memory fallback", async () => {
    const store = new LocalStorageStore({ storage: null });
    await store.save("x", mockState);
    expect(await store.load("x")).toEqual(mockState);
    await store.delete("x");
    expect(await store.load("x")).toBeNull();
  });

  it("sessionStorage (or any StorageAdapter) can be injected", async () => {
    const sessionStorage = makeStorageSpy();
    const store = new LocalStorageStore({ storage: sessionStorage });
    await store.save("session-key", mockState);
    const loaded = await store.load("session-key");
    expect(loaded).toEqual(mockState);
    expect(sessionStorage.setItem).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Error propagation
// ---------------------------------------------------------------------------

describe("LocalStorageStore — error propagation", () => {
  it("save() rejects when setItem throws", async () => {
    const spy = makeStorageSpy();
    spy.setItem.mockImplementation(() => { throw new DOMException("QuotaExceededError"); });
    const store = new LocalStorageStore({ storage: spy });
    await expect(store.save("k", mockState)).rejects.toThrow("QuotaExceededError");
  });

  it("load() rejects when getItem throws", async () => {
    const spy = makeStorageSpy();
    spy.getItem.mockImplementation(() => { throw new Error("storage read error"); });
    const store = new LocalStorageStore({ storage: spy });
    await expect(store.load("k")).rejects.toThrow("storage read error");
  });

  it("load() rejects when stored value is invalid JSON", async () => {
    const spy = makeStorageSpy();
    spy.getItem.mockReturnValue("not valid json{{{");
    const store = new LocalStorageStore({ storage: spy });
    await expect(store.load("k")).rejects.toThrow();
  });

  it("delete() rejects when removeItem throws", async () => {
    const spy = makeStorageSpy();
    spy.removeItem.mockImplementation(() => { throw new Error("storage delete error"); });
    const store = new LocalStorageStore({ storage: spy });
    await expect(store.delete("k")).rejects.toThrow("storage delete error");
  });

  it("wraps non-Error throws in an Error", async () => {
    const spy = makeStorageSpy();
    spy.setItem.mockImplementation(() => { throw "raw string error"; });
    const store = new LocalStorageStore({ storage: spy });
    await expect(store.save("k", mockState)).rejects.toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// Default constructor in Node environment
// ---------------------------------------------------------------------------

describe("LocalStorageStore — default constructor in Node environment", () => {
  it("works with no options (uses in-memory fallback since localStorage is undefined)", async () => {
    const store = new LocalStorageStore();
    await store.save("node-key", mockState);
    const loaded = await store.load("node-key");
    expect(loaded).toEqual(mockState);
  });

  it("two stores created with no options have isolated memory", async () => {
    const store1 = new LocalStorageStore();
    const store2 = new LocalStorageStore();
    await store1.save("shared-key", mockState);
    expect(await store2.load("shared-key")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Integration — works with persistence + restoreOrStart
// ---------------------------------------------------------------------------

describe("LocalStorageStore — integration with persistence and restoreOrStart", () => {
  beforeEach(() => { vi.useFakeTimers(); });

  it("persistence saves to LocalStorageStore on next", async () => {
    const store = new LocalStorageStore();
    const engine = new PathEngine({
      observers: [persistence({ store, key: "w", strategy: "onNext" })],
    });
    await engine.start(simplePath);
    await engine.next();
    await vi.runAllTimersAsync();
    const loaded = await store.load("w");
    expect(loaded).not.toBeNull();
    expect(loaded?.currentStepIndex).toBe(1);
  });

  it("persistence deletes from LocalStorageStore on completion", async () => {
    const store = new LocalStorageStore();
    const engine = new PathEngine({
      observers: [persistence({ store, key: "w", strategy: "onNext" })],
    });
    await engine.start(simplePath);
    await engine.next();
    await vi.runAllTimersAsync();
    expect(await store.load("w")).not.toBeNull();
    await engine.next();
    await engine.next();
    await vi.runAllTimersAsync();
    expect(await store.load("w")).toBeNull();
  });

  it("restoreOrStart — starts fresh when store is empty", async () => {
    const store = new LocalStorageStore();
    const { engine, restored } = await restoreOrStart({ store, key: "rw", path: simplePath });
    expect(restored).toBe(false);
    expect(engine.snapshot()?.stepId).toBe("step1");
  });

  it("restoreOrStart — restores from LocalStorageStore when state exists", async () => {
    const store = new LocalStorageStore();
    const savedState: SerializedPathState = {
      version: 1, pathId: "simple", currentStepIndex: 1,
      data: { name: "Restored" }, visitedStepIds: ["step1", "step2"],
      pathStack: [], _isNavigating: false,
    };
    await store.save("rw", savedState);
    const { engine, restored } = await restoreOrStart({
      store, key: "rw", path: simplePath,
      pathDefinitions: { simple: simplePath },
    });
    expect(restored).toBe(true);
    expect(engine.snapshot()?.stepId).toBe("step2");
    expect(engine.snapshot()?.data.name).toBe("Restored");
  });

  it("full round-trip: start → navigate → restore", async () => {
    const store = new LocalStorageStore();
    const key = "round-trip";
    {
      const engine = new PathEngine({
        observers: [persistence({ store, key, strategy: "onNext" })],
      });
      await engine.start(simplePath);
      await engine.next();
      await vi.runAllTimersAsync();
    }
    const { engine, restored } = await restoreOrStart({
      store, key, path: simplePath,
      pathDefinitions: { simple: simplePath },
      observers: [persistence({ store, key, strategy: "onNext" })],
    });
    expect(restored).toBe(true);
    expect(engine.snapshot()?.stepId).toBe("step2");
  });
});

// ---------------------------------------------------------------------------
// list() and clear()
// ---------------------------------------------------------------------------

describe("LocalStorageStore — list()", () => {
  it("returns an empty array when nothing has been saved", async () => {
    const store = new LocalStorageStore();
    expect(await store.list()).toEqual([]);
  });

  it("returns all saved keys", async () => {
    const store = new LocalStorageStore();
    await store.save("session:1", mockState);
    await store.save("session:2", mockState);
    await store.save("session:3", mockState);
    const keys = await store.list();
    expect(keys.sort()).toEqual(["session:1", "session:2", "session:3"]);
  });

  it("does not return a key after it has been deleted", async () => {
    const store = new LocalStorageStore();
    await store.save("keep", mockState);
    await store.save("remove", mockState);
    await store.delete("remove");
    expect(await store.list()).toEqual(["keep"]);
  });

  it("only returns keys for its own prefix", async () => {
    const spy = makeStorageSpy();
    const storeA = new LocalStorageStore({ prefix: "a:", storage: spy });
    const storeB = new LocalStorageStore({ prefix: "b:", storage: spy });
    await storeA.save("wizard-1", mockState);
    await storeA.save("wizard-2", mockState);
    await storeB.save("wizard-3", mockState);
    expect((await storeA.list()).sort()).toEqual(["wizard-1", "wizard-2"]);
    expect(await storeB.list()).toEqual(["wizard-3"]);
  });

  it("decodes URL-encoded characters in returned keys", async () => {
    const store = new LocalStorageStore();
    await store.save("user:123/session:456", mockState);
    const keys = await store.list();
    expect(keys).toEqual(["user:123/session:456"]);
  });

  it("throws when the adapter does not implement getAllKeys", async () => {
    const adapterWithoutKeys: StorageAdapter = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
    const store = new LocalStorageStore({ storage: adapterWithoutKeys });
    await expect(store.list()).rejects.toThrow("getAllKeys");
  });
});

describe("LocalStorageStore — clear()", () => {
  it("removes all keys under the prefix", async () => {
    const store = new LocalStorageStore();
    await store.save("session:1", mockState);
    await store.save("session:2", mockState);
    await store.clear();
    expect(await store.list()).toEqual([]);
  });

  it("does not affect keys belonging to a different prefix", async () => {
    const spy = makeStorageSpy();
    const storeA = new LocalStorageStore({ prefix: "a:", storage: spy });
    const storeB = new LocalStorageStore({ prefix: "b:", storage: spy });
    await storeA.save("wizard-1", mockState);
    await storeB.save("wizard-2", mockState);
    await storeA.clear();
    expect(await storeA.list()).toEqual([]);
    expect(await storeB.list()).toEqual(["wizard-2"]);
  });

  it("is a no-op on an empty store", async () => {
    const store = new LocalStorageStore();
    await expect(store.clear()).resolves.toBeUndefined();
  });
});
