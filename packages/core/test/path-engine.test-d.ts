import { expectTypeOf, test } from "vitest";
import { PathEngine, type PathDefinition, type PathSnapshot, type SerializedPathState } from "../src/index";

// A type alias: an interface would need an explicit string index to satisfy
// PathData, and that index makes every key legal (see the README note).
type Form = { name: string; age: number };

const form: PathDefinition<Form> = {
  id: "form",
  steps: [{ id: "one", fieldErrors: ({ data }) => ({ name: data.name ? undefined : "Required." }) }],
};

test("PathEngine<TData> types the data end to end", () => {
  const engine = new PathEngine<Form>();
  void engine.start(form, { name: "a" });
  expectTypeOf(engine.snapshot()).toEqualTypeOf<PathSnapshot<Form> | null>();
  expectTypeOf(engine.snapshot()!.data.name).toEqualTypeOf<string>();
  expectTypeOf(engine.setData).parameter(0).toEqualTypeOf<"name" | "age">();
  // @ts-expect-error — wrong value type for the key
  void engine.setData("age", "forty");
  // @ts-expect-error — not a key of Form
  void engine.setData("nope", 1);
  // @ts-expect-error — a definition over other data
  void engine.start({
    id: "other",
    steps: [{ id: "x", onEnter: ({ data }) => void data.zip.trim() }],
  } as PathDefinition<{ zip: string }>);
  new PathEngine<Form>({ observers: [(_event, e) => expectTypeOf(e).toEqualTypeOf<PathEngine<Form>>()] });
});

test("fromState carries the definition's data type", () => {
  const restored = PathEngine.fromState<Form>({} as SerializedPathState, { form });
  expectTypeOf(restored).toEqualTypeOf<PathEngine<Form>>();
});

test("the default type parameter keeps the loose surface", () => {
  const engine = new PathEngine();
  void engine.setData("anything", 1);
  expectTypeOf(engine.snapshot()).toEqualTypeOf<PathSnapshot | null>();
});
