import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HttpStore, httpPersistence, createPersistedEngine } from "../src/index";
import type { SerializedPathState, PathDefinition } from "@daltonr/pathwrite-core";
import { PathEngine } from "@daltonr/pathwrite-core";

// ---------------------------------------------------------------------------
// Shared fixtures
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

const pathDefinitions = { simple: simplePath };

function makeOkFetch(body: unknown = null) {
  return vi.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
    } as Response)
  );
}

function make404Fetch() {
  return vi.fn(() =>
    Promise.resolve({ ok: false, status: 404 } as Response)
  );
}

// ---------------------------------------------------------------------------
// HttpStore
// ---------------------------------------------------------------------------

describe("HttpStore", () => {
  it("saves state via PUT request", async () => {
    const mockFetch = makeOkFetch();
    const store = new HttpStore({ baseUrl: "/api", fetch: mockFetch as any });

    await store.save("user:123", mockState);

    expect(mockFetch).toHaveBeenCalledWith("/api/state/user%3A123", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mockState),
    });
  });

  it("loads state via GET request", async () => {
    const mockFetch = makeOkFetch(mockState);
    const store = new HttpStore({ baseUrl: "/api", fetch: mockFetch as any });

    const loaded = await store.load("user:123");

    expect(mockFetch).toHaveBeenCalledWith("/api/state/user%3A123", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    expect(loaded).toEqual(mockState);
  });

  it("returns null when GET returns 404", async () => {
    const store = new HttpStore({ baseUrl: "/api", fetch: make404Fetch() as any });
    const loaded = await store.load("user:999");
    expect(loaded).toBeNull();
  });

  it("deletes state via DELETE request", async () => {
    const mockFetch = makeOkFetch();
    const store = new HttpStore({ baseUrl: "/api", fetch: mockFetch as any });

    await store.delete("user:123");

    expect(mockFetch).toHaveBeenCalledWith("/api/state/user%3A123", {
      method: "DELETE",
      headers: {},
    });
  });

  it("includes custom headers in requests", async () => {
    const mockFetch = makeOkFetch();
    const store = new HttpStore({
      baseUrl: "/api",
      headers: { Authorization: "Bearer token123" },
      fetch: mockFetch as any,
    });

    await store.save("user:123", mockState);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token123" }),
      })
    );
  });

  it("calls async header function", async () => {
    const getHeaders = vi.fn(async () => ({ Authorization: "Bearer fresh-token" }));
    const mockFetch = makeOkFetch();
    const store = new HttpStore({ baseUrl: "/api", headers: getHeaders, fetch: mockFetch as any });

    await store.save("user:123", mockState);

    expect(getHeaders).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer fresh-token" }),
      })
    );
  });

  it("uses custom URL builders", async () => {
    const mockFetch = makeOkFetch();
    const store = new HttpStore({
      baseUrl: "/api",
      saveUrl: (key) => `/v2/wizard/${key}/state`,
      fetch: mockFetch as any,
    });

    await store.save("user:123", mockState);

    expect(mockFetch).toHaveBeenCalledWith("/v2/wizard/user:123/state", expect.any(Object));
  });

  it("calls onError when save fails", async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({ ok: false, status: 500, statusText: "Internal Server Error" } as Response)
    );
    const onError = vi.fn();
    const store = new HttpStore({ baseUrl: "/api", fetch: mockFetch as any, onError });

    await expect(store.save("user:123", mockState)).rejects.toThrow("HTTP 500");
    expect(onError).toHaveBeenCalledWith(expect.any(Error), "save", "user:123");
  });

  it("strips trailing slash from baseUrl", async () => {
    const mockFetch = makeOkFetch();
    const store = new HttpStore({ baseUrl: "/api/wizard/", fetch: mockFetch as any });

    await store.save("key", mockState);

    expect(mockFetch).toHaveBeenCalledWith("/api/wizard/state/key", expect.any(Object));
  });

  it("URL-encodes keys with special characters", async () => {
    const mockFetch = makeOkFetch();
    const store = new HttpStore({ baseUrl: "/api", fetch: mockFetch as any });

    await store.save("doc:123/user:456", mockState);

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/state/doc%3A123%2Fuser%3A456",
      expect.any(Object)
    );
  });
});

// ---------------------------------------------------------------------------
// httpPersistence observer
// ---------------------------------------------------------------------------

describe("httpPersistence", () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let store: HttpStore;

  beforeEach(() => {
    mockFetch = makeOkFetch();
    store = new HttpStore({ baseUrl: "/api", fetch: mockFetch as any });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  // Because httpPersistence returns a plain function (PathObserver), we can
  // call it directly with crafted events and a minimal fake engine.
  // No real PathEngine needed — no double-stateChanged noise, no async navigation.

  function fakeEngine(state: SerializedPathState = mockState) {
    return { exportState: () => state } as unknown as PathEngine;
  }

  type Cause = "start" | "next" | "previous" | "goToStep" | "goToStepChecked" | "setData" | "cancel" | "restart";

  function stateChanged(cause: Cause, isNavigating = false) {
    return {
      type: "stateChanged" as const,
      cause,
      snapshot: { isNavigating } as any,
    };
  }

  const resumed = {
    type: "resumed" as const,
    resumedPathId: "parent",
    fromSubPathId: "sub",
    snapshot: { isNavigating: false } as any,
  };

  const completed = { type: "completed" as const, pathId: "simple", data: {} };

  // ── onNext strategy (default) ──────────────────────────────────────────────

  it("saves on settled next stateChanged (onNext)", async () => {
    const obs = httpPersistence({ store, key: "w" });
    obs(stateChanged("next"), fakeEngine());
    await vi.runAllTimersAsync();
    expect(mockFetch.mock.calls.filter((c) => c[1]?.method === "PUT")).toHaveLength(1);
  });

  it("does NOT save on mid-navigation next stateChanged (isNavigating:true)", async () => {
    const obs = httpPersistence({ store, key: "w" });
    obs(stateChanged("next", true), fakeEngine()); // isNavigating = true
    await vi.runAllTimersAsync();
    expect(mockFetch.mock.calls.filter((c) => c[1]?.method === "PUT")).toHaveLength(0);
  });

  it("does NOT save on setData stateChanged (onNext)", async () => {
    const obs = httpPersistence({ store, key: "w" });
    obs(stateChanged("setData"), fakeEngine());
    await vi.runAllTimersAsync();
    expect(mockFetch.mock.calls.filter((c) => c[1]?.method === "PUT")).toHaveLength(0);
  });

  it("does NOT save on start stateChanged (onNext)", async () => {
    const obs = httpPersistence({ store, key: "w" });
    obs(stateChanged("start"), fakeEngine());
    await vi.runAllTimersAsync();
    expect(mockFetch.mock.calls.filter((c) => c[1]?.method === "PUT")).toHaveLength(0);
  });

  // ── onEveryChange strategy ─────────────────────────────────────────────────

  it("saves on settled stateChanged (onEveryChange)", async () => {
    const obs = httpPersistence({ store, key: "w", strategy: "onEveryChange" });
    obs(stateChanged("setData"), fakeEngine()); // setData is always settled
    await vi.runAllTimersAsync();
    expect(mockFetch.mock.calls.filter((c) => c[1]?.method === "PUT")).toHaveLength(1);
  });

  it("does NOT save on mid-navigation stateChanged (onEveryChange)", async () => {
    const obs = httpPersistence({ store, key: "w", strategy: "onEveryChange" });
    obs(stateChanged("next", true), fakeEngine()); // mid-navigation
    await vi.runAllTimersAsync();
    expect(mockFetch.mock.calls.filter((c) => c[1]?.method === "PUT")).toHaveLength(0);
  });

  it("saves on resumed event (onEveryChange)", async () => {
    const obs = httpPersistence({ store, key: "w", strategy: "onEveryChange" });
    obs(resumed, fakeEngine());
    await vi.runAllTimersAsync();
    expect(mockFetch.mock.calls.filter((c) => c[1]?.method === "PUT")).toHaveLength(1);
  });

  // ── manual strategy ────────────────────────────────────────────────────────

  it("never auto-saves with manual strategy", async () => {
    const obs = httpPersistence({ store, key: "w", strategy: "manual" });
    obs(stateChanged("next"), fakeEngine());
    obs(stateChanged("setData"), fakeEngine());
    obs(resumed, fakeEngine());
    await vi.runAllTimersAsync();
    expect(mockFetch.mock.calls.filter((c) => c[1]?.method === "PUT")).toHaveLength(0);
  });

  // ── onSubPathComplete strategy ─────────────────────────────────────────────

  it("saves on resumed event (onSubPathComplete)", async () => {
    const obs = httpPersistence({ store, key: "w", strategy: "onSubPathComplete" });
    obs(resumed, fakeEngine());
    await vi.runAllTimersAsync();
    expect(mockFetch.mock.calls.filter((c) => c[1]?.method === "PUT")).toHaveLength(1);
  });

  it("does NOT save on stateChanged (onSubPathComplete)", async () => {
    const obs = httpPersistence({ store, key: "w", strategy: "onSubPathComplete" });
    obs(stateChanged("next"), fakeEngine());
    await vi.runAllTimersAsync();
    expect(mockFetch.mock.calls.filter((c) => c[1]?.method === "PUT")).toHaveLength(0);
  });

  // ── onComplete strategy ────────────────────────────────────────────────────

  it("saves on completed event (onComplete)", async () => {
    const obs = httpPersistence({ store, key: "w", strategy: "onComplete" });
    obs(completed, fakeEngine());
    await vi.runAllTimersAsync();
    expect(mockFetch.mock.calls.filter((c) => c[1]?.method === "PUT")).toHaveLength(1);
  });

  it("does NOT save on stateChanged (onComplete)", async () => {
    const obs = httpPersistence({ store, key: "w", strategy: "onComplete" });
    obs(stateChanged("next"), fakeEngine());
    await vi.runAllTimersAsync();
    expect(mockFetch.mock.calls.filter((c) => c[1]?.method === "PUT")).toHaveLength(0);
  });

  it("does NOT delete on completion with onComplete strategy", async () => {
    const obs = httpPersistence({ store, key: "w", strategy: "onComplete" });
    obs(completed, fakeEngine());
    await vi.runAllTimersAsync();
    expect(mockFetch.mock.calls.filter((c) => c[1]?.method === "DELETE")).toHaveLength(0);
  });

  // ── completion cleanup ─────────────────────────────────────────────────────

  it("deletes saved state when path completes (non-onComplete strategies)", async () => {
    const obs = httpPersistence({ store, key: "w", strategy: "onNext" });
    obs(completed, fakeEngine());
    await vi.runAllTimersAsync();
    expect(mockFetch.mock.calls.filter((c) => c[1]?.method === "DELETE")).toHaveLength(1);
  });

  // ── debouncing ─────────────────────────────────────────────────────────────

  it("debounces rapid saves", async () => {
    const obs = httpPersistence({ store, key: "w", strategy: "onEveryChange", debounceMs: 500 });
    obs(stateChanged("setData"), fakeEngine());
    obs(stateChanged("setData"), fakeEngine());
    obs(stateChanged("setData"), fakeEngine());

    await vi.advanceTimersByTimeAsync(400);
    expect(mockFetch.mock.calls.filter((c) => c[1]?.method === "PUT")).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(200);
    expect(mockFetch.mock.calls.filter((c) => c[1]?.method === "PUT")).toHaveLength(1);
  });

  // ── callbacks ─────────────────────────────────────────────────────────────

  it("calls onSaveSuccess after a successful save", async () => {
    const onSaveSuccess = vi.fn();
    const obs = httpPersistence({ store, key: "w", onSaveSuccess });
    obs(stateChanged("next"), fakeEngine());
    await vi.runAllTimersAsync();
    expect(onSaveSuccess).toHaveBeenCalled();
  });

  it("calls onSaveError when save fails", async () => {
    const failFetch = vi.fn(() =>
      Promise.resolve({ ok: false, status: 500, statusText: "Server Error" } as Response)
    );
    const failStore = new HttpStore({ baseUrl: "/api", fetch: failFetch as any });
    const onSaveError = vi.fn();

    const obs = httpPersistence({ store: failStore, key: "w", onSaveError });
    obs(stateChanged("next"), fakeEngine());
    await vi.runAllTimersAsync();

    expect(onSaveError).toHaveBeenCalledWith(expect.any(Error));
  });

  // ── engine integration (spot-checks) ──────────────────────────────────────
  // These verify the observer wires correctly when passed to a real PathEngine.

  it("receives real engine events when registered as observer", async () => {
    const events: string[] = [];
    const engine = new PathEngine({
      observers: [
        (event) => events.push(event.type),
        httpPersistence({ store, key: "w" }),
      ],
    });
    await engine.start(simplePath);
    mockFetch.mockClear();

    await engine.next();
    await vi.runAllTimersAsync();

    expect(events).toContain("stateChanged");
    expect(mockFetch.mock.calls.filter((c) => c[1]?.method === "PUT")).toHaveLength(1);
  });

  it("observer receives the engine instance as second argument", async () => {
    const capturedEngines: PathEngine[] = [];
    const engine = new PathEngine({
      observers: [(_event, eng) => capturedEngines.push(eng)],
    });
    await engine.start(simplePath);
    expect(capturedEngines[0]).toBe(engine);
  });

  it("observers fire before subscribe() listeners", async () => {
    const order: string[] = [];
    const engine = new PathEngine({
      observers: [() => order.push("observer")],
    });
    engine.subscribe(() => order.push("subscriber"));
    await engine.start(simplePath);
    expect(order[0]).toBe("observer");
    expect(order[1]).toBe("subscriber");
  });
});

// ---------------------------------------------------------------------------
// createPersistedEngine
// ---------------------------------------------------------------------------

describe("createPersistedEngine", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it("starts fresh when no saved state exists", async () => {
    const store = new HttpStore({ baseUrl: "/api", fetch: make404Fetch() as any });

    const { engine, restored } = await createPersistedEngine({ store, key: "test-wizard", path: simplePath });

    expect(restored).toBe(false);
    expect(engine.snapshot()?.stepId).toBe("step1");
  });

  it("restores from saved state when it exists", async () => {
    const savedState: SerializedPathState = {
      version: 1, pathId: "simple", currentStepIndex: 1,
      data: { name: "Restored" }, visitedStepIds: ["step1", "step2"],
      pathStack: [], _isNavigating: false,
    };
    const store = new HttpStore({
      baseUrl: "/api",
      fetch: vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(savedState) } as Response)) as any,
    });

    const { engine, restored } = await createPersistedEngine({ store, key: "test-wizard", path: simplePath, pathDefinitions });

    expect(restored).toBe(true);
    expect(engine.snapshot()?.stepId).toBe("step2");
    expect(engine.snapshot()?.data.name).toBe("Restored");
  });

  it("auto-saves on navigation after a fresh start", async () => {
    let callCount = 0;
    const mockFetch = vi.fn(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ ok: false, status: 404 } as Response);
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(null) } as Response);
    });
    const store = new HttpStore({ baseUrl: "/api", fetch: mockFetch as any });

    const { engine } = await createPersistedEngine({ store, key: "test-wizard", path: simplePath, strategy: "onNext" });

    mockFetch.mockClear();
    await engine.next();
    await vi.runAllTimersAsync();

    expect(mockFetch.mock.calls.filter((c: any) => c[1]?.method === "PUT")).toHaveLength(1);
  });

  it("auto-saves on navigation after restoration", async () => {
    const savedState: SerializedPathState = {
      version: 1, pathId: "simple", currentStepIndex: 0,
      data: {}, visitedStepIds: ["step1"], pathStack: [], _isNavigating: false,
    };
    let callCount = 0;
    const mockFetch = vi.fn(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(savedState) } as Response);
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(null) } as Response);
    });
    const store = new HttpStore({ baseUrl: "/api", fetch: mockFetch as any });

    const { engine } = await createPersistedEngine({ store, key: "test-wizard", path: simplePath, pathDefinitions });

    mockFetch.mockClear();
    await engine.next();
    await vi.runAllTimersAsync();

    expect(mockFetch.mock.calls.filter((c: any) => c[1]?.method === "PUT")).toHaveLength(1);
  });

  it("extra observers also receive events", async () => {
    const store = new HttpStore({ baseUrl: "/api", fetch: make404Fetch() as any });
    const extraEvents: string[] = [];

    const { engine } = await createPersistedEngine({
      store, key: "test-wizard", path: simplePath,
      observers: [(event) => extraEvents.push(event.type)],
    });

    await engine.next();
    expect(extraEvents).toContain("stateChanged");
  });

  it("calls onSaveSuccess after successful save", async () => {
    let callCount = 0;
    const mockFetch = vi.fn(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ ok: false, status: 404 } as Response);
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(null) } as Response);
    });
    const store = new HttpStore({ baseUrl: "/api", fetch: mockFetch as any });
    const onSaveSuccess = vi.fn();

    const { engine } = await createPersistedEngine({ store, key: "test-wizard", path: simplePath, onSaveSuccess });

    await engine.next();
    await vi.runAllTimersAsync();
    expect(onSaveSuccess).toHaveBeenCalled();
  });

  it("defaults pathDefinitions to { [path.id]: path }", async () => {
    const savedState: SerializedPathState = {
      version: 1, pathId: "simple", currentStepIndex: 1,
      data: {}, visitedStepIds: ["step1", "step2"], pathStack: [], _isNavigating: false,
    };
    const store = new HttpStore({
      baseUrl: "/api",
      fetch: vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(savedState) } as Response)) as any,
    });

    const { engine, restored } = await createPersistedEngine({ store, key: "test-wizard", path: simplePath });

    expect(restored).toBe(true);
    expect(engine.snapshot()?.stepId).toBe("step2");
  });
});

