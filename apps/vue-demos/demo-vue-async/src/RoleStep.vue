<script setup lang="ts">
import { ref, onMounted } from "vue";
import { usePathContext } from "@daltonr/pathwrite-vue";
import type { ApplicationData } from "@daltonr/pathwrite-demo-workflow-job-application";
import type { ApplicationServices, Role } from "@daltonr/pathwrite-demo-workflow-job-application";

const { snapshot, setData, services } = usePathContext<ApplicationData, ApplicationServices>();
const errors = () => snapshot.value?.hasAttemptedNext ? snapshot.value.fieldErrors : {};

const roles   = ref<Role[]>([]);
const loading = ref(true);

onMounted(() => {
  services.getRoles().then(r => {
    roles.value   = r;
    loading.value = false;
  });
});
</script>

<template>
  <div v-if="snapshot" class="form-body">
    <p class="step-intro">
      Roles are loaded directly from the service inside the step component — not via
      <code>onEnter</code>.
    </p>

    <div class="field" :class="{ 'field--error': errors().roleId }">
      <label for="roleId">Open Position</label>

      <div v-if="loading" class="skeleton-select">Loading roles…</div>
      <select
        v-else
        id="roleId"
        :value="snapshot.data.roleId"
        @change="setData('roleId', ($event.target as HTMLSelectElement).value)"
      >
        <option value="">— select a role —</option>
        <option v-for="r in roles" :key="r.id" :value="r.id">{{ r.label }}</option>
      </select>

      <span v-if="errors().roleId" class="field-error">{{ errors().roleId }}</span>
    </div>

    <p class="hint">
      <strong>What's happening:</strong>
      <code>usePathContext&lt;ApplicationData, ApplicationServices&gt;()</code> returns
      <code>services</code> alongside <code>snapshot</code>. The component calls
      <code>services.getRoles()</code> in <code>onMounted</code> and manages its own loading state.
    </p>
  </div>
</template>
