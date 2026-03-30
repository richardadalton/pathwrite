<script setup lang="ts">
import { computed } from "vue";
import { usePathContext } from "@daltonr/pathwrite-vue";
import type { EmployeeDetails } from "../employee-details";
import TabBar from "./TabBar.vue";

const PERMISSIONS = [
  { key: "permAdmin",   label: "Admin Access",    desc: "Full system administration" },
  { key: "permDev",     label: "Developer Access", desc: "Code repositories & CI/CD pipelines" },
  { key: "permHR",      label: "HR Access",        desc: "Personnel records & payroll" },
  { key: "permFinance", label: "Finance Access",   desc: "Accounting & expense systems" },
] as const;

const { snapshot, setData } = usePathContext<EmployeeDetails>();

const showErrors = computed(() => snapshot.value.hasAttemptedNext || snapshot.value.hasValidated);
const errors = computed(() => showErrors.value ? snapshot.value.fieldErrors : {});
</script>

<template>
  <div class="tab-content">
    <TabBar />
    <div class="form-body">
      <div class="field" :class="{ 'field--error': errors.jobTitle }">
        <label for="jobTitle">Job Title <span class="required">*</span></label>
        <input
          id="jobTitle" type="text"
          :value="snapshot.data.jobTitle ?? ''"
          @input="setData('jobTitle', ($event.target as HTMLInputElement).value)"
          placeholder="e.g. Senior Software Engineer"
        />
        <span v-if="errors.jobTitle" class="field-error">{{ errors.jobTitle }}</span>
      </div>

      <div class="perm-section">
        <p class="pref-label">System Permissions</p>
        <div class="perm-list">
          <label v-for="perm in PERMISSIONS" :key="perm.key" class="perm-option">
            <div class="perm-text">
              <span class="perm-label">{{ perm.label }}</span>
              <span class="perm-desc">{{ perm.desc }}</span>
            </div>
            <div class="toggle">
              <input
                type="checkbox"
                :checked="(snapshot.data[perm.key] ?? 'no') === 'yes'"
                @change="setData(perm.key, ($event.target as HTMLInputElement).checked ? 'yes' : 'no')"
              />
              <span class="toggle-track" />
              <span class="toggle-thumb" />
            </div>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>
