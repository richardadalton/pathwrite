<script setup lang="ts">
import { ref } from "vue";
import { PathShell } from "@daltonr/pathwrite-vue";
import type { PathData } from "@daltonr/pathwrite-vue";
import { onboardingPath, INITIAL_DATA, EXPERIENCE_LABELS, THEME_LABELS, type OnboardingData } from "./onboarding";
import PersonalInfoStep from "./PersonalInfoStep.vue";
import AboutYouStep     from "./AboutYouStep.vue";
import PreferencesStep  from "./PreferencesStep.vue";
import ReviewStep       from "./ReviewStep.vue";

const isCompleted   = ref(false);
const isCancelled   = ref(false);
const completedData = ref<OnboardingData | null>(null);

function handleComplete(data: PathData) {
  completedData.value = data as OnboardingData;
  isCompleted.value   = true;
}
function handleCancel() { isCancelled.value = true; }
function startOver() {
  isCompleted.value   = false;
  isCancelled.value   = false;
  completedData.value = null;
}
</script>

<template>
  <main class="page">
    <div class="page-header">
      <h1>User Onboarding</h1>
      <p class="subtitle">A 4-step wizard with guards, validation, and a final review.</p>
    </div>

    <!-- Completed -->
    <section v-if="isCompleted && completedData" class="result-panel success-panel">
      <div class="result-icon">🎉</div>
      <h2>Welcome aboard!</h2>
      <p>Your profile has been set up, <strong>{{ completedData.firstName }}</strong>.</p>
      <div class="summary">
        <div class="summary-section">
          <p class="summary-section__title">Personal Info</p>
          <div class="summary-row"><span class="summary-key">Name</span><span>{{ completedData.firstName }} {{ completedData.lastName }}</span></div>
          <div class="summary-row"><span class="summary-key">Email</span><span>{{ completedData.email }}</span></div>
        </div>
        <div class="summary-section">
          <p class="summary-section__title">About You</p>
          <div class="summary-row"><span class="summary-key">Job Title</span><span>{{ completedData.jobTitle }}</span></div>
          <div v-if="completedData.company" class="summary-row"><span class="summary-key">Company</span><span>{{ completedData.company }}</span></div>
          <div class="summary-row"><span class="summary-key">Experience</span><span>{{ EXPERIENCE_LABELS[completedData.experience] ?? completedData.experience }}</span></div>
        </div>
        <div class="summary-section">
          <p class="summary-section__title">Preferences</p>
          <div class="summary-row"><span class="summary-key">Theme</span><span>{{ THEME_LABELS[completedData.theme] ?? completedData.theme }}</span></div>
          <div class="summary-row"><span class="summary-key">Notifications</span><span>{{ completedData.notifications ? 'Enabled' : 'Disabled' }}</span></div>
        </div>
      </div>
      <button class="btn-primary" @click="startOver">Start Over</button>
    </section>

    <!-- Cancelled -->
    <section v-if="isCancelled" class="result-panel cancel-panel">
      <div class="result-icon">✖</div>
      <h2>Onboarding Cancelled</h2>
      <p>Your profile was not saved.</p>
      <button class="btn-secondary" @click="startOver">Try Again</button>
    </section>

    <!-- Active wizard -->
    <PathShell
      v-if="!isCompleted && !isCancelled"
      :path="onboardingPath"
      :initial-data="INITIAL_DATA"
      complete-label="Complete Onboarding"
      cancel-label="Cancel"
      validation-display="inline"
    >
      <template #personal-info><PersonalInfoStep /></template>
      <template #about-you><AboutYouStep /></template>
      <template #preferences><PreferencesStep /></template>
      <template #review><ReviewStep /></template>
    </PathShell>
  </main>
</template>

