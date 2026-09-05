// Type-level tests — run with `npm run test:types`.
import { describe, expectTypeOf, it } from "vitest";
import type { PathContext, UsePathReturn } from "../src/index.svelte";
describe("PathContext (usePathContext) exposes everything usePath() does", () => {
  it("same members plus services", () => {
    expectTypeOf<keyof PathContext>().toEqualTypeOf<keyof UsePathReturn | "services">();
  });
  it("in particular start, startSubPath and validate", () => {
    expectTypeOf<PathContext["startSubPath"]>().toBeFunction();
    expectTypeOf<PathContext["validate"]>().toBeFunction();
    expectTypeOf<PathContext["start"]>().toBeFunction();
  });
});
