import { usePathContext } from "@daltonr/pathwrite-react";
import type { DocumentData } from "./types";

export function CreateDocumentStep() {
  const { snapshot, setData } = usePathContext<DocumentData>();
  const snap   = snapshot!;
  const data   = snap.data;
  const errors = snap.hasAttemptedNext ? snap.fieldMessages : {};

  return (
    <div className="form-body">
      <p className="step-intro">Enter the details of the document you want to send for approval.</p>

      <div className={`field ${errors.title ? "field--error" : ""}`}>
        <label htmlFor="title">Title <span className="required">*</span></label>
        <input id="title" type="text" value={data.title ?? ""} autoFocus
          onChange={e => setData("title", e.target.value)}
          placeholder="e.g. Q1 Budget Report" autoComplete="off" />
        {errors.title && <span className="field-error">{errors.title}</span>}
      </div>

      <div className={`field ${errors.description ? "field--error" : ""}`}>
        <label htmlFor="description">Description <span className="required">*</span></label>
        <textarea id="description" value={data.description ?? ""} rows={4}
          onChange={e => setData("description", e.target.value)}
          placeholder="Brief summary of the document and what needs to be approved..." />
        {errors.description && <span className="field-error">{errors.description}</span>}
      </div>
    </div>
  );
}

