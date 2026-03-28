import { usePathContext, useField } from "@daltonr/pathwrite-react";
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
  const { snapshot, resetStep } = usePathContext<ContactData>();
  const errors = snapshot.hasAttemptedNext ? snapshot.fieldErrors : {};

  // useField returns { value, onChange } bound to snapshot.data — spread directly
  // onto each input to replace the repetitive onChange={e => setData("f", e.target.value)} pattern.
  const name    = useField<ContactData, "name">("name");
  const email   = useField<ContactData, "email">("email");
  const subject = useField<ContactData, "subject">("subject");
  const message = useField<ContactData, "message">("message");

  return (
    <div className="form-body">

      {/* isDirty indicator */}
      {snapshot.isDirty && (
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
          {...name}
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
          {...email}
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
        <select id="subject" {...subject}>
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
          {...message}
          placeholder="How can we help you?"
        />
        <span className="char-count">{message.value.length} chars</span>
        {errors.message && <span className="field-error">{errors.message}</span>}
      </div>

      {/* Reset Button */}
      <div className="reset-button-container">
        <button
          type="button"
          className="btn-reset"
          onClick={resetStep}
          disabled={!snapshot.isDirty}
        >
          Clear Form
        </button>
      </div>

    </div>
  );
}
