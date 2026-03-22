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
  const { snapshot, setData } = usePathContext<ContactData>();
  const data = snapshot?.data ?? ({} as ContactData);
  const messageLen = (data.message ?? "").length;

  return (
    <div className="form-body">

      {/* Name */}
      <div className="field">
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
      </div>

      {/* Email */}
      <div className="field">
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
      </div>

      {/* Subject */}
      <div className="field">
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
      </div>

      {/* Message */}
      <div className="field">
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
      </div>

    </div>
  );
}

