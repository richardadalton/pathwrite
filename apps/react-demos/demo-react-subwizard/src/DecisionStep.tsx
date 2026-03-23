import { usePathContext } from "@daltonr/pathwrite-react";
import type { ApprovalData } from "./types";

export function DecisionStep() {
  const { snapshot, setData } = usePathContext<ApprovalData>();
  const snap   = snapshot!;
  const data   = snap.data;
  const errors = snap.hasAttemptedNext ? snap.fieldMessages : {};

  return (
    <div className="form-body">
      <p className="step-intro">
        You are reviewing <strong>{data.documentTitle as string}</strong> as <strong>{data.approverName as string}</strong>.
      </p>

      <div>
        <p className="pref-label">Your Decision <span className="required">*</span></p>
        <div className="radio-group">
          <label className={`radio-option ${data.decision === "approved" ? "radio-option--approved" : ""}`}>
            <input type="radio" name="decision" value="approved"
              checked={data.decision === "approved"}
              onChange={() => setData("decision", "approved")} />
            <span className="radio-option-label">✓ Approve</span>
            <span className="radio-option-desc">The document is ready to proceed.</span>
          </label>
          <label className={`radio-option ${data.decision === "rejected" ? "radio-option--rejected" : ""}`}>
            <input type="radio" name="decision" value="rejected"
              checked={data.decision === "rejected"}
              onChange={() => setData("decision", "rejected")} />
            <span className="radio-option-label">✗ Reject</span>
            <span className="radio-option-desc">Changes are required before this can proceed.</span>
          </label>
        </div>
        {errors.decision && <span className="field-error">{errors.decision}</span>}
      </div>

      <div className="field">
        <label htmlFor="comment">Comment <span className="optional">(optional)</span></label>
        <textarea id="comment" value={data.comment ?? ""} rows={3}
          onChange={e => setData("comment", e.target.value)}
          placeholder="Add any notes or feedback for the document author..." />
      </div>
    </div>
  );
}

