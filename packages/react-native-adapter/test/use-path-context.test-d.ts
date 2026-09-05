// Type-level tests — run with `vitest --typecheck` (see `npm run test:types`).
import { describe, expectTypeOf, it } from "vitest";
import type { PathSnapshot } from "@daltonr/pathwrite-core";
import { usePathContext } from "../src/index";

interface SignupData { name: string; email: string; [key: string]: unknown }

describe("usePathContext() types (review finding A4)", () => {
  it("declares snapshot as nullable: under a bare <PathProvider> it is null until start()", () => {
    type Ctx = ReturnType<typeof usePathContext<SignupData>>;
    expectTypeOf<Ctx["snapshot"]>().toEqualTypeOf<PathSnapshot<SignupData> | null>();
  });
});
