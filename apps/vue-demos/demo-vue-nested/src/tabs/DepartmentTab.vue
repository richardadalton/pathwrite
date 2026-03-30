<script setup lang="ts">
import { computed } from "vue";
import { usePathContext } from "@daltonr/pathwrite-vue";
import type { EmployeeDetails } from "../employee-details";
import { DEPARTMENTS, OFFICES } from "../employee-details";
import TabBar from "./TabBar.vue";

const { snapshot, setData } = usePathContext<EmployeeDetails>();

const showErrors = computed(() => snapshot.value.hasAttemptedNext || snapshot.value.hasValidated);
const errors = computed(() => showErrors.value ? snapshot.value.fieldErrors : {});
</script>

<template>
  <div class="tab-content">
    <TabBar />
    <div class="form-body">
      <div class="field" :class="{ 'field--error': errors.department }">
        <label for="department">Department <span class="required">*</span></label>
        <select
          id="department"
          :value="snapshot.data.department ?? ''"
          @change="setData('department', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">Select a department…</option>
          <option v-for="d in DEPARTMENTS" :key="d" :value="d">{{ d }}</option>
        </select>
        <span v-if="errors.department" class="field-error">{{ errors.department }}</span>
      </div>

      <div class="field">
        <label for="manager">Reporting Manager <span class="optional">(optional)</span></label>
        <input
          id="manager" type="text"
          :value="snapshot.data.manager ?? ''"
          @input="setData('manager', ($event.target as HTMLInputElement).value)"
          placeholder="e.g. John Murphy"
        />
      </div>

      <div class="field">
        <label for="office">Office Location <span class="optional">(optional)</span></label>
        <select
          id="office"
          :value="snapshot.data.office ?? ''"
          @change="setData('office', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">Select an office…</option>
          <option v-for="o in OFFICES" :key="o" :value="o">{{ o }}</option>
        </select>
      </div>

      <div class="field">
        <label for="startDate">Start Date <span class="optional">(optional)</span></label>
        <input
          id="startDate" type="date"
          :value="snapshot.data.startDate ?? ''"
          @input="setData('startDate', ($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>
  </div>
</template>
