<script lang="ts">
  import { getPathContext } from "@daltonr/pathwrite-svelte";
  import { approvalSubPath, AVAILABLE_APPROVERS } from "./approval";
  import type { DocumentData, ApprovalData, ApproverResult } from "./types";

  const ctx = getPathContext<DocumentData>();
  let errors  = $derived(ctx.snapshot?.hasAttemptedNext ? ctx.snapshot.fieldErrors : {});
  let data    = $derived(ctx.snapshot?.data);
  let results = $derived((data?.approvalResults ?? {}) as Record<string, ApproverResult>);

  let selectedApprovers = $derived(
    AVAILABLE_APPROVERS.filter(a => ((data?.approvers ?? []) as string[]).includes(a.id))
  );

  let allDone = $derived(
    selectedApprovers.length > 0 &&
    selectedApprovers.every(a => !!results[a.id]?.decision)
  );

  function launchReview(approverId: string, approverName: string) {
    const initialData: ApprovalData = {
      approverId,
      approverName,
      documentTitle:       data?.title       ?? "",
      documentDescription: data?.description ?? "",
      decision: "",
      comment:  "",
    };
    ctx.startSubPath(approvalSubPath, initialData, { approverId });
  }
</script>

{#if ctx.snapshot}
  <div class="form-body">
    <div class="doc-summary-card">
      <p class="doc-summary-label">Document</p>
      <p class="doc-summary-title">{data?.title}</p>
      <p class="doc-summary-desc">{data?.description}</p>
    </div>

    <div>
      <p class="pref-label">Approvers</p>
      <div class="approver-review-list">
        {#each selectedApprovers as approver}
          <div class="approver-review-item">
            <span class="approver-avatar">{approver.name.charAt(0)}</span>
            <span class="approver-review-name">{approver.name}</span>
            {#if results[approver.id]}
              <span class="decision-badge" class:decision-badge--approved={results[approver.id].decision === 'approved'} class:decision-badge--rejected={results[approver.id].decision === 'rejected'}>
                {results[approver.id].decision === 'approved' ? '✓ Approved' : '✗ Rejected'}
              </span>
            {:else}
              <button type="button" class="btn-review"
                disabled={ctx.snapshot.isNavigating}
                onclick={() => launchReview(approver.id, approver.name)}>
                Review →
              </button>
            {/if}
          </div>
        {/each}
      </div>
    </div>

    {#if ctx.snapshot.hasAttemptedNext && errors._}
      <p class="gate-message">⏳ {errors._}</p>
    {/if}
    {#if allDone}
      <p class="gate-message gate-message--done">✓ All approvers have responded. Click Next to continue.</p>
    {/if}
  </div>
{/if}

