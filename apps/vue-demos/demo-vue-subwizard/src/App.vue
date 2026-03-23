<script setup lang="ts">
import { ref } from "vue";
import { PathShell } from "@daltonr/pathwrite-vue";
import type { PathData } from "@daltonr/pathwrite-vue";
import { approvalWorkflowPath, INITIAL_DATA, AVAILABLE_APPROVERS } from "./approval";
import type { DocumentData, ApproverResult } from "./types";
import CreateDocumentStep  from "./CreateDocumentStep.vue";
import SelectApproversStep from "./SelectApproversStep.vue";
import ApprovalReviewStep  from "./ApprovalReviewStep.vue";
import SummaryStep         from "./SummaryStep.vue";
import ViewDocumentStep    from "./ViewDocumentStep.vue";
import DecisionStep        from "./DecisionStep.vue";

const isCompleted    = ref(false);
const isCancelled    = ref(false);
const completedData  = ref<DocumentData | null>(null);

function handleComplete(data: PathData) {
  completedData.value = data as DocumentData;
  isCompleted.value   = true;
}
function handleCancel() { isCancelled.value = true; }
function startOver() {
  isCompleted.value  = false;
  isCancelled.value  = false;
  completedData.value = null;
}

function getApproverName(id: string) {
  return AVAILABLE_APPROVERS.find(a => a.id === id)?.name ?? id;
}

function getResult(data: DocumentData, id: string): ApproverResult | null {
  return (data.approvalResults as Record<string, ApproverResult>)?.[id] ?? null;
}

const overallStatus = (data: DocumentData) => {
  const ids = data.approvers as string[];
  if (ids.every(id => getResult(data, id)?.decision === "approved")) return "approved";
  if (ids.some(id  => getResult(data, id)?.decision === "rejected"))  return "rejected";
  return "mixed";
};
</script>

<template>
  <main class="page">
    <div class="page-header">
      <h1>Approval Workflow</h1>
      <p class="subtitle">Subwizard demo — dynamically launch a per-approver review subwizard gated by all approvers completing.</p>
    </div>

    <!-- Completed -->
    <section v-if="isCompleted && completedData" class="result-panel" :class="overallStatus(completedData) === 'approved' ? 'success-panel' : 'reject-panel'">
      <div class="result-icon">{{ overallStatus(completedData) === 'approved' ? '✅' : '❌' }}</div>
      <h2>{{ overallStatus(completedData) === 'approved' ? 'Document Approved!' : 'Document Rejected' }}</h2>
      <p>
        <template v-if="overallStatus(completedData) === 'approved'">All approvers signed off on <strong>{{ completedData.title }}</strong>.</template>
        <template v-else>One or more approvers rejected <strong>{{ completedData.title }}</strong>.</template>
      </p>
      <div class="summary">
        <div class="summary-section">
          <p class="summary-section__title">Document</p>
          <div class="summary-row"><span class="summary-key">Title</span><span>{{ completedData.title }}</span></div>
          <div class="summary-row"><span class="summary-key">Description</span><span>{{ completedData.description }}</span></div>
        </div>
        <div class="summary-section">
          <p class="summary-section__title">Decisions</p>
          <div v-for="id in (completedData.approvers as string[])" :key="id" class="summary-row">
            <span class="summary-key">{{ getApproverName(id) }}</span>
            <span :class="getResult(completedData, id)?.decision === 'approved' ? 'text-approved' : 'text-rejected'">
              {{ getResult(completedData, id)?.decision === 'approved' ? '✓ Approved' : '✗ Rejected' }}
              <em v-if="getResult(completedData, id)?.comment"> — {{ getResult(completedData, id)?.comment }}</em>
            </span>
          </div>
        </div>
      </div>
      <button class="btn-primary" @click="startOver">Start Over</button>
    </section>

    <!-- Cancelled -->
    <section v-else-if="isCancelled" class="result-panel cancel-panel">
      <div class="result-icon">✖</div>
      <h2>Workflow Cancelled</h2>
      <p>No approvals were recorded.</p>
      <button class="btn-secondary" @click="startOver">Try Again</button>
    </section>

    <!-- Active wizard -->
    <!--
      A single PathShell handles BOTH the main workflow steps AND the
      approval subwizard steps. When startSubPath() is called by
      ApprovalReviewStep, the engine switches active path. PathShell
      re-renders automatically using the new stepId to pick the right slot.
    -->
    <PathShell
      v-else
      :path="approvalWorkflowPath"
      :initial-data="INITIAL_DATA"
      complete-label="Finalise"
      cancel-label="Cancel"
      @complete="handleComplete"
      @cancel="handleCancel"
    >
      <!-- Main wizard steps -->
      <template #create-document><CreateDocumentStep /></template>
      <template #select-approvers><SelectApproversStep /></template>
      <template #approval-review><ApprovalReviewStep /></template>
      <template #summary><SummaryStep /></template>

      <!-- Approval subwizard steps — rendered when a subwizard is active -->
      <template #view-document><ViewDocumentStep /></template>
      <template #decision><DecisionStep /></template>
    </PathShell>
  </main>
</template>

