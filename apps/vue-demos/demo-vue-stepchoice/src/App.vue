<script setup lang="ts">
import { ref } from "vue";
import { PathShell } from "@daltonr/pathwrite-vue";
import type { PathData } from "@daltonr/pathwrite-vue";
import { addressPath, INITIAL_DATA, type AddressData } from "./address-path";
import CountryStep      from "./CountryStep.vue";
import USAddressForm    from "./USAddressForm.vue";
import IrishAddressForm from "./IrishAddressForm.vue";
import ConfirmStep      from "./ConfirmStep.vue";

const isCompleted   = ref(false);
const isCancelled   = ref(false);
const completedData = ref<AddressData | null>(null);

function handleComplete(data: PathData) {
  completedData.value = data as AddressData;
  isCompleted.value   = true;
}
function handleCancel() { isCancelled.value = true; }
function startOver() {
  isCompleted.value   = false;
  isCancelled.value   = false;
  completedData.value = null;
}
</script>

<template>
  <main class="page">
    <div class="page-header">
      <h1>Address Form</h1>
      <p class="subtitle">
        Demonstrates <code>StepChoice</code> — the address step automatically shows
        the right form based on your country selection.
      </p>
    </div>

    <!-- Completed -->
    <section v-if="isCompleted && completedData" class="result-panel success-panel">
      <div class="result-icon">✓</div>
      <h2>Address saved!</h2>
      <div class="summary">
        <div class="summary-section">
          <p class="summary-section__title">Your Address</p>
          <template v-if="completedData.country === 'US'">
            <div class="summary-row">
              <span class="summary-key">Street</span>
              <span>{{ completedData.streetAddress }}{{ completedData.aptUnit ? `, ${completedData.aptUnit}` : "" }}</span>
            </div>
            <div class="summary-row"><span class="summary-key">City</span><span>{{ completedData.city }}</span></div>
            <div class="summary-row"><span class="summary-key">State</span><span>{{ completedData.state }}</span></div>
            <div class="summary-row"><span class="summary-key">ZIP</span><span>{{ completedData.zipCode }}</span></div>
            <div class="summary-row"><span class="summary-key">Country</span><span>United States</span></div>
          </template>
          <template v-else>
            <div class="summary-row"><span class="summary-key">Line 1</span><span>{{ completedData.addressLine1 }}</span></div>
            <div v-if="completedData.addressLine2" class="summary-row"><span class="summary-key">Line 2</span><span>{{ completedData.addressLine2 }}</span></div>
            <div class="summary-row"><span class="summary-key">Town</span><span>{{ completedData.town }}</span></div>
            <div class="summary-row"><span class="summary-key">County</span><span>{{ completedData.county }}</span></div>
            <div v-if="completedData.eircode" class="summary-row"><span class="summary-key">Eircode</span><span>{{ completedData.eircode }}</span></div>
            <div class="summary-row"><span class="summary-key">Country</span><span>Ireland</span></div>
          </template>
        </div>
      </div>
      <button class="btn-primary" @click="startOver">Start Over</button>
    </section>

    <!-- Cancelled -->
    <section v-else-if="isCancelled" class="result-panel cancel-panel">
      <div class="result-icon">✕</div>
      <h2>Cancelled</h2>
      <p>No address was saved.</p>
      <button class="btn-secondary" @click="startOver">Try Again</button>
    </section>

    <!-- Active wizard -->
    <PathShell
      v-else
      :path="addressPath"
      :initial-data="INITIAL_DATA"
      complete-label="Save Address"
      cancel-label="Cancel"
      @complete="handleComplete"
      @cancel="handleCancel"
    >
      <template #country><CountryStep /></template>
      <template #address-us><USAddressForm /></template>
      <template #address-ie><IrishAddressForm /></template>
      <template #confirm><ConfirmStep /></template>
    </PathShell>
  </main>
</template>

<style scoped>
code {
  font-size: 15px;
  background: #eff6ff;
  color: #2563eb;
  padding: 1px 6px;
  border-radius: 4px;
  font-family: "SF Mono", ui-monospace, monospace;
}
</style>
