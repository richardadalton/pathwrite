<script setup lang="ts">
import { computed } from "vue";
import { usePathContext } from "@daltonr/pathwrite-vue";
import type { OnboardingData } from "./onboarding";

const { snapshot, setData } = usePathContext<OnboardingData>();
const errors = computed(() =>
  snapshot.value?.hasAttemptedNext ? snapshot.value.fieldMessages : {}
);

const EXPERIENCE_OPTIONS = [
  { value: "junior", label: "Junior (0–2 years)" },
  { value: "mid",    label: "Mid-level (3–5 years)" },
  { value: "senior", label: "Senior (6–10 years)" },
  { value: "lead",   label: "Lead / Principal (10+ years)" },
];
</script>

<template>
  <div v-if="snapshot" class="form-body">
    <p class="step-intro">Tell us a bit about your professional background.</p>

    <div class="field" :class="{ 'field--error': errors.jobTitle }">
      <label for="jobTitle">Job Title <span class="required">*</span></label>
      <input id="jobTitle" type="text" :value="snapshot.data.jobTitle" autofocus
        @input="setData('jobTitle', ($event.target as HTMLInputElement).value.trim())"
        placeholder="e.g. Frontend Developer" autocomplete="organization-title" />
      <span v-if="errors.jobTitle" class="field-error">{{ errors.jobTitle }}</span>
    </div>

    <div class="field">
      <label for="company">Company <span class="optional">(optional)</span></label>
      <input id="company" type="text" :value="snapshot.data.company"
        @input="setData('company', ($event.target as HTMLInputElement).value.trim())"
        placeholder="e.g. Acme Corp" autocomplete="organization" />
    </div>

    <div class="field" :class="{ 'field--error': errors.experience }">
      <label for="experience">Experience Level <span class="required">*</span></label>
      <select id="experience" :value="snapshot.data.experience"
        @change="setData('experience', ($event.target as HTMLSelectElement).value)">
        <option value="" disabled>Select your level…</option>
        <option v-for="o in EXPERIENCE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
      <span v-if="errors.experience" class="field-error">{{ errors.experience }}</span>
    </div>
  </div>
</template>
