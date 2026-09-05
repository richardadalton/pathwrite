import { expectTypeOf, test } from "vitest";
import { errorPhaseMessage, type ErrorPhase } from "../src/index";

test("errorPhaseMessage takes an ErrorPhase, not any string", () => {
  expectTypeOf(errorPhaseMessage).parameter(0).toEqualTypeOf<ErrorPhase>();
  expectTypeOf(errorPhaseMessage("entering")).toEqualTypeOf<string>();
  // @ts-expect-error — a phase the engine can never report
  errorPhaseMessage("loading");
  // @ts-expect-error — the two statuses that are not error phases
  errorPhaseMessage("idle" as "idle" | "error");
});
