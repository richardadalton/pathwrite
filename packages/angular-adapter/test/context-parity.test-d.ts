// Type-level tests — run with `npm run test:types`.
import { describe, expectTypeOf, it } from "vitest";
import type { Signal } from "@angular/core";
import type { FacadeContextMethod, PathFacade, UsePathContextReturn } from "../src/index";
/** Names of the facade's public methods: callable members that are not signals (signals are callable too). */
type FacadeMethodNames = {
  [K in keyof PathFacade]: PathFacade[K] extends Signal<unknown>
    ? never
    : PathFacade[K] extends (...args: never[]) => unknown
      ? K
      : never;
}[keyof PathFacade];
describe("usePathContext() exposes every PathFacade method", () => {
  it("every facade method except engine plumbing, the lifecycle hook and snapshot() (exposed as a signal) is forwarded", () => {
    expectTypeOf<
      Exclude<FacadeMethodNames, "adoptEngine" | "ngOnDestroy" | "snapshot">
    >().toEqualTypeOf<FacadeContextMethod>();
  });
  it("the context return carries those methods plus snapshot and services", () => {
    expectTypeOf<keyof UsePathContextReturn>().toEqualTypeOf<FacadeContextMethod | "snapshot" | "services">();
    expectTypeOf<UsePathContextReturn["validate"]>().toBeFunction();
  });
});
