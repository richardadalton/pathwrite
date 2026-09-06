import { describe, it, expect, vi, beforeEach } from "vitest";
import { PathEngine } from "@daltonr/pathwrite-core";
import type { PathDefinition, PathStore, SerializedPathState } from "@daltonr/pathwrite-core";
import { persistence, restoreOrStart } from "../src/index";
import { captureExpectedConsole } from "#test-utils/console";

// The tombstone test forces the completion delete to fail, which the observer
// reports with console.warn. Expected here; anything else still fails.
beforeEach(() => {
  captureExpectedConsole(["Failed to delete saved state after completion"]);
});

/**
 * Invariants for persistence.
 *
 * Named "invariants" rather than "properties": these state guarantees but drive
 * them with fixed scenarios, not generated ones. Generating over the real space
 * — strategy x debounce x event sequence x store latency — is the stronger
 * version and is not done here.
 *
 * This package had no property or invariant tests. Its existing suite is
 * example-based, and in at least one case an example encoded a defect as
 * correct: the test for a failing `load` asserts that the record is deleted,
 * which is right for a corrupt record and destroys a user's progress when the
 * store was merely unreachable.
 *
 * These state the guarantees a persistence layer owes its user. The strongest
 * one is negative: saved work is not thrown away because of a transient fault.
 */

const path: PathDefinition = { id: "p", steps: [{ id: "a" }, { id: "b" }, { id: "c" }] };

/** In-memory store with controllable faults, recording every operation. */
class ProbeStore implements PathStore {
  records = new Map<string, SerializedPathState>();
  ops: string[] = [];
  failLoad: Error | null = null;
  failDelete: Error | null = null;
  saveDelayMs = 0;

  async save(key: string, state: SerializedPathState): Promise<void> {
    if (this.saveDelayMs) await new Promise((r) => setTimeout(r, this.saveDelayMs));
    this.ops.push(`save:${state.currentStepIndex}`);
    this.records.set(key, state);
  }
  async load(key: string): Promise<SerializedPathState | null> {
    this.ops.push("load");
    if (this.failLoad) throw this.failLoad;
    return this.records.get(key) ?? null;
  }
  async delete(key: string): Promise<void> {
    this.ops.push("delete");
    if (this.failDelete) throw this.failDelete;
    this.records.delete(key);
  }
}

/** Seeds a store with a genuine record saved at step index 1. */
async function seed(store: ProbeStore, key: string) {
  const engine = new PathEngine();
  await engine.start(path, {});
  await engine.next();
  await store.save(key, engine.exportState()!);
  store.ops = [];
  return store.records.get(key)!;
}

describe("invariant: saved work survives a transient fault", () => {
  // A 503 during a deploy, an expired token, a dropped mobile connection. None
  // of these say anything about whether the stored record is any good, so none
  // of them may destroy it.
  it("a record is never deleted when the store merely failed to respond", async () => {
    const transient = [
      Object.assign(new Error("HTTP 503: Service Unavailable"), { name: "Error" }),
      Object.assign(new Error("HTTP 401: Unauthorized"), { name: "Error" }),
      Object.assign(new Error("fetch failed"), { name: "TypeError" }),
      Object.assign(new Error("The operation was aborted"), { name: "AbortError" }),
    ];

    for (const err of transient) {
      const store = new ProbeStore();
      const saved = await seed(store, "k");
      store.failLoad = err;

      await restoreOrStart({ store, key: "k", path, onRestoreError: () => {} });

      expect(store.records.get("k"), `record was destroyed after a transient "${err.message}"`).toEqual(
        saved
      );
      expect(store.ops, `delete was issued after a transient "${err.message}"`).not.toContain("delete");
    }
  });

  // The counterpart: a record that was read and is genuinely unusable may be
  // cleared, otherwise the app can never start again.
  it("a record that was read and is unusable may still be dropped", async () => {
    const store = new ProbeStore();
    await seed(store, "k");
    store.records.set("k", { ...store.records.get("k")!, version: 999 } as unknown as SerializedPathState);

    const r = await restoreOrStart({ store, key: "k", path, onRestoreError: () => {} });

    expect(r.restored).toBe(false);
    expect(store.records.has("k")).toBe(false);
  });
});

describe("invariant: a completed path leaves nothing behind", () => {
  // The record holds whatever the user typed. Once the path is finished it must
  // not linger, and nothing queued earlier may write it back.
  it("no write lands after completion, even with a debounce in flight", async () => {
    vi.useFakeTimers();
    try {
      const store = new ProbeStore();
      const engine = new PathEngine({
        observers: [persistence({ store, key: "k", strategy: "onEveryChange", debounceMs: 50 })],
      });
      await engine.start(path, {});
      await engine.next();
      await engine.next();
      await engine.setData("typed", "secret"); // arms the debounce timer
      await engine.next(); // completes the path

      await vi.advanceTimersByTimeAsync(500);

      expect(store.records.has("k"), "the record was written back after completion").toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("flush() after completion does not resurrect the record", async () => {
    const store = new ProbeStore();
    const observer = persistence({ store, key: "k", strategy: "onNext" });
    const engine = new PathEngine({ observers: [observer] });
    await engine.start(path, {});
    await engine.next();
    await engine.next();
    await engine.next(); // completes

    await observer.flush?.();

    expect(store.records.has("k"), "flush() re-created a completed path's record").toBe(false);
  });
});

describe("invariant: a finished path is never resumed", () => {
  // If the completion delete fails there is still a record on the server. What
  // must not happen is a returning user being dropped back on the final step,
  // where pressing Next runs onComplete a second time and submits twice.
  it("a failed completion delete does not resume the user into a second submit", async () => {
    const store = new ProbeStore();
    let completions = 0;
    const submitting: PathDefinition = {
      ...path,
      onComplete: () => {
        completions++;
      },
    };

    const observer = persistence({ store, key: "k", strategy: "onNext" });
    const engine = new PathEngine({ observers: [observer] });
    await engine.start(submitting, {});
    await engine.next();
    await engine.next();
    store.failDelete = new Error("HTTP 500");
    await engine.next(); // completes; the delete fails
    await observer.flush?.();

    expect(completions).toBe(1);

    // A record survived. Restoring from it must not put the user back inside a
    // path that has already run onComplete.
    if (store.records.has("k")) {
      const r = await restoreOrStart({
        store,
        key: "k",
        path: submitting,
        onRestoreError: () => {},
      });
      if (r.restored) {
        await r.engine.next();
        expect(completions, "onComplete ran twice after a failed completion delete").toBe(1);
      }
    }
  });
});
