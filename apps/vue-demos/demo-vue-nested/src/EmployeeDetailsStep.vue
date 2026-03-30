<script setup lang="ts">
import { computed } from "vue";
import { PathShell, usePathContext } from "@daltonr/pathwrite-vue";
import type { PathEvent, PathSnapshot } from "@daltonr/pathwrite-vue";
import { employeeDetailsPath, DETAILS_INITIAL } from "./employee-details";
import type { EmployeeDetails } from "./employee-details";
import type { OnboardingData } from "./onboarding";
import PersonalTab    from "./tabs/PersonalTab.vue";
import DepartmentTab  from "./tabs/DepartmentTab.vue";
import EquipmentTab   from "./tabs/EquipmentTab.vue";
import RolesTab       from "./tabs/RolesTab.vue";

const { snapshot: outerSnapshot, setData } = usePathContext<OnboardingData>();

const initialDetails = computed((): EmployeeDetails => ({
  ...DETAILS_INITIAL,
  ...(outerSnapshot.value.data.details as Partial<EmployeeDetails> ?? {}),
}));

function handleInnerEvent(event: PathEvent) {
  if (event.type === "stateChanged") {
    setData("details", (event.snapshot as PathSnapshot<EmployeeDetails>).data);
  }
}
</script>

<template>
  <div v-if="outerSnapshot" class="nested-shell-wrapper">
    <p class="step-intro">
      Fill in details for <strong>{{ outerSnapshot.data.employeeName }}</strong> using the tabs below.
      Switch between tabs freely — data is saved as you type.
      First name, last name, department, and job title are required before proceeding.
    </p>

    <PathShell
      :path="employeeDetailsPath"
      :initial-data="initialDetails"
      :hide-progress="true"
      :hide-cancel="true"
      :hide-footer="true"
      :validate-when="outerSnapshot.hasAttemptedNext"
      validation-display="inline"
      @event="handleInnerEvent"
    >
      <template #personal><PersonalTab /></template>
      <template #department><DepartmentTab /></template>
      <template #equipment><EquipmentTab /></template>
      <template #roles><RolesTab /></template>
    </PathShell>
  </div>
</template>
