// Type-level tests — run with `npm run test:types`.
import { expectTypeOf, test } from "vitest";
import { PathEngine, type PathDefinition, type PathSnapshot } from "@daltonr/pathwrite-core";
import { PathFacade, usePathContext } from "../src/index";
import { PathShellComponent } from "../src/shell";

// A type alias: an interface would need an explicit string index to satisfy
// PathData, and that index makes every key legal (see the README note).
type Form = { name: string; age: number };

const form: PathDefinition<Form> = {
  id: "form",
  steps: [{ id: "one", fieldErrors: ({ data }) => ({ name: data.name ? undefined : "Required." }) }],
};

test("PathFacade<TData> types the data end to end", () => {
  const facade = new PathFacade<Form>();
  void facade.start(form, { name: "a" });
  expectTypeOf(facade.snapshot()).toEqualTypeOf<PathSnapshot<Form> | null>();
  expectTypeOf(facade.stateSignal()).toEqualTypeOf<PathSnapshot<Form> | null>();
  expectTypeOf(facade.engine).toEqualTypeOf<PathEngine<Form>>();
  facade.state$.subscribe((s) => expectTypeOf(s).toEqualTypeOf<PathSnapshot<Form> | null>());
  facade.events$.subscribe((event) => {
    if (event.type === "stateChanged") expectTypeOf(event.snapshot).toEqualTypeOf<PathSnapshot<Form>>();
  });
  expectTypeOf(facade.setData).parameter(0).toEqualTypeOf<"name" | "age">();
  // @ts-expect-error — wrong value type for the key
  void facade.setData("age", "forty");
  // @ts-expect-error — not a key of Form
  void facade.setData("nope", 1);
  // @ts-expect-error — a definition over other data
  void facade.start({
    id: "other",
    steps: [{ id: "x", onEnter: ({ data }) => void data.zip.trim() }],
  } as PathDefinition<{ zip: string }>);
  // Sub-paths carry their own data, so any definition is accepted.
  void facade.startSubPath({ id: "sub", steps: [{ id: "s" }] } as PathDefinition<{ zip: string }>);
});

test("the default type parameter keeps the loose surface", () => {
  const facade = new PathFacade();
  void facade.start(form);
  void facade.setData("anything", 1);
  expectTypeOf(facade.snapshot()).toEqualTypeOf<PathSnapshot | null>();
});

test("usePathContext<TData> forwards the typed surface", () => {
  const ctx = usePathContext<Form>();
  expectTypeOf(ctx.snapshot()).toEqualTypeOf<PathSnapshot<Form> | null>();
  // @ts-expect-error — wrong value type for the key
  void ctx.setData("age", "forty");
});

/**
 * Strict type identity. `expectTypeOf().toEqualTypeOf()` cannot compare
 * `PathDefinition` (recursive, method-syntax members), and it treats
 * `PathDefinition<any>` as equal to `PathDefinition` — this does not.
 */
type IsExactly<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

test("the shell's path input is the plain PathDefinition, and accepts a typed one", () => {
  const shell = {} as PathShellComponent;
  shell.path = form;
  expectTypeOf<IsExactly<PathShellComponent["path"], PathDefinition | undefined>>().toEqualTypeOf<true>();
});
