<script setup lang="ts">
import { computed } from "vue";
import { usePathContext } from "@daltonr/pathwrite-vue";
import { approvalSubPath, AVAILABLE_APPROVERS } from "./approval";
import type { DocumentData, ApprovalData, ApproverResult } from "./types";

const { snapshot, startSubPath } = usePathContext<DocumentData>();
const data     = computed(() => snapshot.value?.data);
const errors   = computed(() => snapshot.value?.fieldMessages ?? {});
const attempted = computed(() => snapshot.value?.hasAttemptedNext ?? false);

const selectedApprovers = computed(() =>
  AVAILABLE_APPROVERS.filter(a =>
    ((data.value?.approvers ?? []) as string[]).includes(a.id)
  )
);

function getResult(approverId: string): ApproverResult | null {
  return (data.value?.approvalResults as Record<string, ApproverResult>)?.[approverId] ?? null;
}

async function launchReview(approverId: string, approverName: string) {
  const initialData: ApprovalData = {
    approverId,
    approverName,
    documentTitle:       data.value?.title       ?? "",
    documentDescription: data.value?.description ?? "",
    decision: "",
    comment:  "",
  };
  // meta: { approverId } is passed back to onSubPathComplete so the parent
  // knows which approver just finished without embedding it in the sub-path data.
  await startSubPath(approvalSubPath, initialData, { approverId });
}

const allDone = computed(() =>
  selectedApprovers.value.length > 0 &&
  selectedApprovers.value.every(a => !!getResult(a.id)?.decision)
);
</script>

<template>
  <div class="form-body">
    <!-- Document summary -->
    <div class="doc-summary-card">
      <p class="doc-summary-label">Document</p>
      <p class="doc-summary-title">{{ data?.title }}</p>
      <p class="doc-summary-desc">{{ data?.description }}</p>
    </div>

    <!-- Approver list with status and Review buttons -->
    <div>
      <p class="pref-label">Approvers</p>
      <div class="approver-review-list">
        <div
          v-for="approver in selectedApprovers"
          :key="approver.id"
          class="approver-review-item"
        >
          <span class="approver-avatar">{{ approver.name.charAt(0) }}</span>
          <span class="approver-review-name">{{ approver.name }}</span>

          <template v-if="getResult(approver.id)">
            <span :class="['decision-badge', getResult(approver.id)!.decision === 'approved' ? 'decision-badge--approved' : 'decision-badge--rejected']">
              {{ getResult(approver.id)!.decision === 'approved' ? '✓ Approved' : '✗ Rejected' }}
            </span>
          </template>
          <template v-else>
            <button
              type="button"
              class="btn-review"
              :disabled="snapshot?.isNavigating"
              @click="launchReview(approver.id, approver.name)"
            >
              Review →
            </button>
          </template>
        </div>
      </div>
    </div>

    <!-- Gate message -->
    <p v-if="attempted && errors._" class="gate-message">
      ⏳ {{ errors._ }}
    </p>
    <p v-if="allDone" class="gate-message gate-message--done">
      ✓ All approvers have responded. Click Next to continue.
    </p>
  </div>
</template>

