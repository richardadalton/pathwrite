import { useState } from "react";
import { PathShell } from "@daltonr/pathwrite-react";
import type { PathData } from "@daltonr/pathwrite-react";
import { approvalWorkflowPath, INITIAL_DATA, AVAILABLE_APPROVERS } from "./approval";
import type { DocumentData, ApproverResult } from "./types";
import { CreateDocumentStep }  from "./CreateDocumentStep";
import { SelectApproversStep } from "./SelectApproversStep";
import { ApprovalReviewStep }  from "./ApprovalReviewStep";
import { SummaryStep }         from "./SummaryStep";
import { ViewDocumentStep }    from "./ViewDocumentStep";
import { DecisionStep }        from "./DecisionStep";

export default function App() {
  const [isCompleted,   setIsCompleted]   = useState(false);
  const [isCancelled,   setIsCancelled]   = useState(false);
  const [completedData, setCompletedData] = useState<DocumentData | null>(null);

  function handleComplete(data: PathData) { setCompletedData(data as DocumentData); setIsCompleted(true); }
  function handleCancel()  { setIsCancelled(true); }
  function startOver()     { setIsCompleted(false); setIsCancelled(false); setCompletedData(null); }

  const results  = (d: DocumentData) => (d.approvalResults ?? {}) as Record<string, ApproverResult>;
  const approvers = (d: DocumentData) => AVAILABLE_APPROVERS.filter(a => (d.approvers as string[]).includes(a.id));
  const status    = (d: DocumentData) => {
    const ids = d.approvers as string[];
    if (ids.every(id => results(d)[id]?.decision === "approved")) return "approved";
    if (ids.some(id  => results(d)[id]?.decision === "rejected"))  return "rejected";
    return "mixed";
  };

  return (
    <main className="page">
      <div className="page-header">
        <h1>Approval Workflow</h1>
        <p className="subtitle">Subwizard demo — dynamically launch a per-approver review subwizard gated by all approvers completing.</p>
      </div>

      {isCompleted && completedData && (
        <section className={`result-panel ${status(completedData) === "approved" ? "success-panel" : "reject-panel"}`}>
          <div className="result-icon">{status(completedData) === "approved" ? "✅" : "❌"}</div>
          <h2>{status(completedData) === "approved" ? "Document Approved!" : "Document Rejected"}</h2>
          <p>{status(completedData) === "approved"
            ? <span>All approvers signed off on <strong>{completedData.title as string}</strong>.</span>
            : <span>One or more approvers rejected <strong>{completedData.title as string}</strong>.</span>}
          </p>
          <div className="summary">
            <div className="summary-section">
              <p className="summary-section__title">Document</p>
              <div className="summary-row"><span className="summary-key">Title</span><span>{completedData.title as string}</span></div>
              <div className="summary-row"><span className="summary-key">Description</span><span>{completedData.description as string}</span></div>
            </div>
            <div className="summary-section">
              <p className="summary-section__title">Decisions</p>
              {approvers(completedData).map(a => (
                <div key={a.id} className="summary-row">
                  <span className="summary-key">{a.name}</span>
                  <span className={results(completedData)[a.id]?.decision === "approved" ? "text-approved" : "text-rejected"}>
                    {results(completedData)[a.id]?.decision === "approved" ? "✓ Approved" : "✗ Rejected"}
                    {results(completedData)[a.id]?.comment && <em> — {results(completedData)[a.id].comment}</em>}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <button className="btn-primary" onClick={startOver}>Start Over</button>
        </section>
      )}

      {isCancelled && (
        <section className="result-panel cancel-panel">
          <div className="result-icon">✖</div>
          <h2>Workflow Cancelled</h2>
          <p>No approvals were recorded.</p>
          <button className="btn-secondary" onClick={startOver}>Try Again</button>
        </section>
      )}

      {!isCompleted && !isCancelled && (
        <PathShell
          path={approvalWorkflowPath}
          initialData={INITIAL_DATA}
          completeLabel="Finalise"
          cancelLabel="Cancel"
          validationDisplay="inline"
          onComplete={handleComplete}
          onCancel={handleCancel}
          steps={{
            "create-document":  <CreateDocumentStep />,
            "select-approvers": <SelectApproversStep />,
            "approval-review":  <ApprovalReviewStep />,
            "summary":          <SummaryStep />,
            "view-document":    <ViewDocumentStep />,
            "decision":         <DecisionStep />,
          }}
        />
      )}
    </main>
  );
}

