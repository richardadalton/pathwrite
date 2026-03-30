<script setup lang="ts">
import { computed } from "vue";
import { usePathContext } from "@daltonr/pathwrite-vue";
import type { OnboardingData } from "./onboarding";

const { snapshot, setData } = usePathContext<OnboardingData>();
const errors = computed(() =>
  snapshot.value.hasAttemptedNext ? snapshot.value.fieldErrors : {}
);
</script>

<template>
  <div v-if="snapshot" class="form-body">
    <p class="step-intro">
      Enter the new employee's full name to begin their onboarding record.
    </p>
    <div class="field" :class="{ 'field--error': errors.employeeName }">
      <label for="employeeName">Full Name <span class="required">*</span></label>
      <input
        id="employeeName"
        type="text"
        :value="snapshot.data.employeeName"
        autofocus
        @input="setData('employeeName', ($event.target as HTMLInputElement).value)"
        placeholder="e.g. Jane Smith"
        autocomplete="name"
      />
      <span v-if="errors.employeeName" class="field-error">{{ errors.employeeName }}</span>
    </div>
  </div>
</template>
