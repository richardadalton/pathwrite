<script setup lang="ts">
import { computed } from "vue";
import { usePathContext } from "@daltonr/pathwrite-vue";
import type { OnboardingData } from "./onboarding";
import type { EmployeeDetails } from "./employee-details";
import { LAPTOP_TYPES } from "./employee-details";

const { snapshot } = usePathContext<OnboardingData>();

const d = computed(() => (snapshot.value.data.details ?? {}) as EmployeeDetails);

function laptopLabel(val: string) {
  return LAPTOP_TYPES.find(l => l.value === val)?.label ?? val;
}

function yesNo(val: string | undefined) {
  return val === "yes" ? "Yes" : "No";
}

const activePerms = computed(() => [
  d.value.permAdmin   === "yes" && "Admin",
  d.value.permDev     === "yes" && "Developer",
  d.value.permHR      === "yes" && "HR",
  d.value.permFinance === "yes" && "Finance",
].filter(Boolean) as string[]);
</script>

<template>
  <div v-if="snapshot" class="form-body">
    <p class="step-intro">
      Review the details below. Click <strong>Complete Onboarding</strong> to submit,
      or use <strong>Previous</strong> to go back and make changes.
    </p>

    <div class="review-section">
      <p class="section-title">Employee</p>
      <div class="review-card">
        <div class="review-row">
          <span class="review-key">Name</span>
          <span>{{ snapshot.data.employeeName }}</span>
        </div>
      </div>
    </div>

    <div class="review-section">
      <p class="section-title">Personal</p>
      <div class="review-card">
        <div class="review-row">
          <span class="review-key">Full Name</span>
          <span>{{ [d.firstName, d.lastName].filter(Boolean).join(' ') || '—' }}</span>
        </div>
        <div v-if="d.dateOfBirth" class="review-row">
          <span class="review-key">Date of Birth</span>
          <span>{{ d.dateOfBirth }}</span>
        </div>
        <div v-if="d.phone" class="review-row">
          <span class="review-key">Phone</span>
          <span>{{ d.phone }}</span>
        </div>
        <div v-if="d.personalEmail" class="review-row">
          <span class="review-key">Personal Email</span>
          <span>{{ d.personalEmail }}</span>
        </div>
      </div>
    </div>

    <div class="review-section">
      <p class="section-title">Department</p>
      <div class="review-card">
        <div class="review-row">
          <span class="review-key">Department</span>
          <span>{{ d.department || '—' }}</span>
        </div>
        <div v-if="d.manager" class="review-row">
          <span class="review-key">Manager</span>
          <span>{{ d.manager }}</span>
        </div>
        <div v-if="d.office" class="review-row">
          <span class="review-key">Office</span>
          <span>{{ d.office }}</span>
        </div>
        <div v-if="d.startDate" class="review-row">
          <span class="review-key">Start Date</span>
          <span>{{ d.startDate }}</span>
        </div>
      </div>
    </div>

    <div class="review-section">
      <p class="section-title">Equipment</p>
      <div class="review-card">
        <div class="review-row">
          <span class="review-key">Laptop</span>
          <span>{{ laptopLabel(d.laptopType ?? 'macbook-pro') }}</span>
        </div>
        <div class="review-row">
          <span class="review-key">Mobile Phone</span>
          <span>{{ yesNo(d.needsPhone) }}</span>
        </div>
        <div class="review-row">
          <span class="review-key">Access Card</span>
          <span>{{ yesNo(d.needsAccessCard) }}</span>
        </div>
        <div v-if="d.otherEquipment" class="review-row">
          <span class="review-key">Other</span>
          <span>{{ d.otherEquipment }}</span>
        </div>
      </div>
    </div>

    <div class="review-section">
      <p class="section-title">Roles &amp; Permissions</p>
      <div class="review-card">
        <div class="review-row">
          <span class="review-key">Job Title</span>
          <span>{{ d.jobTitle || '—' }}</span>
        </div>
        <div class="review-row">
          <span class="review-key">Permissions</span>
          <span>
            <template v-if="activePerms.length > 0">
              <span
                v-for="p in activePerms"
                :key="p"
                class="badge badge--on"
                style="margin-right: 4px"
              >{{ p }}</span>
            </template>
            <span v-else class="badge badge--off">None</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
