<script lang="ts">
  import { PathShell } from "@daltonr/pathwrite-svelte";
  import { INITIAL_DATA, type OnboardingData } from "./onboarding";
  import PersonalInfoStep from "./PersonalInfoStep.svelte";
  import AboutYouStep     from "./AboutYouStep.svelte";
  import PreferencesStep  from "./PreferencesStep.svelte";
  import ReviewStep       from "./ReviewStep.svelte";
  import CompletionPanel  from "./CompletionPanel.svelte";

  let isCancelled = $state(false);

  // Path definition — completionBehaviour defaults to "stayOnFinal", so
  // PathShell stays mounted and renders the completion snippet on finish.
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
    onCancel: () => { isCancelled = true; },
  };
</script>

<main class="page">
  <div class="page-header">
    <h1>User Onboarding</h1>
    <p class="subtitle">A 4-step wizard with guards, validation, and a final review.</p>
  </div>

  <!-- Cancelled -->
  {#if isCancelled}
    <section class="result-panel cancel-panel">
      <div class="result-icon">✖</div>
      <h2>Onboarding Cancelled</h2>
      <p>Your profile was not saved.</p>
      <button class="btn-secondary" onclick={() => { isCancelled = false; }}>Try Again</button>
    </section>
  {/if}

  <!-- Wizard — stays mounted; shows CompletionPanel snippet when path finishes -->
  {#if !isCancelled}
    <PathShell
      path={onboardingPath}
      initialData={INITIAL_DATA}
      completeLabel="Complete Onboarding"
      cancelLabel="Cancel"
      validationDisplay="inline"
      personalInfo={PersonalInfoStep}
      aboutYou={AboutYouStep}
      preferences={PreferencesStep}
      review={ReviewStep}
    >
      {#snippet completion(snap)}
        <CompletionPanel {snap} />
      {/snippet}
    </PathShell>
  {/if}
</main>
