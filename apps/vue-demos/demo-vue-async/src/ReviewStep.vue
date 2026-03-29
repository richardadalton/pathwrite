<script setup lang="ts">
import { usePathContext } from "@daltonr/pathwrite-vue";
import type { ApplicationData } from "@daltonr/pathwrite-demo-workflow-job-application";

const { snapshot } = usePathContext<ApplicationData>();
</script>

<template>
  <div v-if="snapshot" class="form-body">
    <p class="step-intro">All async checks passed. Review your application before submitting.</p>

    <div class="eligibility-summary">
      <div class="summary-row">
        <span class="summary-key">Role</span>
        <span>{{ snapshot.data.roleId }}</span>
      </div>
      <div class="summary-row">
        <span class="summary-key">Experience</span>
        <span>{{ snapshot.data.yearsExperience }} years</span>
      </div>
      <div class="summary-row">
        <span class="summary-key">Skills</span>
        <span>{{ snapshot.data.skills }}</span>
      </div>
      <div v-if="snapshot.data.coverLetter" class="summary-row">
        <span class="summary-key">Cover Letter</span>
        <span>{{ snapshot.data.coverLetter }}</span>
      </div>
    </div>
  </div>
</template>
