// Type-level tests — run with `npm run test:types`.
import { describe, expectTypeOf, it } from "vitest";
import type { PathData } from "@daltonr/pathwrite-core";
import type { UsePathReturn } from "../src/index";
import { usePathContext } from "../src/index";
describe("usePathContext() exposes everything usePath() does", () => {
  it("same members plus services", () => {
    expectTypeOf<keyof ReturnType<typeof usePathContext<PathData, unknown>>>().toEqualTypeOf<keyof UsePathReturn | "services">();
  });
});
