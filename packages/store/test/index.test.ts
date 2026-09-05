import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HttpStore, persistence, restoreOrStart } from "../src/index";
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
  _status: "idle",
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
    expect(await store.load("user:999")).toBeNull();
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
// persistence observer
// ---------------------------------------------------------------------------

describe("persistence", () => {
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

  function fakeEngine(state: SerializedPathState = mockState) {
    return { exportState: () => state } as unknown as PathEngine;
  }

  type Cause = "start" | "next" | "previous" | "goToStep" | "goToStepChecked" | "setData" | "cancel" | "restart";

  function stateChanged(cause: Cause, busy = false) {
    return { type: "stateChanged" as const, cause, snapshot: { status: busy ? "validating" : "idle" } as any };
  }

  const resumed = {
    type: "resumed" as const,
    resumedPathId: "parent",
    fromSubPathId: "sub",
    snapshot: { status: "idle" } as any,
  };

  const completed = { type: "completed" as const, pathId: "simple", data: {} };

  it("saves on settled next stateChanged (onNext)", async () => {
    const obs = persistence({ store, key: "w" });
    obs(stateChanged("next"), fakeEngine());
    await vi.runAllTimersAsync();
    expect(mockFetch.mock.calls.filter((c) => c[1]?.method === "PUT")).toHaveLength(1);
  });

  it("does NOT save on mid-navigation stateChanged (busy status)", async () => {
    const obs = persistence({ store, key: "w" });
    obs(stateChanged("next", true), fakeEngine());
    await vi.runAllTimersAsync();
    expect(mockFetch.mock.calls.filter((c) => c[1]?.method === "PUT")).toHaveLength(0);
  });

  it("does NOT save on setData stateChanged (onNext)", async () => {
    const obs = persistence({ store, key: "w" });
    obs(stateChanged("setData"), fakeEngine());
    await vi.runAllTimersAsync();
    expect(mockFetch.mock.calls.filter((c) => c[1]?.method === "PUT")).toHaveLength(0);
  });

  it("saves on settled stateChanged (onEveryChange)", async () => {
    const obs = persistence({ store, key: "w", strategy: "onEveryChange" });
    obs(stateChanged("setData"), fakeEngine());
    await vi.runAllTimersAsync();
    expect(mockFetch.mock.calls.filter((c) => c[1]?.method === "PUT")).toHaveLength(1);
  });

  it("saves on resumed event (onEveryChange)", async () => {
    const obs = persistence({ store, key: "w", strategy: "onEveryChange" });
    obs(resumed, fakeEngine());
    await vi.runAllTimersAsync();
    expect(mockFetch.mock.calls.filter((c) => c[1]?.method === "PUT")).toHaveLength(1);
  });

  it("never auto-saves with manual strategy", async () => {
    const obs = persistence({ store, key: "w", strategy: "manual" });
    obs(stateChanged("next"), fakeEngine());
    obs(stateChanged("setData"), fakeEngine());
    obs(resumed, fakeEngine());
    await vi.runAllTimersAsync();
    expect(mockFetch.mock.calls.filter((c) => c[1]?.method === "PUT")).toHaveLength(0);
  });

  it("saves on resumed event (onSubPathComplete)", async () => {
    const obs = persistence({ store, key: "w", strategy: "onSubPathComplete" });
    obs(resumed, fakeEngine());
    await vi.runAllTimersAsync();
    expect(mockFetch.mock.calls.filter((c) => c[1]?.method === "PUT")).toHaveLength(1);
  });

  it("saves on completed event (onComplete)", async () => {
    const obs = persistence({ store, key: "w", strategy: "onComplete" });
    obs(completed, fakeEngine());
    await vi.runAllTimersAsync();
    expect(mockFetch.mock.calls.filter((c) => c[1]?.method === "PUT")).toHaveLength(1);
  });

  it("does NOT delete on completion with onComplete strategy", async () => {
    const obs = persistence({ store, key: "w", strategy: "onComplete" });
    obs(completed, fakeEngine());
    await vi.runAllTimersAsync();
    expect(mockFetch.mock.calls.filter((c) => c[1]?.method === "DELETE")).toHaveLength(0);
  });

  it("deletes saved state when path completes (non-onComplete strategies)", async () => {
    const obs = persistence({ store, key: "w", strategy: "onNext" });
    obs(completed, fakeEngine());
    await vi.runAllTimersAsync();
    expect(mockFetch.mock.calls.filter((c) => c[1]?.method === "DELETE")).toHaveLength(1);
  });

  it("debounces rapid saves", async () => {
    const obs = persistence({ store, key: "w", strategy: "onEveryChange", debounceMs: 500 });
    obs(stateChanged("setData"), fakeEngine());
    obs(stateChanged("setData"), fakeEngine());
    obs(stateChanged("setData"), fakeEngine());
    await vi.advanceTimersByTimeAsync(400);
    expect(mockFetch.mock.calls.filter((c) => c[1]?.method === "PUT")).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(200);
    expect(mockFetch.mock.calls.filter((c) => c[1]?.method === "PUT")).toHaveLength(1);
  });

  it("calls onSaveSuccess after a successful save", async () => {
    const onSaveSuccess = vi.fn();
    const obs = persistence({ store, key: "w", onSaveSuccess });
    obs(stateChanged("next"), fakeEngine());
    await vi.runAllTimersAsync();
    expect(onSaveSuccess).toHaveBeenCalled();
  });

  it("calls onSaveError when save fails", async () => {
    const failStore = new HttpStore({
      baseUrl: "/api",
      fetch: vi.fn(() => Promise.resolve({ ok: false, status: 500, statusText: "Server Error" } as Response)) as any,
    });
    const onSaveError = vi.fn();
    const obs = persistence({ store: failStore, key: "w", onSaveError });
    obs(stateChanged("next"), fakeEngine());
    await vi.runAllTimersAsync();
    expect(onSaveError).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ---------------------------------------------------------------------------
// restoreOrStart
// ---------------------------------------------------------------------------

describe("restoreOrStart", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it("starts fresh when no saved state exists", async () => {
    const store = new HttpStore({ baseUrl: "/api", fetch: make404Fetch() as any });
    const { engine, restored } = await restoreOrStart({ store, key: "test-wizard", path: simplePath });
    expect(restored).toBe(false);
    expect(engine.snapshot()?.stepId).toBe("step1");
  });

  it("marks the engine as persisted on a fresh start", async () => {
    const store = new HttpStore({ baseUrl: "/api", fetch: make404Fetch() as any });
    const { engine } = await restoreOrStart({ store, key: "test-wizard", path: simplePath });
    expect(engine.snapshot()?.hasPersistence).toBe(true);
  });

  it("marks the engine as persisted on a restore", async () => {
    const savedState: SerializedPathState = {
      version: 1, pathId: "simple", currentStepIndex: 0,
      data: {}, visitedStepIds: ["step1"], pathStack: [], _status: "idle",
    };
    const store = new HttpStore({
      baseUrl: "/api",
      fetch: vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(savedState) } as Response)) as any,
    });
    const { engine } = await restoreOrStart({ store, key: "test-wizard", path: simplePath, pathDefinitions });
    expect(engine.snapshot()?.hasPersistence).toBe(true);
  });

  it("restores from saved state when it exists", async () => {
    const savedState: SerializedPathState = {
      version: 1, pathId: "simple", currentStepIndex: 1,
      data: { name: "Restored" }, visitedStepIds: ["step1", "step2"],
      pathStack: [], _status: "idle",
    };
    const store = new HttpStore({
      baseUrl: "/api",
      fetch: vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(savedState) } as Response)) as any,
    });
    const { engine, restored } = await restoreOrStart({ store, key: "test-wizard", path: simplePath, pathDefinitions });
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
    const { engine } = await restoreOrStart({
      store, key: "test-wizard", path: simplePath,
      observers: [persistence({ store, key: "test-wizard", strategy: "onNext" })],
    });
    mockFetch.mockClear();
    await engine.next();
    await vi.runAllTimersAsync();
    expect(mockFetch.mock.calls.filter((c: any) => c[1]?.method === "PUT")).toHaveLength(1);
  });

  it("defaults pathDefinitions to { [path.id]: path }", async () => {
    const savedState: SerializedPathState = {
      version: 1, pathId: "simple", currentStepIndex: 1,
      data: {}, visitedStepIds: ["step1", "step2"], pathStack: [], _status: "idle",
    };
    const store = new HttpStore({
      baseUrl: "/api",
      fetch: vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(savedState) } as Response)) as any,
    });
    const { engine, restored } = await restoreOrStart({ store, key: "test-wizard", path: simplePath });
    expect(restored).toBe(true);
    expect(engine.snapshot()?.stepId).toBe("step2");
  });
});

// ---------------------------------------------------------------------------
// persistence — driven by a real engine and a slow store (review finding S1)
// ---------------------------------------------------------------------------

/** In-memory PathStore whose save() only completes when the test releases it. */
class SlowStore {
  public saved: SerializedPathState[] = [];
  private releases: Array<() => void> = [];
  public failNext = false;

  save(_key: string, state: SerializedPathState): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.releases.push(() => {
        if (this.failNext) { this.failNext = false; reject(new Error("save failed")); return; }
        this.saved.push(JSON.parse(JSON.stringify(state)));
        resolve();
      });
    });
  }
  load(): Promise<SerializedPathState | null> { return Promise.resolve(null); }
  delete(): Promise<void> { return Promise.resolve(); }

  /** Number of saves currently waiting on the "network". */
  get inFlight(): number { return this.releases.length; }
  /** Complete the oldest in-flight save. */
  release(): void { this.releases.shift()?.(); }
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("persistence — real engine, slow store (S1)", () => {
  const threeSteps: PathDefinition = { id: "p", steps: [{ id: "s1" }, { id: "s2" }, { id: "s3" }] };

  it("a change that arrives while a save is in flight is saved afterwards, not dropped", async () => {
    const store = new SlowStore();
    const engine = new PathEngine({ observers: [persistence({ store, key: "k", strategy: "onNext" })] });
    await engine.start(threeSteps);

    await engine.next();            // → s2: save #1 starts and hangs
    expect(store.inFlight).toBe(1);
    await engine.next();            // → s3 while save #1 is still in flight
    expect(engine.snapshot()?.stepIndex).toBe(2);

    store.release();                // save #1 lands (state at s2)
    await flush();
    expect(store.inFlight).toBe(1); // a follow-up save for the newer state must be in flight
    store.release();
    await flush();

    expect(store.saved.map((s) => s.currentStepIndex)).toEqual([1, 2]);
    expect(store.saved.at(-1)?.currentStepIndex).toBe(engine.exportState()?.currentStepIndex);
  });

  it("several changes during one in-flight save collapse into a single follow-up save of the latest state", async () => {
    const store = new SlowStore();
    const engine = new PathEngine({ observers: [persistence({ store, key: "k", strategy: "onEveryChange" })] });
    await engine.start(threeSteps);
    // start() itself triggered a save under onEveryChange
    expect(store.inFlight).toBe(1);

    await engine.setData("a", 1);
    await engine.setData("b", 2);
    await engine.setData("c", 3);
    expect(store.inFlight).toBe(1); // still only the first save on the wire

    store.release();
    await flush();
    expect(store.inFlight).toBe(1); // exactly one follow-up
    store.release();
    await flush();

    expect(store.saved).toHaveLength(2);
    expect(store.saved[1].data).toEqual({ a: 1, b: 2, c: 3 });
  });

  it("a change that arrives while a save is failing is still saved afterwards", async () => {
    const store = new SlowStore();
    const errors: Error[] = [];
    const engine = new PathEngine({
      observers: [persistence({ store, key: "k", strategy: "onNext", onSaveError: (e) => errors.push(e) })]
    });
    await engine.start(threeSteps);

    await engine.next();
    await engine.next();
    store.failNext = true;
    store.release();                // save #1 fails
    await flush();
    expect(errors).toHaveLength(1);
    expect(store.inFlight).toBe(1); // follow-up still attempted
    store.release();
    await flush();

    expect(store.saved.map((s) => s.currentStepIndex)).toEqual([2]);
  });
});

// ---------------------------------------------------------------------------
// onComplete strategy record and restoreOrStart (review finding S2)
// ---------------------------------------------------------------------------

/** In-memory PathStore that keeps the last saved record. */
class MemoryStore {
  public records = new Map<string, SerializedPathState>();
  public deletes = 0;
  save(key: string, state: SerializedPathState): Promise<void> { this.records.set(key, JSON.parse(JSON.stringify(state))); return Promise.resolve(); }
  load(key: string): Promise<SerializedPathState | null> { return Promise.resolve(this.records.get(key) ?? null); }
  delete(key: string): Promise<void> { this.deletes++; this.records.delete(key); return Promise.resolve(); }
}

describe("persistence onComplete + restoreOrStart (S2)", () => {
  const twoSteps: PathDefinition = { id: "audit", steps: [{ id: "a" }, { id: "b" }] };

  it("writes a valid, recognisably final record (stayOnFinal)", async () => {
    const store = new MemoryStore();
    const engine = new PathEngine({ observers: [persistence({ store, key: "k", strategy: "onComplete" })] });
    await engine.start(twoSteps, { name: "" });
    await engine.setData("name", "Ada");
    await engine.next();
    await engine.next();
    await flush();

    const rec = store.records.get("k")!;
    expect(rec).toBeDefined();
    expect(rec.data).toEqual({ name: "Ada" });
    expect(rec._status).toBe("completed");
    expect(rec.currentStepIndex).toBeGreaterThanOrEqual(0);
    expect(rec.currentStepIndex).toBeLessThan(twoSteps.steps.length);
    expect(store.deletes).toBe(0); // audit record is left in place
  });

  it("writes the final data even when the path dismisses on completion", async () => {
    const store = new MemoryStore();
    const engine = new PathEngine({ observers: [persistence({ store, key: "k", strategy: "onComplete" })] });
    await engine.start({ ...twoSteps, completionBehaviour: "dismiss" }, { name: "" });
    await engine.setData("name", "Ada");
    await engine.next();
    await engine.next();
    await flush();

    const rec = store.records.get("k")!;
    expect(rec.data).toEqual({ name: "Ada" });
    expect(rec._status).toBe("completed");
    expect(rec.currentStepIndex).toBeGreaterThanOrEqual(0);
  });

  it("restoreOrStart starts fresh (not on step 1 with the final data) when it finds the record", async () => {
    const store = new MemoryStore();
    const engine = new PathEngine({ observers: [persistence({ store, key: "k", strategy: "onComplete" })] });
    await engine.start(twoSteps, { name: "" });
    await engine.setData("name", "Ada");
    await engine.next();
    await engine.next();
    await flush();

    const { engine: next, restored } = await restoreOrStart({ store, key: "k", path: twoSteps, initialData: { name: "" } });
    expect(restored).toBe(false);
    const s = next.snapshot()!;
    expect(s.status).toBe("idle");
    expect(s.stepId).toBe("a");
    expect(s.data).toEqual({ name: "" });
  });

  it("restoreOrStart also starts fresh for a record written by an older version (currentStepIndex: -1)", async () => {
    const store = new MemoryStore();
    store.records.set("k", { version: 1, pathId: "audit", currentStepIndex: -1, data: { name: "Ada" }, visitedStepIds: [], pathStack: [], _status: "idle" });
    const { engine, restored } = await restoreOrStart({ store, key: "k", path: twoSteps, initialData: { name: "" } });
    expect(restored).toBe(false);
    expect(engine.snapshot()?.stepId).toBe("a");
    expect(engine.snapshot()?.data).toEqual({ name: "" });
  });
});
