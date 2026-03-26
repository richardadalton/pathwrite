import { useState } from "react";
import { PathShell } from "@daltonr/pathwrite-react";
import { INITIAL_DATA, EXPERIENCE_LABELS, THEME_LABELS, type OnboardingData } from "./onboarding";
import { PersonalInfoStep } from "./PersonalInfoStep";
import { AboutYouStep }     from "./AboutYouStep";
import { PreferencesStep }  from "./PreferencesStep";
import { ReviewStep }       from "./ReviewStep";

export default function App() {
  const [isCompleted,  setIsCompleted]  = useState(false);
  const [isCancelled,  setIsCancelled]  = useState(false);
  const [completedData, setCompletedData] = useState<OnboardingData | null>(null);

  // Path definition with completion callbacks
  const onboardingPath = {
    id: "onboarding",
    steps: [
      {
        id: "personal-info",
        title: "Personal Info",
        fieldMessages: ({ data }: any) => ({
          firstName: !data.firstName?.trim() ? "First name is required."    : undefined,
          lastName:  !data.lastName?.trim()  ? "Last name is required."     : undefined,
          email:     !data.email?.trim()     ? "Email address is required."
                   : !(data.email.includes("@") && data.email.includes(".")) ? "Enter a valid email address." : undefined,
        }),
      },
      {
        id: "about-you",
        title: "About You",
        canMoveNext: ({ data }: any) => !!data.jobTitle?.trim() && !!data.experience,
        fieldMessages: ({ data }: any) => ({
          jobTitle:   !data.jobTitle?.trim() ? "Job title is required."               : undefined,
          experience: !data.experience       ? "Please select your experience level." : undefined,
        }),
      },
      { id: "preferences", title: "Preferences" },
      { id: "review",      title: "Review" },
    ],
    onComplete: (data: OnboardingData) => {
      setCompletedData(data);
      setIsCompleted(true);
    },
    onCancel: () => {
      setIsCancelled(true);
    }
  };

  function startOver() {
    setIsCompleted(false);
    setIsCancelled(false);
    setCompletedData(null);
  }

  return (
    <main className="page">
      <div className="page-header">
        <h1>User Onboarding</h1>
        <p className="subtitle">A 4-step wizard with guards, validation, and a final review.</p>
      </div>

      {/* Completed */}
      {isCompleted && completedData && (
        <section className="result-panel success-panel">
          <div className="result-icon">🎉</div>
          <h2>Welcome aboard!</h2>
          <p>Your profile has been set up, <strong>{completedData.firstName}</strong>.</p>
          <div className="summary">
            <div className="summary-section">
              <p className="summary-section__title">Personal Info</p>
              <div className="summary-row"><span className="summary-key">Name</span><span>{completedData.firstName} {completedData.lastName}</span></div>
              <div className="summary-row"><span className="summary-key">Email</span><span>{completedData.email}</span></div>
            </div>
            <div className="summary-section">
              <p className="summary-section__title">About You</p>
              <div className="summary-row"><span className="summary-key">Job Title</span><span>{completedData.jobTitle}</span></div>
              {completedData.company && <div className="summary-row"><span className="summary-key">Company</span><span>{completedData.company}</span></div>}
              <div className="summary-row"><span className="summary-key">Experience</span><span>{EXPERIENCE_LABELS[completedData.experience] ?? completedData.experience}</span></div>
            </div>
            <div className="summary-section">
              <p className="summary-section__title">Preferences</p>
              <div className="summary-row"><span className="summary-key">Theme</span><span>{THEME_LABELS[completedData.theme] ?? completedData.theme}</span></div>
              <div className="summary-row"><span className="summary-key">Notifications</span><span>{completedData.notifications ? "Enabled" : "Disabled"}</span></div>
            </div>
          </div>
          <button className="btn-primary" onClick={startOver}>Start Over</button>
        </section>
      )}

      {/* Cancelled */}
      {isCancelled && (
        <section className="result-panel cancel-panel">
          <div className="result-icon">✖</div>
          <h2>Onboarding Cancelled</h2>
          <p>Your profile was not saved.</p>
          <button className="btn-secondary" onClick={startOver}>Try Again</button>
        </section>
      )}

      {/* Active wizard */}
      {!isCompleted && !isCancelled && (
        <PathShell
          path={onboardingPath}
          initialData={INITIAL_DATA}
          completeLabel="Complete Onboarding"
          cancelLabel="Cancel"
          steps={{
            "personal-info": <PersonalInfoStep />,
            "about-you":     <AboutYouStep />,
            "preferences":   <PreferencesStep />,
            "review":        <ReviewStep />,
          }}
        />
      )}
    </main>
  );
}

