import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HttpStore, PathEngineWithStore } from "../src/index";
import type { SerializedPathState, PathDefinition } from "@daltonr/pathwrite-core";
import { PathEngine } from "@daltonr/pathwrite-core";

// Mock SerializedPathState
const mockState: SerializedPathState = {
  version: 1,
  pathId: "test-path",
  currentStepIndex: 1,
  data: { name: "Alice", email: "alice@example.com" },
  visitedStepIds: ["step1", "step2"],
  pathStack: [],
  _isNavigating: false,
};

describe("HttpStore", () => {
  it("saves state via PUT request", async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      } as Response)
    );

    const store = new HttpStore({
      baseUrl: "/api",
      fetch: mockFetch as any,
    });

    await store.save("user:123", mockState);

    expect(mockFetch).toHaveBeenCalledWith("/api/state/user%3A123", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mockState),
    });
  });

  it("loads state via GET request", async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockState),
      } as Response)
    );

    const store = new HttpStore({
      baseUrl: "/api",
      fetch: mockFetch as any,
    });

    const loaded = await store.load("user:123");

    expect(mockFetch).toHaveBeenCalledWith("/api/state/user%3A123", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    expect(loaded).toEqual(mockState);
  });

  it("returns null when GET returns 404", async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 404,
      } as Response)
    );

    const store = new HttpStore({
      baseUrl: "/api",
      fetch: mockFetch as any,
    });

    const loaded = await store.load("user:999");

    expect(loaded).toBeNull();
  });

  it("deletes state via DELETE request", async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
      } as Response)
    );

    const store = new HttpStore({
      baseUrl: "/api",
      fetch: mockFetch as any,
    });

    await store.delete("user:123");

    expect(mockFetch).toHaveBeenCalledWith("/api/state/user%3A123", {
      method: "DELETE",
      headers: {},
    });
  });

  it("includes custom headers in requests", async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      } as Response)
    );

    const store = new HttpStore({
      baseUrl: "/api",
      headers: { Authorization: "Bearer token123" },
      fetch: mockFetch as any,
    });

    await store.save("user:123", mockState);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer token123",
        }),
      })
    );
  });

  it("calls async header function", async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      } as Response)
    );

    const getHeaders = vi.fn(async () => ({
      Authorization: "Bearer fresh-token",
    }));

    const store = new HttpStore({
      baseUrl: "/api",
      headers: getHeaders,
      fetch: mockFetch as any,
    });

    await store.save("user:123", mockState);

    expect(getHeaders).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer fresh-token",
        }),
      })
    );
  });

  it("uses custom URL builders", async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      } as Response)
    );

    const store = new HttpStore({
      baseUrl: "/api",
      saveUrl: (key) => `/v2/wizard/${key}/state`,
      loadUrl: (key) => `/v2/wizard/${key}/state`,
      fetch: mockFetch as any,
    });

    await store.save("user:123", mockState);

    expect(mockFetch).toHaveBeenCalledWith("/v2/wizard/user:123/state", expect.any(Object));
  });

  it("calls onError when save fails", async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      } as Response)
    );

    const onError = vi.fn();

    const store = new HttpStore({
      baseUrl: "/api",
      fetch: mockFetch as any,
      onError,
    });

    await expect(store.save("user:123", mockState)).rejects.toThrow("HTTP 500");

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      "save",
      "user:123"
    );
  });

  it("strips trailing slash from baseUrl", async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      } as Response)
    );

    const store = new HttpStore({
      baseUrl: "/api/wizard/",  // trailing slash
      fetch: mockFetch as any,
    });

    await store.save("key", mockState);

    // Should be /api/wizard/state/key, not /api/wizard//state/key
    expect(mockFetch).toHaveBeenCalledWith("/api/wizard/state/key", expect.any(Object));
  });

  it("URL-encodes keys with special characters", async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      } as Response)
    );

    const store = new HttpStore({
      baseUrl: "/api",
      fetch: mockFetch as any,
    });

    await store.save("doc:123/user:456", mockState);

    // : and / should be encoded
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/state/doc%3A123%2Fuser%3A456",
      expect.any(Object)
    );
  });
});

describe("PathEngineWithStore", () => {
  const simplePath: PathDefinition = {
    id: "simple",
    steps: [
      { id: "step1" },
      { id: "step2" },
      { id: "step3" },
    ],
  };

  const pathDefinitions = { simple: simplePath };

  let mockFetch: ReturnType<typeof vi.fn>;
  let store: HttpStore;

  beforeEach(() => {
    mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(null),
      } as Response)
    );

    store = new HttpStore({
      baseUrl: "/api",
      fetch: mockFetch as any,
    });

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("starts fresh when no saved state exists", async () => {
    // Mock: no saved state
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        status: 404,
      } as Response)
    );

    const wrapper = new PathEngineWithStore({
      key: "test-wizard",
      store,
      persistenceStrategy: "manual",
    });

    await wrapper.startOrRestore(simplePath, pathDefinitions);

    const engine = wrapper.getEngine();
    const snapshot = engine.snapshot();

    expect(snapshot).not.toBeNull();
    expect(snapshot?.pathId).toBe("simple");
    expect(snapshot?.stepId).toBe("step1");

    wrapper.cleanup();
  });

  it("restores from saved state when it exists", async () => {
    const savedState: SerializedPathState = {
      version: 1,
      pathId: "simple",
      currentStepIndex: 1, // step2
      data: { name: "Restored" },
      visitedStepIds: ["step1", "step2"],
      pathStack: [],
      _isNavigating: false,
    };

    // Mock: return saved state on load
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(savedState),
      } as Response)
    );

    const wrapper = new PathEngineWithStore({
      key: "test-wizard",
      store,
      persistenceStrategy: "manual",
    });

    await wrapper.startOrRestore(simplePath, pathDefinitions);

    const engine = wrapper.getEngine();
    const snapshot = engine.snapshot();

    expect(snapshot?.stepId).toBe("step2");
    expect(snapshot?.data.name).toBe("Restored");

    wrapper.cleanup();
  });

  it("auto-saves on every change with onEveryChange strategy", async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(null),
      } as Response)
    );

    const wrapper = new PathEngineWithStore({
      key: "test-wizard",
      store,
      persistenceStrategy: "onEveryChange",
    });

    await wrapper.startOrRestore(simplePath, pathDefinitions);

    const engine = wrapper.getEngine();

    // Clear previous fetch calls
    mockFetch.mockClear();

    // Navigate forward
    await engine.next();

    // Should have triggered a save
    await vi.runAllTimersAsync();
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/state/test-wizard",
      expect.objectContaining({ method: "PUT" })
    );

    wrapper.cleanup();
  });

  it("does not auto-save with manual strategy", async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(null),
      } as Response)
    );

    const wrapper = new PathEngineWithStore({
      key: "test-wizard",
      store,
      persistenceStrategy: "manual",
    });

    await wrapper.startOrRestore(simplePath, pathDefinitions);

    const engine = wrapper.getEngine();

    mockFetch.mockClear();

    // Navigate forward
    await engine.next();
    await vi.runAllTimersAsync();

    // Should NOT have triggered a save
    const saveCalls = mockFetch.mock.calls.filter(
      (call) => call[1]?.method === "PUT"
    );
    expect(saveCalls).toHaveLength(0);

    wrapper.cleanup();
  });

  it("allows manual save when strategy is manual", async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(null),
      } as Response)
    );

    const wrapper = new PathEngineWithStore({
      key: "test-wizard",
      store,
      persistenceStrategy: "manual",
    });

    await wrapper.startOrRestore(simplePath, pathDefinitions);

    mockFetch.mockClear();

    // Manually trigger save
    await wrapper.save();

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/state/test-wizard",
      expect.objectContaining({ method: "PUT" })
    );

    wrapper.cleanup();
  });

  it("debounces saves when debounceMs is set", async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(null),
      } as Response)
    );

    const wrapper = new PathEngineWithStore({
      key: "test-wizard",
      store,
      persistenceStrategy: "onEveryChange",
      debounceMs: 500,
    });

    await wrapper.startOrRestore(simplePath, pathDefinitions);

    const engine = wrapper.getEngine();

    mockFetch.mockClear();

    // Make multiple rapid changes
    await engine.setData("name", "Alice");
    await engine.setData("email", "alice@example.com");
    await engine.setData("age", 25);

    // Advance time by 400ms (less than debounce)
    await vi.advanceTimersByTimeAsync(400);

    // Should not have saved yet
    const saveCalls1 = mockFetch.mock.calls.filter(
      (call) => call[1]?.method === "PUT"
    );
    expect(saveCalls1).toHaveLength(0);

    // Advance past the debounce time
    await vi.advanceTimersByTimeAsync(200);

    // Now it should have saved once
    const saveCalls2 = mockFetch.mock.calls.filter(
      (call) => call[1]?.method === "PUT"
    );
    expect(saveCalls2).toHaveLength(1);

    wrapper.cleanup();
  });

  it("calls onSaveSuccess callback on successful save", async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(null),
      } as Response)
    );

    const onSaveSuccess = vi.fn();

    const wrapper = new PathEngineWithStore({
      key: "test-wizard",
      store,
      persistenceStrategy: "manual",
      onSaveSuccess,
    });

    await wrapper.startOrRestore(simplePath, pathDefinitions);

    await wrapper.save();

    expect(onSaveSuccess).toHaveBeenCalled();

    wrapper.cleanup();
  });

  it("calls onSaveError callback when save fails", async () => {
    // Mock: load succeeds (returns no state), but save fails
    let callCount = 0;
    mockFetch.mockImplementation((url, options) => {
      callCount++;
      if (callCount === 1) {
        // First call is load (GET) - return 404 (no saved state)
        return Promise.resolve({
          ok: false,
          status: 404,
        } as Response);
      }
      // Subsequent calls are saves (PUT) - return error
      return Promise.resolve({
        ok: false,
        status: 500,
        statusText: "Server Error",
      } as Response);
    });

    const onSaveError = vi.fn();

    const wrapper = new PathEngineWithStore({
      key: "test-wizard",
      store,
      persistenceStrategy: "manual",
      onSaveError,
    });

    await wrapper.startOrRestore(simplePath, pathDefinitions);

    await wrapper.save();

    expect(onSaveError).toHaveBeenCalledWith(expect.any(Error));

    wrapper.cleanup();
  });

  it("deletes saved state when wizard completes", async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(null),
      } as Response)
    );

    const wrapper = new PathEngineWithStore({
      key: "test-wizard",
      store,
      persistenceStrategy: "onEveryChange",
    });

    await wrapper.startOrRestore(simplePath, pathDefinitions);

    const engine = wrapper.getEngine();

    mockFetch.mockClear();

    // Complete the wizard (next through all steps)
    await engine.next(); // step1 -> step2
    await engine.next(); // step2 -> step3
    await engine.next(); // step3 -> complete

    await vi.runAllTimersAsync();

    // Should have called DELETE
    const deleteCalls = mockFetch.mock.calls.filter(
      (call) => call[1]?.method === "DELETE"
    );
    expect(deleteCalls.length).toBeGreaterThan(0);

    wrapper.cleanup();
  });

  it("saves on sub-path completion with onSubPathComplete strategy", async () => {
    const parentPath: PathDefinition = {
      id: "parent",
      steps: [{ id: "p1" }, { id: "p2" }],
    };

    const subPath: PathDefinition = {
      id: "sub",
      steps: [{ id: "s1" }, { id: "s2" }],
    };

    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(null),
      } as Response)
    );

    const wrapper = new PathEngineWithStore({
      key: "test-wizard",
      store,
      persistenceStrategy: "onSubPathComplete",
    });

    await wrapper.startOrRestore(parentPath, { parent: parentPath, sub: subPath });

    const engine = wrapper.getEngine();

    mockFetch.mockClear();

    // Start a sub-path
    await engine.startSubPath(subPath);

    // Complete the sub-path
    await engine.next(); // s1 -> s2
    await engine.next(); // s2 -> complete (returns to parent)

    await vi.runAllTimersAsync();

    // Should have saved when sub-path completed
    const saveCalls = mockFetch.mock.calls.filter(
      (call) => call[1]?.method === "PUT"
    );
    expect(saveCalls.length).toBeGreaterThan(0);

    wrapper.cleanup();
  });

  it("only saves on completion with onComplete strategy", async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(null),
      } as Response)
    );

    const wrapper = new PathEngineWithStore({
      key: "test-wizard",
      store,
      persistenceStrategy: "onComplete",
    });

    await wrapper.startOrRestore(simplePath, pathDefinitions);

    const engine = wrapper.getEngine();

    // Clear initial load call
    mockFetch.mockClear();

    // Navigate but don't complete
    await engine.next();
    await wrapper.waitForPendingSave();

    // Should NOT have saved yet (no PUT calls)
    let saveCalls = mockFetch.mock.calls.filter(
      (call) => call[1]?.method === "PUT"
    );
    expect(saveCalls).toHaveLength(0);

    // Navigate to last step but don't complete yet
    await engine.next();
    await wrapper.waitForPendingSave();

    // Still should not have saved
    saveCalls = mockFetch.mock.calls.filter(
      (call) => call[1]?.method === "PUT"
    );
    expect(saveCalls).toHaveLength(0);

    // Complete the wizard
    await engine.next(); // This completes the wizard
    await wrapper.waitForPendingSave(); // Wait for the save to complete

    // Now it should have saved (the "completed" event triggers a save with onComplete strategy)
    saveCalls = mockFetch.mock.calls.filter(
      (call) => call[1]?.method === "PUT"
    );
    expect(saveCalls.length).toBeGreaterThan(0);

    wrapper.cleanup();
  });

  it("throws error if getEngine is called before startOrRestore", () => {
    const wrapper = new PathEngineWithStore({
      key: "test-wizard",
      store,
    });

    expect(() => wrapper.getEngine()).toThrow("Engine not initialized");
  });

  it("cleans up resources on cleanup", async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(null),
      } as Response)
    );

    const wrapper = new PathEngineWithStore({
      key: "test-wizard",
      store,
      persistenceStrategy: "onEveryChange",
      debounceMs: 1000,
    });

    await wrapper.startOrRestore(simplePath, pathDefinitions);

    const engine = wrapper.getEngine();

    // Schedule a save
    await engine.setData("name", "Test");

    // Cleanup before debounce timer fires
    wrapper.cleanup();

    // Advance timers
    await vi.runAllTimersAsync();

    // Should not have saved after cleanup
    mockFetch.mockClear();
    await vi.runAllTimersAsync();

    const saveCalls = mockFetch.mock.calls.filter(
      (call) => call[1]?.method === "PUT"
    );
    expect(saveCalls).toHaveLength(0);
  });
});












