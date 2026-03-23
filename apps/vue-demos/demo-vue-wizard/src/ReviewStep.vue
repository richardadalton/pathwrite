<script setup lang="ts">
import { usePathContext } from "@daltonr/pathwrite-vue";
import { EXPERIENCE_LABELS, THEME_LABELS, type OnboardingData } from "./onboarding";

const { snapshot } = usePathContext<OnboardingData>();
</script>

<template>
  <div v-if="snapshot" class="form-body">
    <p class="step-intro">
      Everything look right? Click <strong>Complete Onboarding</strong> to finish,
      or use <strong>Previous</strong> to make changes.
    </p>

    <div class="review-section">
      <p class="section-title">Personal Info</p>
      <div class="review-card">
        <div class="review-row"><span class="review-key">Full Name</span><span>{{ snapshot.data.firstName }} {{ snapshot.data.lastName }}</span></div>
        <div class="review-row"><span class="review-key">Email</span><span>{{ snapshot.data.email }}</span></div>
      </div>
    </div>

    <div class="review-section">
      <p class="section-title">About You</p>
      <div class="review-card">
        <div class="review-row"><span class="review-key">Job Title</span><span>{{ snapshot.data.jobTitle }}</span></div>
        <div v-if="snapshot.data.company" class="review-row"><span class="review-key">Company</span><span>{{ snapshot.data.company }}</span></div>
        <div class="review-row"><span class="review-key">Experience</span><span>{{ EXPERIENCE_LABELS[snapshot.data.experience] ?? snapshot.data.experience }}</span></div>
      </div>
    </div>

    <div class="review-section">
      <p class="section-title">Preferences</p>
      <div class="review-card">
        <div class="review-row"><span class="review-key">Theme</span><span>{{ THEME_LABELS[snapshot.data.theme] ?? snapshot.data.theme }}</span></div>
        <div class="review-row">
          <span class="review-key">Notifications</span>
          <span :class="snapshot.data.notifications ? 'badge badge--on' : 'badge badge--off'">
            {{ snapshot.data.notifications ? '✓ Enabled' : '✗ Disabled' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

