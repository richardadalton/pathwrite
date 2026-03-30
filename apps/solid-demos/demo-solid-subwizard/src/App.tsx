import { createSignal, Show, For } from "solid-js";
import { PathShell } from "@daltonr/pathwrite-solid";
import type { PathData } from "@daltonr/pathwrite-solid";
import { approvalWorkflowPath, INITIAL_DATA, AVAILABLE_APPROVERS } from "./approval";
import type { DocumentData, ApproverResult } from "./types";
import CreateDocumentStep  from "./CreateDocumentStep";
import SelectApproversStep from "./SelectApproversStep";
import ApprovalReviewStep  from "./ApprovalReviewStep";
import SummaryStep         from "./SummaryStep";
import ViewDocumentStep    from "./ViewDocumentStep";
import DecisionStep        from "./DecisionStep";

export default function App() {
  const [isCompleted, setIsCompleted]     = createSignal(false);
  const [isCancelled, setIsCancelled]     = createSignal(false);
  const [completedData, setCompletedData] = createSignal<DocumentData | null>(null);

  function handleComplete(data: PathData) {
    setCompletedData(data as DocumentData);
    setIsCompleted(true);
  }

  function handleCancel() {
    setIsCancelled(true);
  }

  function startOver() {
    setIsCompleted(false);
    setIsCancelled(false);
    setCompletedData(null);
  }

  function getResults(d: DocumentData) {
    return (d.approvalResults ?? {}) as Record<string, ApproverResult>;
  }

  function getSelectedApprovers(d: DocumentData) {
    return AVAILABLE_APPROVERS.filter(a => (d.approvers as string[]).includes(a.id));
  }

  function getStatus(d: DocumentData): "approved" | "rejected" | "mixed" {
    const ids = d.approvers as string[];
    if (ids.every(id => getResults(d)[id]?.decision === "approved")) return "approved";
    if (ids.some(id  => getResults(d)[id]?.decision === "rejected"))  return "rejected";
    return "mixed";
  }

  return (
    <main class="page">
      <div class="page-header">
        <h1>Approval Workflow</h1>
        <p class="subtitle">Subwizard demo — dynamically launch a per-approver review subwizard gated by all approvers completing.</p>
      </div>

      {/* Completed */}
      <Show when={isCompleted() && completedData()}>
        {(data) => {
          const st = getStatus(data());
          return (
            <section class="result-panel" classList={{ "success-panel": st === "approved", "cancel-panel": st !== "approved" }}>
              <div class="result-icon">{st === "approved" ? "✅" : "❌"}</div>
              <h2>{st === "approved" ? "Document Approved!" : "Document Rejected"}</h2>
              <p>
                {st === "approved"
                  ? `All approvers signed off on "${data().title}".`
                  : `One or more approvers rejected "${data().title}".`}
              </p>

              <div style="max-width: 480px; margin: 0 auto 20px;">
                <div class="review-section">
                  <p class="section-title">Document</p>
                  <div class="review-card">
                    <div class="review-row">
                      <span class="review-key">Title</span>
                      <span>{data().title}</span>
                    </div>
                    <div class="review-row">
                      <span class="review-key">Description</span>
                      <span>{data().description}</span>
                    </div>
                  </div>
                </div>

                <div class="review-section" style="margin-bottom: 0;">
                  <p class="section-title">Decisions</p>
                  <div class="review-card">
                    <For each={getSelectedApprovers(data())}>
                      {(approver) => (
                        <div class="review-row">
                          <span class="review-key">{approver.name}</span>
                          <span classList={{
                            "text-approved": getResults(data())[approver.id]?.decision === "approved",
                            "text-rejected": getResults(data())[approver.id]?.decision === "rejected",
                          }}>
                            {getResults(data())[approver.id]?.decision === "approved" ? "✓ Approved" : "✗ Rejected"}
                            <Show when={getResults(data())[approver.id]?.comment}>
                              {" — "}<em>{getResults(data())[approver.id].comment}</em>
                            </Show>
                          </span>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </div>

              <button class="btn-primary" onClick={startOver}>Start Over</button>
            </section>
          );
        }}
      </Show>

      {/* Cancelled */}
      <Show when={isCancelled()}>
        <section class="result-panel cancel-panel">
          <div class="result-icon">✖</div>
          <h2>Workflow Cancelled</h2>
          <p>No approvals were recorded.</p>
          <button class="btn-secondary" onClick={startOver}>Try Again</button>
        </section>
      </Show>

      {/* Active wizard */}
      <Show when={!isCompleted() && !isCancelled()}>
        <PathShell
          path={approvalWorkflowPath}
          initialData={INITIAL_DATA}
          completeLabel="Finalise"
          cancelLabel="Cancel"
          validationDisplay="inline"
          onComplete={handleComplete}
          onCancel={handleCancel}
          steps={{
            createDocument:  () => <CreateDocumentStep />,
            selectApprovers: () => <SelectApproversStep />,
            approvalReview:  () => <ApprovalReviewStep />,
            summary:         () => <SummaryStep />,
            viewDocument:    () => <ViewDocumentStep />,
            decision:        () => <DecisionStep />,
          }}
        />
      </Show>
    </main>
  );
}
