<script lang="ts">
  import PathShell from "../../src/PathShell.svelte";
  import StepA from "./StepA.svelte";
  import StepB from "./StepB.svelte";
  import { innerPath } from "./nested-fixture";
</script>

<PathShell
  path={innerPath}
  restoreKey="inner"
  validationDisplay="summary"
  nextLabel="InnerNext"
  completeLabel="InnerComplete"
  steps={{ innerA: StepA, innerB: StepB }}
/>
