<script setup lang="ts">
import { usePathContext } from "@daltonr/pathwrite-vue";
import type { EmployeeDetails } from "../employee-details";

/**
 * Tab bar rendered at the top of each inner step component.
 * Calls usePathContext() to access the INNER path's context,
 * then uses goToStep to switch between tabs freely.
 */
const { snapshot, goToStep } = usePathContext<EmployeeDetails>();
</script>

<template>
  <div class="tab-bar">
    <button
      v-for="step in snapshot.steps"
      :key="step.id"
      type="button"
      :class="[
        'tab-btn',
        step.status === 'current'   ? 'tab-btn--active'    : '',
        step.status === 'completed' ? 'tab-btn--completed' : '',
      ].filter(Boolean).join(' ')"
      @click="goToStep(step.id)"
    >
      {{ step.title }}
      <span v-if="step.status === 'completed'" class="tab-check"> ✓</span>
    </button>
  </div>
</template>
