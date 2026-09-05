// Type-level tests — run with `npm run test:types`.
import { describe, expectTypeOf, it } from "vitest";
import type { PathShellActions, UsePathReturn } from "../src/index";

describe("usePath() action callbacks are awaitable", () => {
  it("navigation and data callbacks return Promise<void>, matching the engine and the other adapters", () => {
    expectTypeOf<ReturnType<UsePathReturn["start"]>>().toEqualTypeOf<Promise<void>>();
    expectTypeOf<ReturnType<UsePathReturn["startSubPath"]>>().toEqualTypeOf<Promise<void>>();
    expectTypeOf<ReturnType<UsePathReturn["next"]>>().toEqualTypeOf<Promise<void>>();
    expectTypeOf<ReturnType<UsePathReturn["previous"]>>().toEqualTypeOf<Promise<void>>();
    expectTypeOf<ReturnType<UsePathReturn["cancel"]>>().toEqualTypeOf<Promise<void>>();
    expectTypeOf<ReturnType<UsePathReturn["goToStep"]>>().toEqualTypeOf<Promise<void>>();
    expectTypeOf<ReturnType<UsePathReturn["goToStepChecked"]>>().toEqualTypeOf<Promise<void>>();
    expectTypeOf<ReturnType<UsePathReturn["setData"]>>().toEqualTypeOf<Promise<void>>();
    expectTypeOf<ReturnType<UsePathReturn["resetStep"]>>().toEqualTypeOf<Promise<void>>();
    expectTypeOf<ReturnType<UsePathReturn["restart"]>>().toEqualTypeOf<Promise<void>>();
    expectTypeOf<ReturnType<UsePathReturn["retry"]>>().toEqualTypeOf<Promise<void>>();
    expectTypeOf<ReturnType<UsePathReturn["suspend"]>>().toEqualTypeOf<Promise<void>>();
    expectTypeOf<ReturnType<UsePathReturn["validate"]>>().toEqualTypeOf<void>();
  });

  it("PathShellActions (custom footers) are awaitable too", () => {
    expectTypeOf<ReturnType<PathShellActions["next"]>>().toEqualTypeOf<Promise<void>>();
    expectTypeOf<ReturnType<PathShellActions["restart"]>>().toEqualTypeOf<Promise<void>>();
  });
});
