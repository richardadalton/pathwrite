// Type-level tests — run with `npm run test:types`.
// usePath<TData> is typed over the generic PathEngine<TData> end to end.
import { createElement } from "react";
import { describe, expectTypeOf, it } from "vitest";
import { PathEngine, type PathDefinition, type PathSnapshot } from "@daltonr/pathwrite-core";
import { PathProvider, PathShell, usePath, usePathContext } from "../src/index";

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

describe("usePath<TData> is typed over PathEngine<TData>", () => {
  it("types the snapshot, start and setData from the data type", () => {
    const path = usePath<Form>();
    expectTypeOf(path.snapshot).toEqualTypeOf<PathSnapshot<Form> | null>();
    expectTypeOf(path.snapshot!.data.name).toEqualTypeOf<string>();
    void path.start(form, { age: 1 });
    // @ts-expect-error — a definition over other data
    void path.start(zipDefinition);
    // @ts-expect-error — initialData with a key Form does not have
    void path.start(form, { zip: "1" });
    // @ts-expect-error — wrong value type for the key
    void path.setData("age", "forty");
    // @ts-expect-error — not a key of Form
    void path.setData("nope", 1);
    // Sub-paths have their own data: any definition is accepted.
    void path.startSubPath(zipDefinition, { zip: "1" });
  });

  it("accepts an engine typed over the same data and rejects one typed over other data", () => {
    const path = usePath<Form>({
      engine: new PathEngine<Form>(),
      onEvent: (event) => {
        if (event.type === "stateChanged") expectTypeOf(event.snapshot).toEqualTypeOf<PathSnapshot<Form>>();
      },
    });
    expectTypeOf(path.snapshot).toEqualTypeOf<PathSnapshot<Form> | null>();
    // @ts-expect-error — an engine over other data
    usePath<Form>({ engine: new PathEngine<{ zip: string }>() });
  });

  it("types usePathContext<TData>().snapshot.data", () => {
    const { snapshot, setData } = usePathContext<Form>();
    expectTypeOf(snapshot.data.name).toEqualTypeOf<string>();
    // @ts-expect-error — wrong value type for the key
    void setData("age", "forty");
  });

  it("the default type parameter keeps the loose surface", () => {
    const path = usePath();
    void path.setData("anything", 1);
    void path.start(form);
    void path.start(zipDefinition);
    expectTypeOf(path.snapshot).toEqualTypeOf<PathSnapshot | null>();
  });
});

describe("the shell and provider accept a typed definition", () => {
  it("PathShell's path prop takes a PathDefinition<Form> (method hooks are bivariant)", () => {
    createElement(PathShell, { path: form, steps: {}, initialData: { name: "a" } });
    createElement(PathShell, { path: zipDefinition, steps: {}, engine: new PathEngine<{ zip: string }>() });
  });

  it("PathProvider's path prop takes a PathDefinition<Form>", () => {
    createElement(PathProvider, { path: form, initialData: { name: "a" } });
    createElement(PathProvider, { engine: new PathEngine<Form>() });
  });
});
