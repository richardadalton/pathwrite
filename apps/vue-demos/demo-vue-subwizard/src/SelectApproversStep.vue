<script setup lang="ts">
import { computed } from "vue";
import { usePathContext } from "@daltonr/pathwrite-vue";
import { AVAILABLE_APPROVERS } from "./approval";
import type { DocumentData } from "./types";

const { snapshot, setData } = usePathContext<DocumentData>();
const data     = computed(() => snapshot.value?.data);
const errors   = computed(() => snapshot.value?.fieldMessages ?? {});
const attempted = computed(() => snapshot.value?.hasAttemptedNext ?? false);

function toggleApprover(id: string) {
  const current = (data.value?.approvers ?? []) as string[];
  const updated  = current.includes(id)
    ? current.filter(a => a !== id)
    : [...current, id];
  setData("approvers", updated);
}

function isSelected(id: string) {
  return ((data.value?.approvers ?? []) as string[]).includes(id);
}
</script>

<template>
  <div class="form-body">
    <p class="step-intro">Choose who needs to approve this document. All selected approvers must review before the workflow can proceed.</p>

    <div>
      <p class="pref-label">Available Approvers</p>
      <div class="approver-select-list">
        <label
          v-for="approver in AVAILABLE_APPROVERS"
          :key="approver.id"
          :class="['approver-select-item', isSelected(approver.id) ? 'approver-select-item--selected' : '']"
        >
          <input
            type="checkbox"
            :checked="isSelected(approver.id)"
            @change="toggleApprover(approver.id)"
          />
          <span class="approver-avatar">{{ approver.name.charAt(0) }}</span>
          <span class="approver-name">{{ approver.name }}</span>
        </label>
      </div>
      <span v-if="attempted && errors.approvers" class="field-error">{{ errors.approvers }}</span>
    </div>

    <p v-if="data?.approvers?.length" class="selection-count">
      {{ (data.approvers as string[]).length }} approver{{ (data.approvers as string[]).length !== 1 ? 's' : '' }} selected
    </p>
  </div>
</template>

