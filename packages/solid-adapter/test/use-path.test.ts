// @vitest-environment jsdom
import { describe, test, expect, vi } from "vitest";
import { createRoot } from "solid-js";
import { usePath } from "../src/index.js";
import { PathEngine } from "@daltonr/pathwrite-core";
import type { PathDefinition } from "@daltonr/pathwrite-core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Run a test inside a Solid reactive root and clean up when done. */
function withRoot<T>(fn: (dispose: () => void) => T): T {
  return createRoot(fn);
}

const twoStepPath: PathDefinition = {
  id: "two-step",
  steps: [
    { id: "first",  title: "First"  },
    { id: "second", title: "Second" },
  ],
};

const singleStepPath: PathDefinition = {
  id: "single",
  steps: [{ id: "only" }],
};

// ---------------------------------------------------------------------------
// usePath — snapshot lifecycle
// ---------------------------------------------------------------------------

describe("usePath — snapshot lifecycle", () => {
  test("snapshot starts null", () => {
    withRoot(dispose => {
      const path = usePath();
      expect(path.snapshot()).toBeNull();
      dispose();
    });
  });

  test("snapshot is non-null after start()", async () => {
    await withRoot(async dispose => {
      const path = usePath();
      await path.start(twoStepPath, {});
      expect(path.snapshot()).not.toBeNull();
      expect(path.snapshot()!.stepId).toBe("first");
      dispose();
    });
  });

  test("snapshot becomes null after cancel()", async () => {
    await withRoot(async dispose => {
      const path = usePath();
      await path.start(twoStepPath, {});
      await path.cancel();
      expect(path.snapshot()).toBeNull();
      dispose();
    });
  });

  test("snapshot becomes completed after complete", async () => {
    await withRoot(async dispose => {
      const path = usePath();
      await path.start(singleStepPath, {});
      await path.next();
      expect(path.snapshot()?.status).toBe("completed");
      dispose();
    });
  });

  test("seeded from external engine that is already started", async () => {
    await withRoot(async dispose => {
      const engine = new PathEngine();
      await engine.start(twoStepPath, {});
      const path = usePath({ engine });
      expect(path.snapshot()).not.toBeNull();
      expect(path.snapshot()!.stepId).toBe("first");
      dispose();
    });
  });

  test("unsubscribes on cleanup", async () => {
    const engine = new PathEngine();
    let callCount = 0;

    await new Promise<void>(resolve => {
      createRoot(async dispose => {
        usePath({ engine, onEvent: () => callCount++ });
        await engine.start(twoStepPath, {});
        expect(callCount).toBeGreaterThan(0);
        const countAfterDispose = callCount;
        dispose();
        await engine.next();
        expect(callCount).toBe(countAfterDispose);
        resolve();
      });
    });
  });
});

// ---------------------------------------------------------------------------
// usePath — navigation
// ---------------------------------------------------------------------------

describe("usePath — navigation", () => {
  test("next() advances the step", async () => {
    await withRoot(async dispose => {
      const path = usePath();
      await path.start(twoStepPath, {});
      expect(path.snapshot()!.stepId).toBe("first");
      await path.next();
      expect(path.snapshot()!.stepId).toBe("second");
      dispose();
    });
  });

  test("previous() goes back", async () => {
    await withRoot(async dispose => {
      const path = usePath();
      await path.start(twoStepPath, {});
      await path.next();
      expect(path.snapshot()!.stepId).toBe("second");
      await path.previous();
      expect(path.snapshot()!.stepId).toBe("first");
      dispose();
    });
  });

  test("isFirstStep and isLastStep are correct", async () => {
    await withRoot(async dispose => {
      const path = usePath();
      await path.start(twoStepPath, {});
      expect(path.snapshot()!.isFirstStep).toBe(true);
      expect(path.snapshot()!.isLastStep).toBe(false);
      await path.next();
      expect(path.snapshot()!.isFirstStep).toBe(false);
      expect(path.snapshot()!.isLastStep).toBe(true);
      dispose();
    });
  });

  test("goToStep() jumps directly", async () => {
    await withRoot(async dispose => {
      const path = usePath();
      await path.start(twoStepPath, {});
      await path.goToStep("second");
      expect(path.snapshot()!.stepId).toBe("second");
      dispose();
    });
  });

  test("restart() resets to first step", async () => {
    await withRoot(async dispose => {
      const path = usePath();
      await path.start(twoStepPath, {});
      await path.next();
      expect(path.snapshot()!.stepId).toBe("second");
      await path.restart();
      expect(path.snapshot()!.stepId).toBe("first");
      dispose();
    });
  });
});

// ---------------------------------------------------------------------------
// usePath — data
// ---------------------------------------------------------------------------

describe("usePath — data", () => {
  test("setData() updates snapshot data", async () => {
    await withRoot(async dispose => {
      const path = usePath();
      await path.start(twoStepPath, { name: "" });
      await path.setData("name", "Alice");
      expect(path.snapshot()!.data.name).toBe("Alice");
      dispose();
    });
  });

  test("initialData is reflected in snapshot", async () => {
    await withRoot(async dispose => {
      const path = usePath();
      await path.start(twoStepPath, { name: "Bob", age: 30 });
      expect(path.snapshot()!.data.name).toBe("Bob");
      expect(path.snapshot()!.data.age).toBe(30);
      dispose();
    });
  });
});

// ---------------------------------------------------------------------------
// usePath — validation
// ---------------------------------------------------------------------------

describe("usePath — validation", () => {
  test("hasAttemptedNext is false initially", async () => {
    await withRoot(async dispose => {
      const path = usePath();
      await path.start(twoStepPath, {});
      expect(path.snapshot()!.hasAttemptedNext).toBe(false);
      dispose();
    });
  });

  test("hasValidated is false initially", async () => {
    await withRoot(async dispose => {
      const path = usePath();
      await path.start(twoStepPath, {});
      expect(path.snapshot()!.hasValidated).toBe(false);
      dispose();
    });
  });

  test("validate() sets hasValidated to true", async () => {
    await withRoot(async dispose => {
      const path = usePath();
      await path.start(twoStepPath, {});
      path.validate();
      expect(path.snapshot()!.hasValidated).toBe(true);
      dispose();
    });
  });

  test("hasValidated resets on restart()", async () => {
    await withRoot(async dispose => {
      const path = usePath();
      await path.start(twoStepPath, {});
      path.validate();
      expect(path.snapshot()!.hasValidated).toBe(true);
      await path.restart();
      expect(path.snapshot()!.hasValidated).toBe(false);
      dispose();
    });
  });

  test("fieldErrors from canMoveNext are exposed on snapshot", async () => {
    const guardedPath: PathDefinition = {
      id: "guarded",
      steps: [
        {
          id: "form",
          fieldErrors: ({ data }) => data.name ? {} : { name: "Required" },
        },
        { id: "review" },
      ],
    };
    await withRoot(async dispose => {
      const path = usePath();
      await path.start(guardedPath, { name: "" });
      await path.next();
      expect(path.snapshot()!.hasAttemptedNext).toBe(true);
      expect(path.snapshot()!.fieldErrors.name).toBe("Required");
      dispose();
    });
  });
});

// ---------------------------------------------------------------------------
// usePath — events
// ---------------------------------------------------------------------------

describe("usePath — events", () => {
  test("onEvent is called on state changes", async () => {
    await withRoot(async dispose => {
      const onEvent = vi.fn();
      const path = usePath({ onEvent });
      await path.start(twoStepPath, {});
      expect(onEvent).toHaveBeenCalled();
      dispose();
    });
  });

  test("onEvent receives completed event", async () => {
    await withRoot(async dispose => {
      const events: string[] = [];
      const path = usePath({ onEvent: e => events.push(e.type) });
      await path.start(singleStepPath, {});
      await path.next();
      expect(events).toContain("completed");
      dispose();
    });
  });

  test("onEvent receives cancelled event", async () => {
    await withRoot(async dispose => {
      const events: string[] = [];
      const path = usePath({ onEvent: e => events.push(e.type) });
      await path.start(twoStepPath, {});
      await path.cancel();
      expect(events).toContain("cancelled");
      dispose();
    });
  });
});
