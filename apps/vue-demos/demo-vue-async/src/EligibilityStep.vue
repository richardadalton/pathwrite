<script setup lang="ts">
import { computed } from "vue";
import { usePathContext } from "@daltonr/pathwrite-vue";
import type { ApplicationData } from "@daltonr/pathwrite-demo-workflow-job-application";

const { snapshot } = usePathContext<ApplicationData>();

// validationDisplay="inline" suppresses the shell's blockingError rendering —
// we render it here instead.
const blockingError = computed(() =>
  snapshot.value?.hasAttemptedNext ? snapshot.value.blockingError : null
);
const guardRunning = computed(() => snapshot.value?.status === "validating");
</script>

<template>
  <div v-if="snapshot" class="form-body">
    <p class="step-intro">
      Clicking <strong>Next</strong> runs an async eligibility check against our API.
      The check takes ~900ms — watch the spinner on the button.
    </p>

    <div class="eligibility-summary">
      <div class="summary-row">
        <span class="summary-key">Role</span>
        <span>{{ snapshot.data.roleId || "—" }}</span>
      </div>
      <div class="summary-row">
        <span class="summary-key">Experience</span>
        <span>{{ snapshot.data.yearsExperience ? `${snapshot.data.yearsExperience} years` : "—" }}</span>
      </div>
      <div class="summary-row">
        <span class="summary-key">Skills</span>
        <span>{{ snapshot.data.skills || "—" }}</span>
      </div>
    </div>

    <p v-if="blockingError" class="field-error" style="margin-top: 12px">{{ blockingError }}</p>

    <p v-if="!guardRunning" class="hint">
      <strong>What's happening:</strong> <code>canMoveNext</code> is async — it calls
      <code>services.checkEligibility()</code> and the engine awaits the result before deciding
      whether to advance. While it runs, <code>snapshot.status === "validating"</code>, and the
      shell shows a CSS spinner on the Next button. If blocked, the guard returns
      <code>{ allowed: false, reason }</code> and we render <code>snapshot.blockingError</code>
      here (since <code>validationDisplay="inline"</code> suppresses the shell's own rendering).
    </p>
  </div>
</template>
