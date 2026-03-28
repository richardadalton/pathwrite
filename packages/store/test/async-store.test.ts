import { describe, it, expect, vi } from "vitest";
import { AsyncStorageStore } from "../src/async-store";
import type { AsyncStorageAdapter } from "../src/async-store";
import type { SerializedPathState } from "@daltonr/pathwrite-core";

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

/** Creates a fresh in-memory AsyncStorageAdapter spy. */
function makeAsyncStorageSpy(): AsyncStorageAdapter & {
  _data: Map<string, string>;
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
  removeItem: ReturnType<typeof vi.fn>;
  getAllKeys: ReturnType<typeof vi.fn>;
} {
  const _data = new Map<string, string>();
  return {
    _data,
    getItem:    vi.fn(async (k: string) => _data.has(k) ? _data.get(k)! : null),
    setItem:    vi.fn(async (k: string, v: string) => { _data.set(k, v); }),
    removeItem: vi.fn(async (k: string) => { _data.delete(k); }),
    getAllKeys:  vi.fn(async () => Array.from(_data.keys()) as readonly string[]),
  };
}

// ---------------------------------------------------------------------------
// Core save / load / delete
// ---------------------------------------------------------------------------

describe("AsyncStorageStore — core operations", () => {
  it("save then load returns the original state", async () => {
    const store = new AsyncStorageStore({ storage: makeAsyncStorageSpy() });
    await store.save("user:1", mockState);
    expect(await store.load("user:1")).toEqual(mockState);
  });

  it("load returns null for a key that was never saved", async () => {
    const store = new AsyncStorageStore({ storage: makeAsyncStorageSpy() });
    expect(await store.load("nonexistent")).toBeNull();
  });

  it("save then delete then load returns null", async () => {
    const store = new AsyncStorageStore({ storage: makeAsyncStorageSpy() });
    await store.save("user:2", mockState);
    await store.delete("user:2");
    expect(await store.load("user:2")).toBeNull();
  });

  it("delete on a non-existent key does not throw", async () => {
    const store = new AsyncStorageStore({ storage: makeAsyncStorageSpy() });
    await expect(store.delete("ghost-key")).resolves.toBeUndefined();
  });

  it("overwrites an existing entry on a second save", async () => {
    const store = new AsyncStorageStore({ storage: makeAsyncStorageSpy() });
    await store.save("user:3", mockState);
    const updated: SerializedPathState = { ...mockState, currentStepIndex: 2, data: { name: "Bob" } };
    await store.save("user:3", updated);
    const loaded = await store.load("user:3");
    expect(loaded?.currentStepIndex).toBe(2);
    expect(loaded?.data.name).toBe("Bob");
  });

  it("different keys do not collide", async () => {
    const store = new AsyncStorageStore({ storage: makeAsyncStorageSpy() });
    await store.save("keyA", { ...mockState, pathId: "path-a" });
    await store.save("keyB", { ...mockState, pathId: "path-b" });
    expect((await store.load("keyA"))?.pathId).toBe("path-a");
    expect((await store.load("keyB"))?.pathId).toBe("path-b");
  });
});

// ---------------------------------------------------------------------------
// Key encoding and prefix
// ---------------------------------------------------------------------------

describe("AsyncStorageStore — key encoding and prefix", () => {
  it("uses the default prefix @daltonr/pathwrite:", async () => {
    const spy = makeAsyncStorageSpy();
    const store = new AsyncStorageStore({ storage: spy });
    await store.save("user:123", mockState);
    const calledKey = spy.setItem.mock.calls[0][0] as string;
    expect(calledKey.startsWith("@daltonr/pathwrite:")).toBe(true);
  });

  it("URL-encodes special characters in the key", async () => {
    const spy = makeAsyncStorageSpy();
    const store = new AsyncStorageStore({ storage: spy });
    await store.save("user:123/doc:456", mockState);
    const calledKey = spy.setItem.mock.calls[0][0] as string;
    expect(calledKey).toBe("@daltonr/pathwrite:user%3A123%2Fdoc%3A456");
  });

  it("uses a custom prefix when provided", async () => {
    const spy = makeAsyncStorageSpy();
    const store = new AsyncStorageStore({ storage: spy, prefix: "myapp:" });
    await store.save("wizard", mockState);
    const calledKey = spy.setItem.mock.calls[0][0] as string;
    expect(calledKey).toBe("myapp:wizard");
  });
});

// ---------------------------------------------------------------------------
// Adapter delegation
// ---------------------------------------------------------------------------

describe("AsyncStorageStore — adapter delegation", () => {
  it("delegates save to setItem", async () => {
    const spy = makeAsyncStorageSpy();
    const store = new AsyncStorageStore({ storage: spy });
    await store.save("k", mockState);
    expect(spy.setItem).toHaveBeenCalledOnce();
  });

  it("delegates load to getItem", async () => {
    const spy = makeAsyncStorageSpy();
    const store = new AsyncStorageStore({ storage: spy });
    await store.load("k");
    expect(spy.getItem).toHaveBeenCalledOnce();
  });

  it("delegates delete to removeItem", async () => {
    const spy = makeAsyncStorageSpy();
    const store = new AsyncStorageStore({ storage: spy });
    await store.delete("k");
    expect(spy.removeItem).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Error propagation
// ---------------------------------------------------------------------------

describe("AsyncStorageStore — error propagation", () => {
  it("save() rejects when setItem rejects", async () => {
    const spy = makeAsyncStorageSpy();
    spy.setItem.mockRejectedValue(new Error("write error"));
    const store = new AsyncStorageStore({ storage: spy });
    await expect(store.save("k", mockState)).rejects.toThrow("write error");
  });

  it("load() rejects when getItem rejects", async () => {
    const spy = makeAsyncStorageSpy();
    spy.getItem.mockRejectedValue(new Error("read error"));
    const store = new AsyncStorageStore({ storage: spy });
    await expect(store.load("k")).rejects.toThrow("read error");
  });

  it("load() rejects when stored value is invalid JSON", async () => {
    const spy = makeAsyncStorageSpy();
    spy.getItem.mockResolvedValue("not valid json{{{");
    const store = new AsyncStorageStore({ storage: spy });
    await expect(store.load("k")).rejects.toThrow();
  });

  it("delete() rejects when removeItem rejects", async () => {
    const spy = makeAsyncStorageSpy();
    spy.removeItem.mockRejectedValue(new Error("delete error"));
    const store = new AsyncStorageStore({ storage: spy });
    await expect(store.delete("k")).rejects.toThrow("delete error");
  });

  it("wraps non-Error rejections in an Error", async () => {
    const spy = makeAsyncStorageSpy();
    spy.setItem.mockRejectedValue("raw string error");
    const store = new AsyncStorageStore({ storage: spy });
    await expect(store.save("k", mockState)).rejects.toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// list() and clear()
// ---------------------------------------------------------------------------

describe("AsyncStorageStore — list()", () => {
  it("returns an empty array when nothing has been saved", async () => {
    const store = new AsyncStorageStore({ storage: makeAsyncStorageSpy() });
    expect(await store.list()).toEqual([]);
  });

  it("returns all saved keys", async () => {
    const store = new AsyncStorageStore({ storage: makeAsyncStorageSpy() });
    await store.save("session:1", mockState);
    await store.save("session:2", mockState);
    await store.save("session:3", mockState);
    expect((await store.list()).sort()).toEqual(["session:1", "session:2", "session:3"]);
  });

  it("does not return a key after it has been deleted", async () => {
    const store = new AsyncStorageStore({ storage: makeAsyncStorageSpy() });
    await store.save("keep", mockState);
    await store.save("remove", mockState);
    await store.delete("remove");
    expect(await store.list()).toEqual(["keep"]);
  });

  it("only returns keys for its own prefix", async () => {
    const spy = makeAsyncStorageSpy();
    const storeA = new AsyncStorageStore({ storage: spy, prefix: "a:" });
    const storeB = new AsyncStorageStore({ storage: spy, prefix: "b:" });
    await storeA.save("wizard-1", mockState);
    await storeA.save("wizard-2", mockState);
    await storeB.save("wizard-3", mockState);
    expect((await storeA.list()).sort()).toEqual(["wizard-1", "wizard-2"]);
    expect(await storeB.list()).toEqual(["wizard-3"]);
  });

  it("decodes URL-encoded characters in returned keys", async () => {
    const store = new AsyncStorageStore({ storage: makeAsyncStorageSpy() });
    await store.save("user:123/session:456", mockState);
    expect(await store.list()).toEqual(["user:123/session:456"]);
  });

  it("throws when the adapter does not implement getAllKeys", async () => {
    const adapterWithoutKeys: AsyncStorageAdapter = {
      getItem:    async () => null,
      setItem:    async () => {},
      removeItem: async () => {},
    };
    const store = new AsyncStorageStore({ storage: adapterWithoutKeys });
    await expect(store.list()).rejects.toThrow("getAllKeys");
  });
});

describe("AsyncStorageStore — clear()", () => {
  it("removes all keys under the prefix", async () => {
    const store = new AsyncStorageStore({ storage: makeAsyncStorageSpy() });
    await store.save("session:1", mockState);
    await store.save("session:2", mockState);
    await store.clear();
    expect(await store.list()).toEqual([]);
  });

  it("does not affect keys belonging to a different prefix", async () => {
    const spy = makeAsyncStorageSpy();
    const storeA = new AsyncStorageStore({ storage: spy, prefix: "a:" });
    const storeB = new AsyncStorageStore({ storage: spy, prefix: "b:" });
    await storeA.save("wizard-1", mockState);
    await storeB.save("wizard-2", mockState);
    await storeA.clear();
    expect(await storeA.list()).toEqual([]);
    expect(await storeB.list()).toEqual(["wizard-2"]);
  });

  it("is a no-op on an empty store", async () => {
    const store = new AsyncStorageStore({ storage: makeAsyncStorageSpy() });
    await expect(store.clear()).resolves.toBeUndefined();
  });
});
