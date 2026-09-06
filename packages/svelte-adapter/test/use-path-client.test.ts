// @vitest-environment jsdom
//
// The jsdom environment matters: under vitest's default `node` environment the
// Svelte plugin compiles `index.svelte.ts` in server mode, where `$state` is a
// plain variable and nothing is proxied. Client mode is what runs in browsers.
import { describe, expect, it, vi } from "vitest";
import type { PathDefinition, PathEvent, PathSnapshot } from "@daltonr/pathwrite-core";

vi.mock("../src/PathShell.svelte", () => ({ default: {} }));

import { usePath } from "../src/index.svelte";

const twoStepPath: PathDefinition = { id: "main", steps: [{ id: "step1" }, { id: "step2" }] };

describe("usePath (client build) — snapshot storage", () => {
  it("holds the engine's own snapshot object, not a reactive proxy of it", async () => {
    // Snapshots are immutable values the engine replaces wholesale on every
    // change, so the store must hold them raw: a deep `$state` proxy would wrap
    // every snapshot (and its `data`) for nothing.
    let emitted: PathSnapshot | null = null;
    const path = usePath({
      onEvent: (event: PathEvent) => {
        if (event.type === "stateChanged") emitted = event.snapshot;
      },
    });
    await path.start(twoStepPath, { name: "Ada" });
    expect(emitted).not.toBeNull();
    expect(path.snapshot).toBe(emitted);
    expect(path.snapshot?.data).toBe(emitted!.data);
  });
});
