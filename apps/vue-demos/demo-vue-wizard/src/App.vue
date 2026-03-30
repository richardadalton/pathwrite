<script setup lang="ts">
import { ref } from "vue";
import { PathShell } from "@daltonr/pathwrite-vue";
import { onboardingPath, INITIAL_DATA } from "./onboarding";
import PersonalInfoStep  from "./PersonalInfoStep.vue";
import AboutYouStep      from "./AboutYouStep.vue";
import PreferencesStep   from "./PreferencesStep.vue";
import ReviewStep        from "./ReviewStep.vue";
import CompletionPanel   from "./CompletionPanel.vue";

const isCancelled = ref(false);

function handleCancel() { isCancelled.value = true; }
</script>

<template>
  <main class="page">
    <div class="page-header">
      <h1>User Onboarding</h1>
      <p class="subtitle">A 4-step wizard with guards, validation, and a final review.</p>
    </div>

    <!-- Cancelled -->
    <section v-if="isCancelled" class="result-panel cancel-panel">
      <div class="result-icon">✖</div>
      <h2>Onboarding Cancelled</h2>
      <p>Your profile was not saved.</p>
      <button class="btn-secondary" @click="isCancelled = false">Try Again</button>
    </section>

    <!-- Wizard — stays mounted; shows CompletionPanel via #completion slot when path finishes -->
    <PathShell
      v-if="!isCancelled"
      :path="onboardingPath"
      :initial-data="INITIAL_DATA"
      complete-label="Complete Onboarding"
      cancel-label="Cancel"
      validation-display="inline"
      @cancel="handleCancel"
    >
      <template #completion="{ snapshot }">
        <CompletionPanel :snapshot="snapshot" />
      </template>
      <template #personal-info><PersonalInfoStep /></template>
      <template #about-you><AboutYouStep /></template>
      <template #preferences><PreferencesStep /></template>
      <template #review><ReviewStep /></template>
    </PathShell>
  </main>
</template>
