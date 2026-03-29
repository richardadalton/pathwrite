<script lang="ts">
  import { usePathContext } from "@daltonr/pathwrite-svelte";
  import { AVAILABLE_APPROVERS } from "./approval";
  import type { DocumentData } from "./types";

  const ctx = usePathContext<DocumentData>();
  let errors   = $derived(ctx.snapshot?.hasAttemptedNext ? ctx.snapshot.fieldErrors : {});
  let selected = $derived((ctx.snapshot?.data.approvers ?? []) as string[]);

  function toggle(id: string) {
    const updated = selected.includes(id)
      ? selected.filter(a => a !== id)
      : [...selected, id];
    ctx.setData("approvers", updated);
  }
</script>

{#if ctx.snapshot}
  <div class="form-body">
    <p class="step-intro">Choose who needs to approve this document. All selected approvers must review before the workflow can proceed.</p>

    <div>
      <p class="pref-label">Available Approvers</p>
      <div class="approver-select-list">
        {#each AVAILABLE_APPROVERS as approver}
          <label class="approver-select-item" class:approver-select-item--selected={selected.includes(approver.id)}>
            <input type="checkbox" checked={selected.includes(approver.id)} onchange={() => toggle(approver.id)} />
            <span class="approver-avatar">{approver.name.charAt(0)}</span>
            <span class="approver-name">{approver.name}</span>
          </label>
        {/each}
      </div>
      {#if errors.approvers}<span class="field-error">{errors.approvers}</span>{/if}
    </div>

    {#if selected.length > 0}
      <p class="selection-count">{selected.length} approver{selected.length !== 1 ? 's' : ''} selected</p>
    {/if}
  </div>
{/if}

