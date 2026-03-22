<script lang="ts">
  import { getPathContext } from "@daltonr/pathwrite-svelte";
  import { EXPERIENCE_LABELS, THEME_LABELS, type OnboardingData } from "./onboarding";

  const ctx = getPathContext<OnboardingData>();
</script>

{#if ctx.snapshot}
  {@const d = ctx.snapshot.data}
  <div class="form-body">
    <p class="step-intro">
      Everything look right? Click <strong>Complete Onboarding</strong> to finish,
      or use <strong>Previous</strong> to make changes.
    </p>

    <div class="review-section">
      <p class="section-title">Personal Info</p>
      <div class="review-card">
        <div class="review-row"><span class="review-key">Full Name</span><span>{d.firstName} {d.lastName}</span></div>
        <div class="review-row"><span class="review-key">Email</span><span>{d.email}</span></div>
      </div>
    </div>

    <div class="review-section">
      <p class="section-title">About You</p>
      <div class="review-card">
        <div class="review-row"><span class="review-key">Job Title</span><span>{d.jobTitle}</span></div>
        {#if d.company}<div class="review-row"><span class="review-key">Company</span><span>{d.company}</span></div>{/if}
        <div class="review-row"><span class="review-key">Experience</span><span>{EXPERIENCE_LABELS[d.experience as string] ?? d.experience}</span></div>
      </div>
    </div>

    <div class="review-section">
      <p class="section-title">Preferences</p>
      <div class="review-card">
        <div class="review-row"><span class="review-key">Theme</span><span>{THEME_LABELS[d.theme as string] ?? d.theme}</span></div>
        <div class="review-row">
          <span class="review-key">Notifications</span>
          <span class={d.notifications ? "badge badge--on" : "badge badge--off"}>
            {d.notifications ? "✓ Enabled" : "✗ Disabled"}
          </span>
        </div>
      </div>
    </div>
  </div>
{/if}

