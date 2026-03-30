<script lang="ts">
  import { usePathContext } from "@daltonr/pathwrite-svelte";
  import type { EmployeeDetails } from "../employee-details";

  /**
   * Tab bar rendered at the top of each inner step component.
   * Calls `usePathContext()` to get the INNER path's context,
   * then uses `goToStep` to switch between tabs freely.
   */
  const ctx = usePathContext<EmployeeDetails>();
</script>

<div class="tab-bar">
  {#each ctx.snapshot.steps as step (step.id)}
    <button
      type="button"
      class="tab-btn"
      class:tab-btn--active={step.status === "current"}
      class:tab-btn--completed={step.status === "completed"}
      onclick={() => ctx.goToStep(step.id)}
    >
      {step.title}
      {#if step.status === "completed"}<span class="tab-check"> ✓</span>{/if}
    </button>
  {/each}
</div>
