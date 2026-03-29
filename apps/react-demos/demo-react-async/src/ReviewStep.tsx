import { usePathContext } from "@daltonr/pathwrite-react";
import type { ApplicationData } from "@daltonr/pathwrite-demo-workflow-job-application";

export function ReviewStep() {
  const { snapshot } = usePathContext<ApplicationData>();
  const snap = snapshot!;
  const data = snap.data;

  return (
    <div className="form-body">
      <p className="step-intro">
        All async checks passed. Review your application before submitting.
      </p>

      <div className="eligibility-summary">
        <div className="summary-row">
          <span className="summary-key">Role</span>
          <span>{data.roleId as string}</span>
        </div>
        <div className="summary-row">
          <span className="summary-key">Experience</span>
          <span>{data.yearsExperience} years</span>
        </div>
        <div className="summary-row">
          <span className="summary-key">Skills</span>
          <span>{data.skills as string}</span>
        </div>
        {data.coverLetter && (
          <div className="summary-row">
            <span className="summary-key">Cover Letter</span>
            <span>{data.coverLetter as string}</span>
          </div>
        )}
      </div>
    </div>
  );
}
