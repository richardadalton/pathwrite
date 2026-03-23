import { usePathContext } from "@daltonr/pathwrite-react";
import type { OnboardingData } from "./onboarding";

export function PersonalInfoStep() {
  const { snapshot, setData } = usePathContext<OnboardingData>();
  // snapshot is always non-null here — PathShell only renders this component
  // when the path is active. The non-null assertion (!) is safe; no cast needed.
  const snap   = snapshot!;
  const data   = snap.data;
  const errors = snap.hasAttemptedNext ? snap.fieldMessages : {};

  return (
    <div className="form-body">
      <p className="step-intro">Let's start with the basics — we just need a name and email.</p>

      <div className="row">
        <div className={`field ${errors.firstName ? "field--error" : ""}`}>
          <label htmlFor="firstName">First Name <span className="required">*</span></label>
          <input id="firstName" type="text" value={data.firstName ?? ""} autoFocus
            onChange={e => setData("firstName", e.target.value.trim())}
            placeholder="Jane" autoComplete="given-name" />
          {errors.firstName && <span className="field-error">{errors.firstName}</span>}
        </div>

        <div className={`field ${errors.lastName ? "field--error" : ""}`}>
          <label htmlFor="lastName">Last Name <span className="required">*</span></label>
          <input id="lastName" type="text" value={data.lastName ?? ""}
            onChange={e => setData("lastName", e.target.value.trim())}
            placeholder="Smith" autoComplete="family-name" />
          {errors.lastName && <span className="field-error">{errors.lastName}</span>}
        </div>
      </div>

      <div className={`field ${errors.email ? "field--error" : ""}`}>
        <label htmlFor="email">Email Address <span className="required">*</span></label>
        <input id="email" type="email" value={data.email ?? ""}
          onChange={e => setData("email", e.target.value.trim())}
          placeholder="jane@example.com" autoComplete="email" />
        {errors.email && <span className="field-error">{errors.email}</span>}
      </div>
    </div>
  );
}

