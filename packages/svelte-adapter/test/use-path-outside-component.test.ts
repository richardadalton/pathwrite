// @vitest-environment jsdom
//
// jsdom so the Svelte plugin compiles `index.svelte.ts` in client mode, which
// is what runs in a browser.
//
// Deliberately does NOT mock `svelte`. Every other test file in this package
// stubs `onDestroy` out, one of them with the comment "usePath() calls
// onDestroy(), which needs a component context; stub it out" — which is the
// defect these tests exist to catch, recorded as a workaround. `usePath()`
// wraps its watcher in `$effect.root` specifically so it works outside a
// component, so the two must not contradict each other.
import { describe, expect, it, vi } from "vitest";
import { PathEngine } from "@daltonr/pathwrite-core";
import type { PathDefinition } from "@daltonr/pathwrite-core";

vi.mock("../src/PathShell.svelte", () => ({ default: {} }));

import { usePath } from "../src/index.svelte";

const twoStep: PathDefinition = { id: "main", steps: [{ id: "a" }, { id: "b" }] };

describe("usePath outside a component", () => {
  it("can be called from a plain module, not only from a component", () => {
    // A store in `stores.svelte.ts`, or anything inside a caller's own
    // $effect.root, has no component context.
    expect(() => usePath()).not.toThrow();
  });

  it("tracks engine state when created outside a component", async () => {
    const path = usePath();
    await path.start(twoStep, { name: "Ada" });

    expect(path.snapshot?.stepId).toBe("a");
    expect(path.snapshot?.data.name).toBe("Ada");

    await path.next();
    expect(path.snapshot?.stepId).toBe("b");
  });

  it("destroy() releases the engine subscription", async () => {
    // Outside a component there is no lifecycle to hang cleanup on, so the
    // caller must be able to release it. Without this the subscription and the
    // effect root leak for the lifetime of the module.
    const engine = new PathEngine();
    const path = usePath({ engine });
    await engine.start(twoStep, {});
    expect(path.snapshot?.stepId).toBe("a");

    path.destroy();

    await engine.next();
    expect(path.snapshot?.stepId, "snapshot kept updating after destroy()").toBe("a");
  });

  it("destroy() is safe to call more than once", async () => {
    const path = usePath();
    await path.start(twoStep, {});
    path.destroy();
    expect(() => path.destroy()).not.toThrow();
  });
});
