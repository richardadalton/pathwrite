import { usePathContext } from "@daltonr/pathwrite-react";
import { approvalSubPath, AVAILABLE_APPROVERS } from "./approval";
import type { DocumentData, ApprovalData, ApproverResult } from "./types";

export function ApprovalReviewStep() {
  const { snapshot, startSubPath } = usePathContext<DocumentData>();
  const snap    = snapshot!;
  const data    = snap.data;
  const errors  = snap.hasAttemptedNext ? snap.fieldErrors : {};
  const results = (data.approvalResults ?? {}) as Record<string, ApproverResult>;

  const selectedApprovers = AVAILABLE_APPROVERS.filter(a =>
    (data.approvers as string[]).includes(a.id)
  );

  const allDone = selectedApprovers.length > 0 &&
    selectedApprovers.every(a => !!results[a.id]?.decision);

  function launchReview(approverId: string, approverName: string) {
    const initialData: ApprovalData = {
      approverId,
      approverName,
      documentTitle:       data.title       ?? "",
      documentDescription: data.description ?? "",
      decision: "",
      comment:  "",
    };
    startSubPath(approvalSubPath, initialData, { approverId });
  }

  return (
    <div className="form-body">
      <div className="doc-summary-card">
        <p className="doc-summary-label">Document</p>
        <p className="doc-summary-title">{data.title as string}</p>
        <p className="doc-summary-desc">{data.description as string}</p>
      </div>

      <div>
        <p className="pref-label">Approvers</p>
        <div className="approver-review-list">
          {selectedApprovers.map(approver => (
            <div key={approver.id} className="approver-review-item">
              <span className="approver-avatar">{approver.name.charAt(0)}</span>
              <span className="approver-review-name">{approver.name}</span>
              {results[approver.id] ? (
                <span className={`decision-badge ${results[approver.id].decision === "approved" ? "decision-badge--approved" : "decision-badge--rejected"}`}>
                  {results[approver.id].decision === "approved" ? "✓ Approved" : "✗ Rejected"}
                </span>
              ) : (
                <button type="button" className="btn-review"
                  disabled={snap.isNavigating}
                  onClick={() => launchReview(approver.id, approver.name)}>
                  Review →
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {snap.hasAttemptedNext && errors._ && (
        <p className="gate-message">⏳ {errors._}</p>
      )}
      {allDone && <p className="gate-message gate-message--done">✓ All approvers have responded. Click Next to continue.</p>}
    </div>
  );
}

