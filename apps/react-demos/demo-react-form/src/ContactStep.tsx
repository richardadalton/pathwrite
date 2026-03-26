import { usePathContext } from "@daltonr/pathwrite-react";
import type { ContactData } from "./path";

const SUBJECTS = [
  "General Enquiry",
  "Bug Report",
  "Feature Request",
  "Other",
];

export function ContactStep() {
  // usePathContext() reaches into the PathShell's PathContext — no prop
  // drilling or template reference variables needed.
  const { snapshot, setData, resetStep } = usePathContext<ContactData>();
  const data = snapshot?.data ?? ({} as ContactData);
  const messageLen = (data.message ?? "").length;
  const errors = snapshot?.hasAttemptedNext ? (snapshot.fieldMessages ?? {}) : {};

  return (
    <div className="form-body">

      {/* isDirty indicator */}
      {snapshot?.isDirty && (
        <div className="unsaved-changes-banner">
          ✏️ You have unsaved changes
        </div>
      )}

      {/* Name */}
      <div className={`field ${errors.name ? "field--error" : ""}`}>
        <label htmlFor="name">
          Full Name <span className="required">*</span>
        </label>
        <input
          id="name"
          type="text"
          value={data.name ?? ""}
          onChange={(e) => setData("name", e.target.value)}
          placeholder="Jane Smith"
          autoComplete="name"
          autoFocus
        />
        {errors.name && <span className="field-error">{errors.name}</span>}
      </div>

      {/* Email */}
      <div className={`field ${errors.email ? "field--error" : ""}`}>
        <label htmlFor="email">
          Email Address <span className="required">*</span>
        </label>
        <input
          id="email"
          type="email"
          value={data.email ?? ""}
          onChange={(e) => setData("email", e.target.value)}
          placeholder="jane@example.com"
          autoComplete="email"
        />
        {errors.email && <span className="field-error">{errors.email}</span>}
      </div>

      {/* Subject */}
      <div className={`field ${errors.subject ? "field--error" : ""}`}>
        <label htmlFor="subject">
          Subject <span className="required">*</span>
        </label>
        <select
          id="subject"
          value={data.subject ?? ""}
          onChange={(e) => setData("subject", e.target.value)}
        >
          <option value="" disabled>Select a subject…</option>
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {errors.subject && <span className="field-error">{errors.subject}</span>}
      </div>

      {/* Message */}
      <div className={`field ${errors.message ? "field--error" : ""}`}>
        <label htmlFor="message">
          Message <span className="required">*</span>{" "}
          <span className="field-hint">(min 10 characters)</span>
        </label>
        <textarea
          id="message"
          rows={5}
          value={data.message ?? ""}
          onChange={(e) => setData("message", e.target.value)}
          placeholder="How can we help you?"
        />
        <span className="char-count">{messageLen} chars</span>
        {errors.message && <span className="field-error">{errors.message}</span>}
      </div>

      {/* Reset Button */}
      <div className="reset-button-container">
        <button 
          type="button" 
          className="btn-reset" 
          onClick={resetStep}
          disabled={!snapshot?.isDirty}
        >
          Clear Form
        </button>
      </div>

    </div>
  );
}

