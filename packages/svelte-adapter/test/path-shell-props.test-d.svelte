<script lang="ts">
  // Type-level test for PathShell's public props. Checked by
  // `npm run check` (svelte-check via tsconfig.check.json), which is the only
  // gate that resolves a `.svelte` import to the component's real prop types:
  // plain `tsc` (test:types) sees Svelte's ambient `*.svelte` shim instead,
  // where every prop is `any` and none of these assertions could fail.
  import { expectTypeOf } from "vitest";
  import type { Component, ComponentProps } from "svelte";
  import type { PathEvent } from "@daltonr/pathwrite-core";
  import PathShell from "../src/PathShell.svelte";

  type Props = ComponentProps<typeof PathShell>;

  // A misspelled prop is rejected — there is no index signature to swallow it.
  // @ts-expect-error `nextLable` is not a PathShell prop
  const typo: Props = { nextLable: "Continue" };

  // `onevent` receives the core `PathEvent`, not `any`.
  expectTypeOf<Parameters<NonNullable<Props["onevent"]>>[0]>().toEqualTypeOf<PathEvent>();

  // Step components are passed as one record keyed by step id.
  expectTypeOf<NonNullable<Props["steps"]>>().toEqualTypeOf<Record<string, Component>>();

  void typo;
</script>
