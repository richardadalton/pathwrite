<script setup lang="ts">
import { computed } from "vue";
import { usePathContext } from "@daltonr/pathwrite-vue";
import { AVAILABLE_APPROVERS } from "./approval";
import type { DocumentData, ApproverResult } from "./types";

const { snapshot } = usePathContext<DocumentData>();
const data = computed(() => snapshot.value?.data);

const selectedApprovers = computed(() =>
  AVAILABLE_APPROVERS.filter(a =>
    ((data.value?.approvers ?? []) as string[]).includes(a.id)
  )
);

function getResult(id: string): ApproverResult | null {
  return (data.value?.approvalResults as Record<string, ApproverResult>)?.[id] ?? null;
}

const overallStatus = computed(() => {
  const results = selectedApprovers.value.map(a => getResult(a.id));
  if (results.every(r => r?.decision === "approved")) return "approved";
  if (results.some(r => r?.decision === "rejected"))  return "rejected";
  return "mixed";
});
</script>

<template>
  <div class="form-body">
    <!-- Overall outcome -->
    <div :class="['outcome-banner', `outcome-banner--${overallStatus}`]">
      <span class="outcome-icon">
        {{ overallStatus === 'approved' ? '✓' : overallStatus === 'rejected' ? '✗' : '⚠' }}
      </span>
      <span>
        <template v-if="overallStatus === 'approved'">All approvers approved the document.</template>
        <template v-else-if="overallStatus === 'rejected'">One or more approvers rejected the document.</template>
        <template v-else>Mixed results — review comments below.</template>
      </span>
    </div>

    <!-- Document details -->
    <div class="review-section">
      <p class="section-title">Document</p>
      <div class="review-card">
        <div class="review-row"><span class="review-key">Title</span><span>{{ data?.title }}</span></div>
        <div class="review-row"><span class="review-key">Description</span><span>{{ data?.description }}</span></div>
      </div>
    </div>

    <!-- Approver decisions -->
    <div class="review-section">
      <p class="section-title">Approver Decisions</p>
      <div class="review-card">
        <div
          v-for="approver in selectedApprovers"
          :key="approver.id"
          class="approver-result-row"
        >
          <span class="approver-avatar">{{ approver.name.charAt(0) }}</span>
          <span class="approver-result-name">{{ approver.name }}</span>
          <span :class="['decision-badge', getResult(approver.id)?.decision === 'approved' ? 'decision-badge--approved' : 'decision-badge--rejected']">
            {{ getResult(approver.id)?.decision === 'approved' ? '✓ Approved' : '✗ Rejected' }}
          </span>
          <span v-if="getResult(approver.id)?.comment" class="approver-comment">
            "{{ getResult(approver.id)?.comment }}"
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

