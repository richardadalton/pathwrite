<script lang="ts">
  import PathShell from "@daltonr/pathwrite-svelte/PathShell.svelte";
  import { INITIAL_DATA, EXPERIENCE_LABELS, THEME_LABELS, type OnboardingData } from "./onboarding";
  import PersonalInfoStep from "./PersonalInfoStep.svelte";
  import AboutYouStep     from "./AboutYouStep.svelte";
  import PreferencesStep  from "./PreferencesStep.svelte";
  import ReviewStep       from "./ReviewStep.svelte";

  let isCompleted   = $state(false);
  let isCancelled   = $state(false);
  let completedData = $state<OnboardingData | null>(null);

  // Path definition with completion callbacks
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
    onComplete: (data: OnboardingData) => {
      completedData = data;
      isCompleted = true;
    },
    onCancel: () => {
      isCancelled = true;
    }
  };

  function startOver() {
    isCompleted   = false;
    isCancelled   = false;
    completedData = null;
  }
</script>

<main class="page">
  <div class="page-header">
    <h1>User Onboarding</h1>
    <p class="subtitle">A 4-step wizard with guards, validation, and a final review.</p>
  </div>

  <!-- Completed -->
  {#if isCompleted && completedData}
    <section class="result-panel success-panel">
      <div class="result-icon">🎉</div>
      <h2>Welcome aboard!</h2>
      <p>Your profile has been set up, <strong>{completedData.firstName}</strong>.</p>
      <div class="summary">
        <div class="summary-section">
          <p class="summary-section__title">Personal Info</p>
          <div class="summary-row"><span class="summary-key">Name</span><span>{completedData.firstName} {completedData.lastName}</span></div>
          <div class="summary-row"><span class="summary-key">Email</span><span>{completedData.email}</span></div>
        </div>
        <div class="summary-section">
          <p class="summary-section__title">About You</p>
          <div class="summary-row"><span class="summary-key">Job Title</span><span>{completedData.jobTitle}</span></div>
          {#if completedData.company}<div class="summary-row"><span class="summary-key">Company</span><span>{completedData.company}</span></div>{/if}
          <div class="summary-row"><span class="summary-key">Experience</span><span>{EXPERIENCE_LABELS[completedData.experience] ?? completedData.experience}</span></div>
        </div>
        <div class="summary-section">
          <p class="summary-section__title">Preferences</p>
          <div class="summary-row"><span class="summary-key">Theme</span><span>{THEME_LABELS[completedData.theme] ?? completedData.theme}</span></div>
          <div class="summary-row"><span class="summary-key">Notifications</span><span>{completedData.notifications ? "Enabled" : "Disabled"}</span></div>
        </div>
      </div>
      <button class="btn-primary" onclick={startOver}>Start Over</button>
    </section>
  {/if}

  <!-- Cancelled -->
  {#if isCancelled}
    <section class="result-panel cancel-panel">
      <div class="result-icon">✖</div>
      <h2>Onboarding Cancelled</h2>
      <p>Your profile was not saved.</p>
      <button class="btn-secondary" onclick={startOver}>Try Again</button>
    </section>
  {/if}

  <!-- Active wizard -->
  {#if !isCompleted && !isCancelled}
    <PathShell
      path={onboardingPath}
      initialData={INITIAL_DATA}
      completeLabel="Complete Onboarding"
      cancelLabel="Cancel"
      personalInfo={PersonalInfoStep}
      aboutYou={AboutYouStep}
      preferences={PreferencesStep}
      review={ReviewStep}
    />
  {/if}
</main>

