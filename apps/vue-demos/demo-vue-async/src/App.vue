<script setup lang="ts">
import { ref } from "vue";
import { PathShell } from "@daltonr/pathwrite-vue";
import type { PathData } from "@daltonr/pathwrite-vue";

import { services, createApplicationPath, INITIAL_DATA, type ApplicationData } from "@daltonr/pathwrite-demo-workflow-job-application";
import RoleStep        from "./RoleStep.vue";
import ExperienceStep  from "./ExperienceStep.vue";
import EligibilityStep from "./EligibilityStep.vue";
import CoverLetterStep from "./CoverLetterStep.vue";
import ReviewStep      from "./ReviewStep.vue";

// Path is created once — factory closes over the services singleton.
const applicationPath = createApplicationPath(services);

const completedData = ref<ApplicationData | null>(null);

function handleComplete(data: PathData) {
  completedData.value = data as ApplicationData;
}
function startOver() {
  completedData.value = null;
}
</script>

<template>
  <main class="page">
    <div class="page-header">
      <h1>Job Application</h1>
      <p class="subtitle">
        Demonstrates async <code>canMoveNext</code> guards, async <code>shouldSkip</code>
        with accurate progress, <code>loadingLabel</code>, and service injection via
        <code>usePathContext&lt;TData, TServices&gt;()</code>.
      </p>
    </div>

    <!-- Completed -->
    <section v-if="completedData" class="result-panel success-panel">
      <div class="result-icon">✓</div>
      <h2>Application Submitted</h2>
      <p>Your application for role <strong>{{ completedData.roleId }}</strong> was received.</p>
      <button class="btn-primary" @click="startOver">Submit Another</button>
    </section>

    <!-- Active wizard -->
    <PathShell
      v-else
      :path="applicationPath"
      :services="services"
      :initial-data="INITIAL_DATA"
      complete-label="Submit Application"
      loading-label="Please wait…"
      :hide-cancel="true"
      validation-display="inline"
      @complete="handleComplete"
    >
      <template #role><RoleStep /></template>
      <template #experience><ExperienceStep /></template>
      <template #eligibility><EligibilityStep /></template>
      <template #cover-letter><CoverLetterStep /></template>
      <template #review><ReviewStep /></template>
    </PathShell>
  </main>
</template>
