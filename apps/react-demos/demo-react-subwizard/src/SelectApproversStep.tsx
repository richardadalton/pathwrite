import { usePathContext } from "@daltonr/pathwrite-react";
import { AVAILABLE_APPROVERS } from "./approval";
import type { DocumentData } from "./types";

export function SelectApproversStep() {
  const { snapshot, setData } = usePathContext<DocumentData>();
  const snap    = snapshot!;
  const data    = snap.data;
  const errors  = snap.hasAttemptedNext ? snap.fieldMessages : {};
  const selected = (data.approvers ?? []) as string[];

  function toggle(id: string) {
    const updated = selected.includes(id)
      ? selected.filter(a => a !== id)
      : [...selected, id];
    setData("approvers", updated);
  }

  return (
    <div className="form-body">
      <p className="step-intro">Choose who needs to approve this document. All selected approvers must review before the workflow can proceed.</p>

      <div>
        <p className="pref-label">Available Approvers</p>
        <div className="approver-select-list">
          {AVAILABLE_APPROVERS.map(approver => (
            <label key={approver.id}
              className={`approver-select-item ${selected.includes(approver.id) ? "approver-select-item--selected" : ""}`}>
              <input type="checkbox" checked={selected.includes(approver.id)} onChange={() => toggle(approver.id)} />
              <span className="approver-avatar">{approver.name.charAt(0)}</span>
              <span className="approver-name">{approver.name}</span>
            </label>
          ))}
        </div>
        {errors.approvers && <span className="field-error">{errors.approvers}</span>}
      </div>

      {selected.length > 0 && (
        <p className="selection-count">{selected.length} approver{selected.length !== 1 ? "s" : ""} selected</p>
      )}
    </div>
  );
}

