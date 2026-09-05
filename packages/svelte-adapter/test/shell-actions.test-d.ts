// Type-level tests — run with `npm run test:types`.
import { describe, expectTypeOf, it } from "vitest";
import type { PathShellActions } from "../src/index.svelte";

describe("PathShellActions is exported and typed like the other adapters'", () => {
  it("has the footer action set", () => {
    expectTypeOf<keyof PathShellActions>().toEqualTypeOf<
      "next" | "previous" | "cancel" | "goToStep" | "goToStepChecked" | "setData" | "restart" | "retry" | "suspend"
    >();
    expectTypeOf<ReturnType<PathShellActions["next"]>>().toEqualTypeOf<Promise<void>>();
  });
});
