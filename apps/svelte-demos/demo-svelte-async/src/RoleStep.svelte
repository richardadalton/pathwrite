<script lang="ts">
  import { onMount } from "svelte";
  import { usePathContext } from "@daltonr/pathwrite-svelte";
  import type { ApplicationData } from "@daltonr/pathwrite-demo-workflow-job-application";
  import type { ApplicationServices, Role } from "@daltonr/pathwrite-demo-workflow-job-application";

  // IMPORTANT: Don't destructure ctx — snapshot is a reactive getter.
  const ctx = usePathContext<ApplicationData, ApplicationServices>();
  let errors = $derived(ctx.snapshot?.hasAttemptedNext ? ctx.snapshot.fieldErrors : {});

  let roles: Role[]   = $state([]);
  let loading: boolean = $state(true);

  onMount(() => {
    ctx.services.getRoles().then(r => {
      roles   = r;
      loading = false;
    });
  });
</script>

{#if ctx.snapshot}
  <div class="form-body">
    <p class="step-intro">
      Roles are loaded directly from the service inside the step component — not via
      <code>onEnter</code>.
    </p>

    <div class="field" class:field--error={errors.roleId}>
      <label for="roleId">Open Position</label>

      {#if loading}
        <div class="skeleton-select">Loading roles…</div>
      {:else}
        <select
          id="roleId"
          value={ctx.snapshot.data.roleId}
          onchange={(e) => ctx.setData("roleId", e.currentTarget.value)}
        >
          <option value="">— select a role —</option>
          {#each roles as r}
            <option value={r.id}>{r.label}</option>
          {/each}
        </select>
      {/if}

      {#if errors.roleId}<span class="field-error">{errors.roleId}</span>{/if}
    </div>

    <p class="hint">
      <strong>What's happening:</strong>
      <code>usePathContext&lt;ApplicationData, ApplicationServices&gt;()</code> returns
      <code>services</code> alongside <code>snapshot</code>. The component calls
      <code>services.getRoles()</code> in <code>onMount</code> and manages its own loading state.
    </p>
  </div>
{/if}
