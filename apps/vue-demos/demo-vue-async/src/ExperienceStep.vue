<script setup lang="ts">
import { computed } from "vue";
import { usePathContext } from "@daltonr/pathwrite-vue";
import type { ApplicationData } from "@daltonr/pathwrite-demo-workflow-job-application";

const { snapshot, setData } = usePathContext<ApplicationData>();
const errors = computed(() => snapshot.value?.hasAttemptedNext ? snapshot.value.fieldErrors : {});
</script>

<template>
  <div v-if="snapshot" class="form-body">
    <p class="step-intro">
      Tell us about your background. The next step will run an async eligibility
      check — try entering <strong>less than 2 years</strong> to see the guard block navigation.
    </p>

    <div class="field" :class="{ 'field--error': errors.yearsExperience }">
      <label for="years">Years of Relevant Experience</label>
      <input
        id="years"
        type="number"
        min="0"
        step="1"
        :value="snapshot.data.yearsExperience"
        @input="setData('yearsExperience', ($event.target as HTMLInputElement).value)"
        placeholder="e.g. 3"
        autofocus
      />
      <span v-if="errors.yearsExperience" class="field-error">{{ errors.yearsExperience }}</span>
    </div>

    <div class="field" :class="{ 'field--error': errors.skills }">
      <label for="skills">Key Skills</label>
      <input
        id="skills"
        type="text"
        :value="snapshot.data.skills"
        @input="setData('skills', ($event.target as HTMLInputElement).value)"
        placeholder="e.g. TypeScript, React, Node.js"
      />
      <span v-if="errors.skills" class="field-error">{{ errors.skills }}</span>
    </div>
  </div>
</template>
