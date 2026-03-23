import { usePathContext } from "@daltonr/pathwrite-react";
import type { ApprovalData } from "./types";

export function ViewDocumentStep() {
  const { snapshot } = usePathContext<ApprovalData>();
  const data = snapshot!.data;

  return (
    <div className="form-body">
      <p className="step-intro">
        Reviewing as <strong>{data.approverName as string}</strong>. Please read the document carefully before making your decision.
      </p>
      <div className="document-preview">
        <p className="document-preview__label">Document</p>
        <p className="document-preview__title">{data.documentTitle as string}</p>
        <p className="document-preview__body">{data.documentDescription as string}</p>
      </div>
      <p className="step-note">Click <strong>Next</strong> to record your decision, or <strong>Previous</strong> to return to the approvals list.</p>
    </div>
  );
}

