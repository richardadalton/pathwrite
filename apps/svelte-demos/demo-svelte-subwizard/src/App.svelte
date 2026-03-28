<script lang="ts">
  import { PathShell } from "@daltonr/pathwrite-svelte";
  import type { PathData } from "@daltonr/pathwrite-svelte";
  import { approvalWorkflowPath, INITIAL_DATA, AVAILABLE_APPROVERS } from "./approval";
  import type { DocumentData, ApproverResult } from "./types";
  import CreateDocumentStep  from "./CreateDocumentStep.svelte";
  import SelectApproversStep from "./SelectApproversStep.svelte";
  import ApprovalReviewStep  from "./ApprovalReviewStep.svelte";
  import SummaryStep         from "./SummaryStep.svelte";
  import ViewDocumentStep    from "./ViewDocumentStep.svelte";
  import DecisionStep        from "./DecisionStep.svelte";

  let isCompleted   = $state(false);
  let isCancelled   = $state(false);
  let completedData = $state<DocumentData | null>(null);

  function handleComplete(data: PathData) { completedData = data as DocumentData; isCompleted = true; }
  function handleCancel()  { isCancelled = true; }
  function startOver()     { isCompleted = false; isCancelled = false; completedData = null; }

  function getResults(d: DocumentData) { return (d.approvalResults ?? {}) as Record<string, ApproverResult>; }
  function getApprovers(d: DocumentData) { return AVAILABLE_APPROVERS.filter(a => (d.approvers as string[]).includes(a.id)); }
  function getStatus(d: DocumentData) {
    const ids = d.approvers as string[];
    if (ids.every(id => getResults(d)[id]?.decision === "approved")) return "approved";
    if (ids.some(id  => getResults(d)[id]?.decision === "rejected"))  return "rejected";
    return "mixed";
  }
</script>

<main class="page">
  <div class="page-header">
    <h1>Approval Workflow</h1>
    <p class="subtitle">Subwizard demo — dynamically launch a per-approver review subwizard gated by all approvers completing.</p>
  </div>

  {#if isCompleted && completedData}
    {@const st = getStatus(completedData)}
    <section class="result-panel" class:success-panel={st === 'approved'} class:reject-panel={st !== 'approved' && st !== 'mixed'} class:cancel-panel={st === 'mixed'}>
      <div class="result-icon">{st === 'approved' ? '✅' : '❌'}</div>
      <h2>{st === 'approved' ? 'Document Approved!' : 'Document Rejected'}</h2>
      <p>{st === 'approved' ? `All approvers signed off on "${completedData.title}".` : `One or more approvers rejected "${completedData.title}".`}</p>
      <div class="summary">
        <div class="summary-section">
          <p class="summary-section__title">Document</p>
          <div class="summary-row"><span class="summary-key">Title</span><span>{completedData.title}</span></div>
          <div class="summary-row"><span class="summary-key">Description</span><span>{completedData.description}</span></div>
        </div>
        <div class="summary-section">
          <p class="summary-section__title">Decisions</p>
          {#each getApprovers(completedData) as a}
            <div class="summary-row">
              <span class="summary-key">{a.name}</span>
              <span class:text-approved={getResults(completedData)[a.id]?.decision === 'approved'} class:text-rejected={getResults(completedData)[a.id]?.decision === 'rejected'}>
                {getResults(completedData)[a.id]?.decision === 'approved' ? '✓ Approved' : '✗ Rejected'}
                {#if getResults(completedData)[a.id]?.comment} — <em>{getResults(completedData)[a.id].comment}</em>{/if}
              </span>
            </div>
          {/each}
        </div>
      </div>
      <button class="btn-primary" onclick={startOver}>Start Over</button>
    </section>
  {/if}

  {#if isCancelled}
    <section class="result-panel cancel-panel">
      <div class="result-icon">✖</div>
      <h2>Workflow Cancelled</h2>
      <p>No approvals were recorded.</p>
      <button class="btn-secondary" onclick={startOver}>Try Again</button>
    </section>
  {/if}

  {#if !isCompleted && !isCancelled}
    <PathShell
      path={approvalWorkflowPath}
      initialData={INITIAL_DATA}
      completeLabel="Finalise"
      cancelLabel="Cancel"
      validationDisplay="inline"
      oncomplete={handleComplete}
      oncancel={handleCancel}
      createDocument={CreateDocumentStep}
      selectApprovers={SelectApproversStep}
      approvalReview={ApprovalReviewStep}
      summary={SummaryStep}
      viewDocument={ViewDocumentStep}
      decision={DecisionStep}
    />
  {/if}
</main>

