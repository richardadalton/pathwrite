// Type-level tests — run with `npm run test:types`.
import { describe, expectTypeOf, it } from "vitest";
import type { GuardResult, PathStep } from "@daltonr/pathwrite-core";

describe("GuardResult accepts every documented form", () => {
  it("a guard may return a plain boolean", () => {
    const sync: PathStep["canMoveNext"] = ({ data }) => data.ok === true;
    const literalFalse: PathStep["canMoveNext"] = () => false;
    const async: PathStep["canMoveNext"] = async () => false;
    expectTypeOf(sync).toMatchTypeOf<PathStep["canMoveNext"]>();
    expectTypeOf(literalFalse).toMatchTypeOf<PathStep["canMoveNext"]>();
    expectTypeOf(async).toMatchTypeOf<PathStep["canMoveNext"]>();
  });

  it("the object form may allow as well as block, and reason may be null", () => {
    expectTypeOf<{ allowed: true }>().toMatchTypeOf<GuardResult>();
    expectTypeOf<{ allowed: false; reason: null }>().toMatchTypeOf<GuardResult>();
    expectTypeOf<{ allowed: false; reason: string }>().toMatchTypeOf<GuardResult>();
  });
});
