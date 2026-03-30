<script setup lang="ts">
import { ref, computed } from "vue";
import { PathShell } from "@daltonr/pathwrite-vue";
import type { PathData } from "@daltonr/pathwrite-vue";
import { employeeOnboardingPath, ONBOARDING_INITIAL } from "./onboarding";
import type { OnboardingData } from "./onboarding";
import type { EmployeeDetails } from "./employee-details";
import { LAPTOP_TYPES } from "./employee-details";
import EnterNameStep       from "./EnterNameStep.vue";
import EmployeeDetailsStep from "./EmployeeDetailsStep.vue";
import ConfirmStep         from "./ConfirmStep.vue";

const isCompleted   = ref(false);
const isCancelled   = ref(false);
const completedData = ref<OnboardingData | null>(null);

function handleComplete(data: PathData) {
  completedData.value = data as OnboardingData;
  isCompleted.value   = true;
}
function handleCancel() { isCancelled.value = true; }
function startOver() {
  isCompleted.value   = false;
  isCancelled.value   = false;
  completedData.value = null;
}

function yesNo(val: string | undefined) {
  return val === "yes" ? "Yes" : "No";
}

const completedDetails = computed(() =>
  completedData.value ? (completedData.value.details ?? {}) as EmployeeDetails : null
);

const laptopLabel = computed(() => {
  const d = completedDetails.value;
  return d ? (LAPTOP_TYPES.find(l => l.value === d.laptopType)?.label ?? d.laptopType) : "";
});

const activePerms = computed(() => {
  const d = completedDetails.value;
  if (!d) return [];
  return [
    d.permAdmin   === "yes" && "Admin",
    d.permDev     === "yes" && "Developer",
    d.permHR      === "yes" && "HR",
    d.permFinance === "yes" && "Finance",
  ].filter(Boolean) as string[];
});
</script>

<template>
  <main class="page">
    <div class="page-header">
      <h1>Employee Onboarding</h1>
      <p class="subtitle">
        Nested PathShell demo — an independent Employee Details path
        runs inside Step 2. Data syncs to the parent via <code>@event</code>;
        the parent's <code>fieldErrors</code> guard validates the inner data.
      </p>
    </div>

    <!-- Completed -->
    <section v-if="isCompleted && completedData && completedDetails" class="result-panel success-panel">
      <div class="result-icon">🎉</div>
      <h2>Onboarding Complete!</h2>
      <p><strong>{{ completedData.employeeName }}</strong> has been successfully onboarded.</p>
      <div class="summary">
        <div class="summary-section">
          <p class="summary-section__title">Personal</p>
          <div class="summary-row"><span class="summary-key">Name</span><span>{{ completedDetails.firstName }} {{ completedDetails.lastName }}</span></div>
          <div v-if="completedDetails.phone" class="summary-row"><span class="summary-key">Phone</span><span>{{ completedDetails.phone }}</span></div>
        </div>
        <div class="summary-section">
          <p class="summary-section__title">Department</p>
          <div class="summary-row"><span class="summary-key">Department</span><span>{{ completedDetails.department }}</span></div>
          <div v-if="completedDetails.manager" class="summary-row"><span class="summary-key">Manager</span><span>{{ completedDetails.manager }}</span></div>
          <div v-if="completedDetails.office" class="summary-row"><span class="summary-key">Office</span><span>{{ completedDetails.office }}</span></div>
        </div>
        <div class="summary-section">
          <p class="summary-section__title">Equipment &amp; Roles</p>
          <div class="summary-row"><span class="summary-key">Laptop</span><span>{{ laptopLabel }}</span></div>
          <div class="summary-row"><span class="summary-key">Phone</span><span>{{ yesNo(completedDetails.needsPhone) }}</span></div>
          <div class="summary-row"><span class="summary-key">Job Title</span><span>{{ completedDetails.jobTitle }}</span></div>
          <div class="summary-row">
            <span class="summary-key">Permissions</span>
            <span>{{ activePerms.length > 0 ? activePerms.join(', ') : 'None' }}</span>
          </div>
        </div>
      </div>
      <button class="btn-primary" @click="startOver">Onboard Another</button>
    </section>

    <!-- Cancelled -->
    <section v-if="isCancelled" class="result-panel cancel-panel">
      <div class="result-icon">✖</div>
      <h2>Onboarding Cancelled</h2>
      <p>No record was created.</p>
      <button class="btn-secondary" @click="startOver">Try Again</button>
    </section>

    <!-- Active wizard -->
    <PathShell
      v-if="!isCompleted && !isCancelled"
      :path="employeeOnboardingPath"
      :initial-data="ONBOARDING_INITIAL"
      complete-label="Complete Onboarding"
      cancel-label="Cancel"
      validation-display="inline"
      @complete="handleComplete"
      @cancel="handleCancel"
    >
      <template #enter-name><EnterNameStep /></template>
      <template #employee-details><EmployeeDetailsStep /></template>
      <template #confirm><ConfirmStep /></template>
    </PathShell>
  </main>
</template>
