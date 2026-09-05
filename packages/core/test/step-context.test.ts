import { describe, expect, it } from "vitest";
import { PathEngine, type PathStepContext } from "../src/index";

/**
 * Every hook that receives a PathStepContext must get the same shape: the
 * owning path id, the step id, a *copy* of the data (so a hook that mutates
 * it cannot reach into the engine), and isFirstEntry reflecting the visit
 * history. This pins that contract across all ten call sites so they can be
 * built by one helper.
 */

const flush = () => new Promise((r) => setTimeout(r, 0));

const checkCtx = (ctx: PathStepContext, pathId: string, stepId: string, data: unknown) => {
  expect(ctx.pathId).toBe(pathId);
  expect(ctx.stepId).toBe(stepId);
  expect(ctx.data).toEqual(data);
};

describe("PathStepContext shape", () => {
  it("gives every hook the path id, step id, a data copy and isFirstEntry", async () => {
    const seen: Record<string, PathStepContext[]> = {};
    const record = (name: string) => (ctx: PathStepContext) => {
      // Record what the hook received, then mutate it: the mutation must not
      // reach the engine or any later hook.
      (seen[name] ??= []).push({ ...ctx, data: { ...ctx.data } });
      (ctx.data as Record<string, unknown>).leak = name;
    };

    const engine = new PathEngine();
    await engine.start(
      {
        id: "p",
        steps: [
          {
            id: "a",
            onEnter: record("onEnter"),
            onLeave: record("onLeave"),
            canMoveNext: (ctx) => {
              record("canMoveNext")(ctx);
              return true;
            },
            fieldErrors: (ctx) => {
              record("fieldErrors")(ctx);
              return {};
            },
            fieldWarnings: (ctx) => {
              record("fieldWarnings")(ctx);
              return {};
            },
          },
          {
            id: "skipper",
            shouldSkip: (ctx) => {
              record("shouldSkip")(ctx);
              return true;
            },
          },
          {
            id: "choice",
            select: (ctx) => {
              record("select")(ctx);
              return "x";
            },
            steps: [{ id: "x", canMovePrevious: (ctx) => (record("canMovePrevious")(ctx), true) }],
          },
          {
            id: "host",
            onSubPathComplete: (_id, _data, ctx) => record("onSubPathComplete")(ctx),
            onSubPathCancel: (_id, _data, ctx) => record("onSubPathCancel")(ctx),
          },
        ],
      },
      { v: 1 }
    );
    await flush();
    engine.setData("v", 2);
    await engine.next(); // a -> (skip skipper) -> choice/x
    await engine.previous(); // back to a
    await engine.next(); // forward again to choice/x
    await engine.next(); // host
    await engine.startSubPath({ id: "sub", steps: [{ id: "s" }] });
    await engine.cancel();
    await engine.startSubPath({ id: "sub", steps: [{ id: "s" }] });
    await engine.next();

    // Nothing leaked back into the engine.
    expect(engine.snapshot().data).toEqual({ v: 2 });

    const first = (name: string) => seen[name][0];
    checkCtx(first("onEnter"), "p", "a", { v: 1 });
    expect(first("onEnter").isFirstEntry).toBe(true);
    // Re-entering "a" after previous() is not a first entry.
    expect(seen.onEnter.filter((c) => c.stepId === "a")[1].isFirstEntry).toBe(false);

    checkCtx(first("onLeave"), "p", "a", { v: 2 });
    expect(first("onLeave").isFirstEntry).toBe(false);
    // The snapshot evaluates the guard synchronously at start (v: 1), then
    // next() evaluates it for real with the current data (v: 2).
    checkCtx(first("canMoveNext"), "p", "a", { v: 1 });
    expect(seen.canMoveNext.some((c) => c.data.v === 2)).toBe(true);
    checkCtx(first("fieldErrors"), "p", "a", { v: 1 });
    checkCtx(first("fieldWarnings"), "p", "a", { v: 1 });
    checkCtx(first("shouldSkip"), "p", "skipper", { v: 2 });
    expect(first("shouldSkip").isFirstEntry).toBe(true);
    checkCtx(first("select"), "p", "choice", { v: 2 });
    expect(first("select").isFirstEntry).toBe(true);
    // The choice was resolved again on the way back and forward.
    expect(seen.select.some((c) => c.isFirstEntry === false)).toBe(true);
    // Inside a StepChoice the synchronous snapshot evaluators pass the choice's
    // own id while the real guard (run by previous()) passes the inner step's.
    // Pinned as-is; see the review doc (found on the way).
    checkCtx(first("canMovePrevious"), "p", "choice", { v: 2 });
    expect(seen.canMovePrevious.some((c) => c.stepId === "x")).toBe(true);
    checkCtx(first("onSubPathCancel"), "p", "host", { v: 2 });
    expect(first("onSubPathCancel").isFirstEntry).toBe(false);
    checkCtx(first("onSubPathComplete"), "p", "host", { v: 2 });
    expect(first("onSubPathComplete").isFirstEntry).toBe(false);

    for (const ctxs of Object.values(seen)) {
      for (const ctx of ctxs) expect(ctx.data).not.toHaveProperty("leak");
    }
  });
});
