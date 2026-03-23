import { usePathContext } from "@daltonr/pathwrite-react";
import type { OnboardingData } from "./onboarding";

const EXPERIENCE_OPTIONS = [
  { value: "junior", label: "Junior (0–2 years)" },
  { value: "mid",    label: "Mid-level (3–5 years)" },
  { value: "senior", label: "Senior (6–10 years)" },
  { value: "lead",   label: "Lead / Principal (10+ years)" },
];

export function AboutYouStep() {
  const { snapshot, setData } = usePathContext<OnboardingData>();
  // snapshot is always non-null here — PathShell only renders this component
  // when the path is active. The non-null assertion (!) is safe; no cast needed.
  const snap   = snapshot!;
  const data   = snap.data;
  const errors = snap.hasAttemptedNext ? snap.fieldMessages : {};

  return (
    <div className="form-body">
      <p className="step-intro">Tell us a bit about your professional background.</p>

      <div className={`field ${errors.jobTitle ? "field--error" : ""}`}>
        <label htmlFor="jobTitle">Job Title <span className="required">*</span></label>
        <input id="jobTitle" type="text" value={data.jobTitle ?? ""} autoFocus
          onChange={e => setData("jobTitle", e.target.value.trim())}
          placeholder="e.g. Frontend Developer" autoComplete="organization-title" />
        {errors.jobTitle && <span className="field-error">{errors.jobTitle}</span>}
      </div>

      <div className="field">
        <label htmlFor="company">Company <span className="optional">(optional)</span></label>
        <input id="company" type="text" value={data.company ?? ""}
          onChange={e => setData("company", e.target.value.trim())}
          placeholder="e.g. Acme Corp" autoComplete="organization" />
      </div>

      <div className={`field ${errors.experience ? "field--error" : ""}`}>
        <label htmlFor="experience">Experience Level <span className="required">*</span></label>
        <select id="experience" value={data.experience ?? ""}
          onChange={e => setData("experience", e.target.value)}>
          <option value="" disabled>Select your level…</option>
          {EXPERIENCE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {errors.experience && <span className="field-error">{errors.experience}</span>}
      </div>
    </div>
  );
}

