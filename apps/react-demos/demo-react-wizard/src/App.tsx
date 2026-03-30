import { useState } from "react";
import { PathShell, usePathContext } from "@daltonr/pathwrite-react";
import { INITIAL_DATA, EXPERIENCE_LABELS, THEME_LABELS, type OnboardingData } from "./onboarding";
import { PersonalInfoStep } from "./PersonalInfoStep";
import { AboutYouStep }     from "./AboutYouStep";
import { PreferencesStep }  from "./PreferencesStep";
import { ReviewStep }       from "./ReviewStep";

// Rendered by PathShell when snapshot.status === "completed".
// usePathContext() gives us the completed snapshot (with data) and restart().
function CompletionPanel() {
  const { snapshot, restart } = usePathContext<OnboardingData>();
  const data = snapshot!.data;

  return (
    <section className="result-panel success-panel">
      <div className="result-icon">🎉</div>
      <h2>Welcome aboard!</h2>
      <p>Your profile has been set up, <strong>{data.firstName}</strong>.</p>
      <div className="summary">
        <div className="summary-section">
          <p className="summary-section__title">Personal Info</p>
          <div className="summary-row"><span className="summary-key">Name</span><span>{data.firstName} {data.lastName}</span></div>
          <div className="summary-row"><span className="summary-key">Email</span><span>{data.email}</span></div>
        </div>
        <div className="summary-section">
          <p className="summary-section__title">About You</p>
          <div className="summary-row"><span className="summary-key">Job Title</span><span>{data.jobTitle}</span></div>
          {data.company && <div className="summary-row"><span className="summary-key">Company</span><span>{data.company}</span></div>}
          <div className="summary-row"><span className="summary-key">Experience</span><span>{EXPERIENCE_LABELS[data.experience] ?? data.experience}</span></div>
        </div>
        <div className="summary-section">
          <p className="summary-section__title">Preferences</p>
          <div className="summary-row"><span className="summary-key">Theme</span><span>{THEME_LABELS[data.theme] ?? data.theme}</span></div>
          <div className="summary-row"><span className="summary-key">Notifications</span><span>{data.notifications ? "Enabled" : "Disabled"}</span></div>
        </div>
      </div>
      <button className="btn-primary" onClick={() => restart()}>Start Over</button>
    </section>
  );
}

export default function App() {
  const [isCancelled, setIsCancelled] = useState(false);

  // Path definition — completionBehaviour defaults to "stayOnFinal", so
  // PathShell stays mounted and renders <CompletionPanel> on finish.
  const onboardingPath = {
    id: "onboarding",
    steps: [
      {
        id: "personal-info",
        title: "Personal Info",
        fieldErrors: ({ data }: any) => ({
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
        fieldErrors: ({ data }: any) => ({
          jobTitle:   !data.jobTitle?.trim() ? "Job title is required."               : undefined,
          experience: !data.experience       ? "Please select your experience level." : undefined,
        }),
      },
      { id: "preferences", title: "Preferences" },
      { id: "review",      title: "Review" },
    ],
    onCancel: () => setIsCancelled(true),
  };

  return (
    <main className="page">
      <div className="page-header">
        <h1>User Onboarding</h1>
        <p className="subtitle">A 4-step wizard with guards, validation, and a final review.</p>
      </div>

      {/* Cancelled */}
      {isCancelled && (
        <section className="result-panel cancel-panel">
          <div className="result-icon">✖</div>
          <h2>Onboarding Cancelled</h2>
          <p>Your profile was not saved.</p>
          <button className="btn-secondary" onClick={() => setIsCancelled(false)}>Try Again</button>
        </section>
      )}

      {/* Wizard — stays mounted; shows CompletionPanel when path finishes */}
      {!isCancelled && (
        <PathShell
          path={onboardingPath}
          initialData={INITIAL_DATA}
          completeLabel="Complete Onboarding"
          cancelLabel="Cancel"
          validationDisplay="inline"
          completionContent={<CompletionPanel />}
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
