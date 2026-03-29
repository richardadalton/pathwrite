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
      This step uses an async <code>shouldSkip</code>. Selecting
      <strong>Software Engineer</strong> or <strong>Data Scientist</strong> on the first step
      routes here; other roles skip straight to Review. Notice how the progress bar step count
      updates once the skip resolves.
    </p>

    <div class="field" :class="{ 'field--error': errors.coverLetter }">
      <label for="coverLetter">Cover Letter</label>
      <textarea
        id="coverLetter"
        rows="5"
        :value="snapshot.data.coverLetter"
        @input="setData('coverLetter', ($event.target as HTMLTextAreaElement).value)"
        placeholder="Tell us why you're a great fit for this role…"
      />
      <span v-if="errors.coverLetter" class="field-error">{{ errors.coverLetter }}</span>
    </div>

    <p class="hint">
      <strong>What's happening:</strong> <code>shouldSkip</code> called
      <code>services.requiresCoverLetter(roleId)</code> asynchronously. Before that resolved,
      <code>snapshot.stepCount</code> included this step optimistically. Once navigation walked
      past it, the engine cached the result in <code>resolvedSkips</code> and the progress bar
      reflects the true visible count.
    </p>
  </div>
</template>
