<script lang="ts">
  import { usePathContext } from "@daltonr/pathwrite-svelte";
  import type { PathSnapshot } from "@daltonr/pathwrite-svelte";
  import { EXPERIENCE_LABELS, THEME_LABELS, type OnboardingData } from "./onboarding";

  // Receives the completed snapshot from the completion snippet.
  let { snap }: { snap: PathSnapshot<OnboardingData> } = $props();

  // usePathContext() gives us restart() from the shell's Svelte context.
  const ctx = usePathContext<OnboardingData>();
  const data = $derived(snap.data);
</script>

<section class="result-panel success-panel">
  <div class="result-icon">🎉</div>
  <h2>Welcome aboard!</h2>
  <p>Your profile has been set up, <strong>{data.firstName}</strong>.</p>
  <div class="summary">
    <div class="summary-section">
      <p class="summary-section__title">Personal Info</p>
      <div class="summary-row"><span class="summary-key">Name</span><span>{data.firstName} {data.lastName}</span></div>
      <div class="summary-row"><span class="summary-key">Email</span><span>{data.email}</span></div>
    </div>
    <div class="summary-section">
      <p class="summary-section__title">About You</p>
      <div class="summary-row"><span class="summary-key">Job Title</span><span>{data.jobTitle}</span></div>
      {#if data.company}<div class="summary-row"><span class="summary-key">Company</span><span>{data.company}</span></div>{/if}
      <div class="summary-row"><span class="summary-key">Experience</span><span>{EXPERIENCE_LABELS[data.experience] ?? data.experience}</span></div>
    </div>
    <div class="summary-section">
      <p class="summary-section__title">Preferences</p>
      <div class="summary-row"><span class="summary-key">Theme</span><span>{THEME_LABELS[data.theme] ?? data.theme}</span></div>
      <div class="summary-row"><span class="summary-key">Notifications</span><span>{data.notifications ? "Enabled" : "Disabled"}</span></div>
    </div>
  </div>
  <button class="btn-primary" onclick={() => ctx.restart()}>Start Over</button>
</section>
