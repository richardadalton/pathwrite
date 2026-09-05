import { expectTypeOf, test } from "vitest";
import { PathEngine, type PathDefinition, type PathObserver } from "@daltonr/pathwrite-core";
import { LocalStorageStore, persistence, restoreOrStart } from "../src/index";

type Form = { name: string; age: number };
type Other = { zip: string };

const form: PathDefinition<Form> = { id: "form", steps: [{ id: "one" }] };
const other: PathDefinition<Other> = { id: "other", steps: [{ id: "x" }] };
const store = new LocalStorageStore();

test("restoreOrStart carries the path's data type onto the engine", async () => {
  const { engine } = await restoreOrStart({ store, key: "k", path: form, initialData: { name: "a" } });
  expectTypeOf(engine).toEqualTypeOf<PathEngine<Form>>();
  // @ts-expect-error — a key Form does not have
  void restoreOrStart({ store, key: "k", path: form, initialData: { zip: "x" } });
  // Sub-path definitions may be over any data.
  void restoreOrStart({ store, key: "k", path: form, pathDefinitions: { other } });
  // A typed observer over the same data is accepted, one over other data is not.
  const typed: PathObserver<Form> = () => {};
  const foreign: PathObserver<Other> = (_e, e) => void e.setData("zip", "x");
  void restoreOrStart({ store, key: "k", path: form, observers: [typed] });
  // @ts-expect-error — observer over other data
  void restoreOrStart({ store, key: "k", path: form, observers: [foreign] });
});

test("persistence() works on a typed engine", () => {
  const observer = persistence({ store, key: "k" });
  new PathEngine<Form>({ observers: [observer] });
  void restoreOrStart({ store, key: "k", path: form, observers: [observer] });
});
