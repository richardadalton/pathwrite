import { usePathContext } from "@daltonr/pathwrite-react";
import type { ApplicationData } from "./application-path";

export function ExperienceStep() {
  const { snapshot, setData } = usePathContext<ApplicationData>();
  const snap   = snapshot!;
  const data   = snap.data;
  const errors = snap.hasAttemptedNext ? snap.fieldErrors : {};

  return (
    <div className="form-body">
      <p className="step-intro">
        Tell us about your background. The next step will run an async eligibility
        check — try entering <strong>less than 2 years</strong> to see the guard
        block navigation.
      </p>

      <div className={`field ${errors.yearsExperience ? "field--error" : ""}`}>
        <label htmlFor="years">Years of Relevant Experience</label>
        <input
          id="years"
          type="number"
          min="0"
          step="1"
          value={data.yearsExperience}
          onChange={e => setData("yearsExperience", e.target.value)}
          placeholder="e.g. 3"
          autoFocus
        />
        {errors.yearsExperience && (
          <span className="field-error">{errors.yearsExperience}</span>
        )}
      </div>

      <div className={`field ${errors.skills ? "field--error" : ""}`}>
        <label htmlFor="skills">Key Skills</label>
        <input
          id="skills"
          type="text"
          value={data.skills}
          onChange={e => setData("skills", e.target.value)}
          placeholder="e.g. TypeScript, React, Node.js"
        />
        {errors.skills && (
          <span className="field-error">{errors.skills}</span>
        )}
      </div>
    </div>
  );
}
