import { usePathContext } from "@daltonr/pathwrite-react";
import type { OnboardingData } from "./onboarding";

export function EnterNameStep() {
  const { snapshot, setData } = usePathContext<OnboardingData>();
  const snap   = snapshot!;
  const errors = snap.hasAttemptedNext ? snap.fieldErrors : {};

  return (
    <div className="form-body">
      <p className="step-intro">
        Enter the new employee's full name to begin their onboarding record.
      </p>
      <div className={`field ${errors.employeeName ? "field--error" : ""}`}>
        <label htmlFor="employeeName">
          Full Name <span className="required">*</span>
        </label>
        <input
          id="employeeName"
          type="text"
          value={snap.data.employeeName ?? ""}
          autoFocus
          onChange={e => setData("employeeName", e.target.value)}
          placeholder="e.g. Jane Smith"
          autoComplete="name"
        />
        {errors.employeeName && (
          <span className="field-error">{errors.employeeName}</span>
        )}
      </div>
    </div>
  );
}
