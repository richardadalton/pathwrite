// Type-level tests — run with `npm run test:types`.
import { describe, expectTypeOf, it } from "vitest";
import type { PathContext, UsePathReturn } from "../src/index.svelte";
describe("PathContext (usePathContext) exposes everything usePath() does", () => {
  it("same members plus services", () => {
    // `destroy` is the owner's handle on the subscription and is intentionally
    // not forwarded to step components; everything else must stay in step.
    expectTypeOf<keyof PathContext>().toEqualTypeOf<Exclude<keyof UsePathReturn, "destroy"> | "services">();
  });
  it("in particular start, startSubPath and validate", () => {
    expectTypeOf<PathContext["startSubPath"]>().toBeFunction();
    expectTypeOf<PathContext["validate"]>().toBeFunction();
    expectTypeOf<PathContext["start"]>().toBeFunction();
  });
});
