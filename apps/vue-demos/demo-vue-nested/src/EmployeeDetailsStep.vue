<script setup lang="ts">
import { usePathContext, PathShell } from "@daltonr/pathwrite-vue";
import { employeeDetailsPath, DETAILS_INITIAL } from "./employee-details";
import type { OnboardingData } from "./onboarding";
import PersonalTab    from "./tabs/PersonalTab.vue";
import DepartmentTab  from "./tabs/DepartmentTab.vue";
import EquipmentTab   from "./tabs/EquipmentTab.vue";
import RolesTab       from "./tabs/RolesTab.vue";

const { snapshot: outerSnapshot } = usePathContext<OnboardingData>();
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
      :initial-data="DETAILS_INITIAL"
      restore-key="details"
      :hide-progress="true"
      :hide-cancel="true"
      :hide-footer="true"
      :validate-when="outerSnapshot.hasAttemptedNext"
      validation-display="inline"
    >
      <template #personal><PersonalTab /></template>
      <template #department><DepartmentTab /></template>
      <template #equipment><EquipmentTab /></template>
      <template #roles><RolesTab /></template>
    </PathShell>
  </div>
</template>
