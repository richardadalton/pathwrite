<script lang="ts">
  import { usePathContext } from "@daltonr/pathwrite-svelte";
  import { AVAILABLE_APPROVERS } from "./approval";
  import type { DocumentData, ApproverResult } from "./types";

  const ctx = usePathContext<DocumentData>();
  let data    = $derived(ctx.snapshot?.data);
  let results = $derived((data?.approvalResults ?? {}) as Record<string, ApproverResult>);

  let selectedApprovers = $derived(
    AVAILABLE_APPROVERS.filter(a => ((data?.approvers ?? []) as string[]).includes(a.id))
  );

  let status = $derived(() => {
    if (selectedApprovers.every(a => results[a.id]?.decision === "approved")) return "approved";
    if (selectedApprovers.some(a  => results[a.id]?.decision === "rejected"))  return "rejected";
    return "mixed";
  });
</script>

{#if ctx.snapshot}
  <div class="form-body">
    <div class="outcome-banner outcome-banner--{status()}">
      <span class="outcome-icon">{status() === 'approved' ? '✓' : status() === 'rejected' ? '✗' : '⚠'}</span>
      <span>
        {#if status() === 'approved'}All approvers approved the document.
        {:else if status() === 'rejected'}One or more approvers rejected the document.
        {:else}Mixed results — review comments below.{/if}
      </span>
    </div>

    <div class="review-section">
      <p class="section-title">Document</p>
      <div class="review-card">
        <div class="review-row"><span class="review-key">Title</span><span>{data?.title}</span></div>
        <div class="review-row"><span class="review-key">Description</span><span>{data?.description}</span></div>
      </div>
    </div>

    <div class="review-section">
      <p class="section-title">Approver Decisions</p>
      <div class="review-card">
        {#each selectedApprovers as approver}
          <div class="approver-result-row">
            <span class="approver-avatar">{approver.name.charAt(0)}</span>
            <span class="approver-result-name">{approver.name}</span>
            <span class="decision-badge"
              class:decision-badge--approved={results[approver.id]?.decision === 'approved'}
              class:decision-badge--rejected={results[approver.id]?.decision === 'rejected'}>
              {results[approver.id]?.decision === 'approved' ? '✓ Approved' : '✗ Rejected'}
            </span>
            {#if results[approver.id]?.comment}
              <span class="approver-comment">"{results[approver.id].comment}"</span>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

