import { usePathContext } from "@daltonr/pathwrite-react";
import { AVAILABLE_APPROVERS } from "./approval";
import type { DocumentData, ApproverResult } from "./types";

export function SummaryStep() {
  const { snapshot } = usePathContext<DocumentData>();
  const data    = snapshot!.data;
  const results = (data.approvalResults ?? {}) as Record<string, ApproverResult>;

  const selectedApprovers = AVAILABLE_APPROVERS.filter(a =>
    (data.approvers as string[]).includes(a.id)
  );

  const allApproved = selectedApprovers.every(a => results[a.id]?.decision === "approved");
  const anyRejected = selectedApprovers.some(a  => results[a.id]?.decision === "rejected");
  const status = allApproved ? "approved" : anyRejected ? "rejected" : "mixed";

  return (
    <div className="form-body">
      <div className={`outcome-banner outcome-banner--${status}`}>
        <span className="outcome-icon">{status === "approved" ? "✓" : status === "rejected" ? "✗" : "⚠"}</span>
        <span>
          {status === "approved" && "All approvers approved the document."}
          {status === "rejected" && "One or more approvers rejected the document."}
          {status === "mixed"    && "Mixed results — review comments below."}
        </span>
      </div>

      <div className="review-section">
        <p className="section-title">Document</p>
        <div className="review-card">
          <div className="review-row"><span className="review-key">Title</span><span>{data.title as string}</span></div>
          <div className="review-row"><span className="review-key">Description</span><span>{data.description as string}</span></div>
        </div>
      </div>

      <div className="review-section">
        <p className="section-title">Approver Decisions</p>
        <div className="review-card">
          {selectedApprovers.map(approver => (
            <div key={approver.id} className="approver-result-row">
              <span className="approver-avatar">{approver.name.charAt(0)}</span>
              <span className="approver-result-name">{approver.name}</span>
              <span className={`decision-badge ${results[approver.id]?.decision === "approved" ? "decision-badge--approved" : "decision-badge--rejected"}`}>
                {results[approver.id]?.decision === "approved" ? "✓ Approved" : "✗ Rejected"}
              </span>
              {results[approver.id]?.comment && (
                <span className="approver-comment">"{results[approver.id].comment}"</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

