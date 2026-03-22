import { usePathContext } from "@daltonr/pathwrite-react";
import { EXPERIENCE_LABELS, THEME_LABELS, type OnboardingData } from "./onboarding";

export function ReviewStep() {
  const { snapshot } = usePathContext<OnboardingData>();
  const data = snapshot?.data ?? {} as OnboardingData;

  return (
    <div className="form-body">
      <p className="step-intro">
        Everything look right? Click <strong>Complete Onboarding</strong> to finish,
        or use <strong>Previous</strong> to make changes.
      </p>

      <div className="review-section">
        <p className="section-title">Personal Info</p>
        <div className="review-card">
          <div className="review-row"><span className="review-key">Full Name</span><span>{data.firstName} {data.lastName}</span></div>
          <div className="review-row"><span className="review-key">Email</span><span>{data.email as string}</span></div>
        </div>
      </div>

      <div className="review-section">
        <p className="section-title">About You</p>
        <div className="review-card">
          <div className="review-row"><span className="review-key">Job Title</span><span>{data.jobTitle as string}</span></div>
          {data.company && <div className="review-row"><span className="review-key">Company</span><span>{data.company as string}</span></div>}
          <div className="review-row"><span className="review-key">Experience</span><span>{EXPERIENCE_LABELS[data.experience as string] ?? data.experience as string}</span></div>
        </div>
      </div>

      <div className="review-section">
        <p className="section-title">Preferences</p>
        <div className="review-card">
          <div className="review-row"><span className="review-key">Theme</span><span>{THEME_LABELS[data.theme as string] ?? data.theme as string}</span></div>
          <div className="review-row">
            <span className="review-key">Notifications</span>
            <span className={`badge ${data.notifications ? "badge--on" : "badge--off"}`}>
              {data.notifications ? "✓ Enabled" : "✗ Disabled"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

