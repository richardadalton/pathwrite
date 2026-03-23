<script setup lang="ts">
import { computed } from "vue";
import { usePathContext } from "@daltonr/pathwrite-vue";
import type { ApprovalData } from "./types";

const { snapshot, setData } = usePathContext<ApprovalData>();
const data      = computed(() => snapshot.value?.data);
const errors    = computed(() => snapshot.value?.fieldMessages ?? {});
const attempted  = computed(() => snapshot.value?.hasAttemptedNext ?? false);
</script>

<template>
  <div class="form-body">
    <p class="step-intro">
      You are reviewing <strong>{{ data?.documentTitle }}</strong> as <strong>{{ data?.approverName }}</strong>.
    </p>

    <!-- Approve / Reject -->
    <div>
      <p class="pref-label">Your Decision <span class="required">*</span></p>
      <div class="radio-group">
        <label :class="['radio-option', data?.decision === 'approved' ? 'radio-option--approved' : '']">
          <input
            type="radio"
            name="decision"
            value="approved"
            :checked="data?.decision === 'approved'"
            @change="setData('decision', 'approved')"
          />
          <span class="radio-option-label">✓ Approve</span>
          <span class="radio-option-desc">The document is ready to proceed.</span>
        </label>
        <label :class="['radio-option', data?.decision === 'rejected' ? 'radio-option--rejected' : '']">
          <input
            type="radio"
            name="decision"
            value="rejected"
            :checked="data?.decision === 'rejected'"
            @change="setData('decision', 'rejected')"
          />
          <span class="radio-option-label">✗ Reject</span>
          <span class="radio-option-desc">Changes are required before this can proceed.</span>
        </label>
      </div>
      <span v-if="attempted && errors.decision" class="field-error">{{ errors.decision }}</span>
    </div>

    <!-- Comment -->
    <div class="field">
      <label for="comment">Comment <span class="optional">(optional)</span></label>
      <textarea
        id="comment"
        :value="data?.comment"
        @input="setData('comment', ($event.target as HTMLTextAreaElement).value)"
        placeholder="Add any notes or feedback for the document author..."
        rows="3"
      />
    </div>
  </div>
</template>

