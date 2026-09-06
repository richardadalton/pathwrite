<script lang="ts">
  // Type-level test for PathShell's public props. Checked by
  // `npm run check` (svelte-check via tsconfig.check.json), which is the only
  // gate that resolves a `.svelte` import to the component's real prop types:
  // plain `tsc` (test:types) sees Svelte's ambient `*.svelte` shim instead,
  // where every prop is `any` and none of these assertions could fail.
  import { expectTypeOf } from "vitest";
  import type { Component, ComponentProps } from "svelte";
  import type { PathDefinition, PathEvent } from "@daltonr/pathwrite-core";
  import PathShell from "../src/PathShell.svelte";

  type Props = ComponentProps<typeof PathShell>;

  // A misspelled prop is rejected — there is no index signature to swallow it.
  // @ts-expect-error `nextLable` is not a PathShell prop
  const typo: Props = { nextLable: "Continue" };

  // `onevent` receives the core `PathEvent`, not `any`.
  expectTypeOf<Parameters<NonNullable<Props["onevent"]>>[0]>().toEqualTypeOf<PathEvent>();

  // Step components are passed as one record keyed by step id.
  expectTypeOf<NonNullable<Props["steps"]>>().toEqualTypeOf<Record<string, Component>>();

  // `path` accepts a definition over typed data: the shell renders any path,
  // so its prop is the plain `PathDefinition`, to which a `PathDefinition<Form>`
  // is assignable.
  type Form = { name: string; age: number };
  const typed: PathDefinition<Form> = { id: "form", steps: [{ id: "one" }] };
  const path: Props["path"] = typed;
  expectTypeOf<Props["path"]>().toEqualTypeOf<PathDefinition | undefined>();

  void typo;
  void path;
</script>
