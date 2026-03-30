import { createSignal, Show } from "solid-js";
import { PathShell, usePathContext } from "@daltonr/pathwrite-solid";
import type { PathSnapshot } from "@daltonr/pathwrite-solid";
import { onboardingPath, INITIAL_DATA, EXPERIENCE_LABELS, THEME_LABELS, type OnboardingData } from "./onboarding";
import PersonalInfoStep from "./PersonalInfoStep";
import AboutYouStep     from "./AboutYouStep";
import PreferencesStep  from "./PreferencesStep";
import ReviewStep       from "./ReviewStep";

// Rendered by PathShell when snapshot().status === "completed".
// usePathContext() gives us restart() from the shell's provided context.
function CompletionPanel(props: { snapshot: PathSnapshot<OnboardingData> }) {
  const { restart } = usePathContext<OnboardingData>();
  const data = props.snapshot.data;

  return (
    <section class="result-panel success-panel">
      <div class="result-icon">🎉</div>
      <h2>Welcome aboard!</h2>
      <p>Your profile has been set up, <strong>{data.firstName}</strong>.</p>

      <div class="submitted-summary" style="max-width: 480px;">
        <div class="review-section">
          <p class="section-title">Personal Info</p>
          <div class="review-card">
            <div class="review-row">
              <span class="review-key">Name</span>
              <span>{data.firstName} {data.lastName}</span>
            </div>
            <div class="review-row">
              <span class="review-key">Email</span>
              <span>{data.email}</span>
            </div>
          </div>
        </div>

        <div class="review-section">
          <p class="section-title">About You</p>
          <div class="review-card">
            <div class="review-row">
              <span class="review-key">Job Title</span>
              <span>{data.jobTitle}</span>
            </div>
            <Show when={data.company}>
              <div class="review-row">
                <span class="review-key">Company</span>
                <span>{data.company}</span>
              </div>
            </Show>
            <div class="review-row">
              <span class="review-key">Experience</span>
              <span>{EXPERIENCE_LABELS[data.experience] ?? data.experience}</span>
            </div>
          </div>
        </div>

        <div class="review-section" style="margin-bottom: 0;">
          <p class="section-title">Preferences</p>
          <div class="review-card">
            <div class="review-row">
              <span class="review-key">Theme</span>
              <span>{THEME_LABELS[data.theme] ?? data.theme}</span>
            </div>
            <div class="review-row">
              <span class="review-key">Notifications</span>
              <span class={data.notifications ? "badge badge--on" : "badge badge--off"}>
                {data.notifications ? "✓ Enabled" : "✗ Disabled"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <button class="btn-primary" onClick={() => restart()}>Start Over</button>
    </section>
  );
}

export default function App() {
  const [isCancelled, setIsCancelled] = createSignal(false);

  return (
    <main class="page">
      <div class="page-header">
        <h1>User Onboarding</h1>
        <p class="subtitle">A 4-step wizard with guards, validation, and a final review.</p>
      </div>

      {/* Cancelled */}
      <Show when={isCancelled()}>
        <section class="result-panel cancel-panel">
          <div class="result-icon">✖</div>
          <h2>Onboarding Cancelled</h2>
          <p>Your profile was not saved.</p>
          <button class="btn-secondary" onClick={() => setIsCancelled(false)}>Try Again</button>
        </section>
      </Show>

      {/* Wizard — stays mounted; shows CompletionPanel when path finishes */}
      <Show when={!isCancelled()}>
        <PathShell
          path={onboardingPath}
          initialData={INITIAL_DATA}
          completeLabel="Complete Onboarding"
          cancelLabel="Cancel"
          validationDisplay="inline"
          onCancel={() => setIsCancelled(true)}
          completionContent={(snap) => <CompletionPanel snapshot={snap as PathSnapshot<OnboardingData>} />}
          steps={{
            personalInfo: () => <PersonalInfoStep />,
            aboutYou:     () => <AboutYouStep />,
            preferences:  () => <PreferencesStep />,
            review:       () => <ReviewStep />,
          }}
        />
      </Show>
    </main>
  );
}
