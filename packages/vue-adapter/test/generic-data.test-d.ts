// Type-level tests — run with `npm run test:types`.
import { expectTypeOf, test } from "vitest";
import type { DeepReadonly, Ref } from "vue";
import { PathEngine, type PathDefinition, type PathSnapshot } from "@daltonr/pathwrite-core";
import { usePath, usePathContext } from "../src/index";

// A type alias: an interface would need an explicit string index to satisfy
// PathData, and that index makes every key legal (see the README note).
type Form = { name: string; age: number };

const form: PathDefinition<Form> = {
  id: "form",
  steps: [{ id: "one", fieldErrors: ({ data }) => ({ name: data.name ? undefined : "Required." }) }],
};

const zipDefinition: PathDefinition<{ zip: string }> = {
  id: "zip",
  steps: [{ id: "x", onEnter: ({ data }) => void data.zip.trim() }],
};

test("usePath<TData> types the snapshot, start and setData", () => {
  const path = usePath<Form>();
  void path.start(form, { name: "a" });
  expectTypeOf(path.snapshot).toEqualTypeOf<DeepReadonly<Ref<PathSnapshot<Form> | null>>>();
  expectTypeOf(path.snapshot.value!.data.name).toEqualTypeOf<string>();
  // @ts-expect-error — a definition over other data
  void path.start(zipDefinition);
  // @ts-expect-error — wrong value type for the key
  void path.setData("age", "forty");
  // @ts-expect-error — not a key of Form
  void path.setData("nope", 1);
  // Sub-paths have their own data: any definition is accepted.
  void path.startSubPath(zipDefinition);
});

test("the engine option is typed over the same data", () => {
  usePath<Form>({ engine: new PathEngine<Form>() });
  usePath<Form>({
    engine: new PathEngine<Form>(),
    onEvent: (event) => {
      if (event.type === "stateChanged") expectTypeOf(event.snapshot).toEqualTypeOf<PathSnapshot<Form>>();
    },
  });
  // @ts-expect-error — an engine over other data
  usePath<Form>({ engine: new PathEngine<{ zip: string }>() });
  // The untyped surface (the default data, PathShell's engine prop) still
  // accepts a typed engine.
  usePath({ engine: new PathEngine<Form>() });
});

test("usePathContext<TData> narrows the context snapshot", () => {
  const ctx = usePathContext<Form>();
  expectTypeOf(ctx.snapshot.value.data.name).toEqualTypeOf<string>();
});

test("the default type parameter keeps the loose surface", () => {
  const path = usePath();
  void path.setData("anything", 1);
  expectTypeOf(path.snapshot).toEqualTypeOf<DeepReadonly<Ref<PathSnapshot | null>>>();
});
