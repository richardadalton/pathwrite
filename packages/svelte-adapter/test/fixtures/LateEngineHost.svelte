<script lang="ts">
  import PathShell from "../../src/PathShell.svelte";
  import StepA from "./StepA.svelte";
  import StepB from "./StepB.svelte";
  import type { PathEngine } from "@daltonr/pathwrite-core";
  let engine = $state<PathEngine | undefined>(undefined);
  export function setEngine(e: PathEngine): void { engine = e; }
  const path = { id: "late", steps: [{ id: "step-a" }, { id: "step-b" }] };
</script>

<PathShell {path} autoStart={false} {engine} stepA={StepA} stepB={StepB} />
