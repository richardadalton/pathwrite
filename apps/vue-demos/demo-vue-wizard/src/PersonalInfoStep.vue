<script setup lang="ts">
import { computed } from "vue";
import { usePathContext } from "@daltonr/pathwrite-vue";
import type { OnboardingData } from "./onboarding";

const { snapshot, setData } = usePathContext<OnboardingData>();
// snapshot.value is always non-null inside v-if="snapshot" — PathShell only
// renders this component when the path is active. Dot notation works because
// the generic narrows snapshot.data to OnboardingData.
const errors = computed(() =>
  snapshot.value?.hasAttemptedNext ? snapshot.value.fieldErrors : {}
);
</script>

<template>
  <div v-if="snapshot" class="form-body">
    <p class="step-intro">Let's start with the basics — we just need a name and email.</p>

    <div class="row">
      <div class="field" :class="{ 'field--error': errors.firstName }">
        <label for="firstName">First Name <span class="required">*</span></label>
        <input id="firstName" type="text" :value="snapshot.data.firstName" autofocus
          @input="setData('firstName', ($event.target as HTMLInputElement).value.trim())"
          placeholder="Jane" autocomplete="given-name" />
        <span v-if="errors.firstName" class="field-error">{{ errors.firstName }}</span>
      </div>
      <div class="field" :class="{ 'field--error': errors.lastName }">
        <label for="lastName">Last Name <span class="required">*</span></label>
        <input id="lastName" type="text" :value="snapshot.data.lastName"
          @input="setData('lastName', ($event.target as HTMLInputElement).value.trim())"
          placeholder="Smith" autocomplete="family-name" />
        <span v-if="errors.lastName" class="field-error">{{ errors.lastName }}</span>
      </div>
    </div>

    <div class="field" :class="{ 'field--error': errors.email }">
      <label for="email">Email Address <span class="required">*</span></label>
      <input id="email" type="email" :value="snapshot.data.email"
        @input="setData('email', ($event.target as HTMLInputElement).value.trim())"
        placeholder="jane@example.com" autocomplete="email" />
      <span v-if="errors.email" class="field-error">{{ errors.email }}</span>
    </div>
  </div>
</template>
