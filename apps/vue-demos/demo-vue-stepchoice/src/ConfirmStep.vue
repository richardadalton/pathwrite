<script setup lang="ts">
import { computed } from "vue";
import { usePathContext } from "@daltonr/pathwrite-vue";
import { US_STATES, type AddressData } from "./address-path";

const { snapshot } = usePathContext<AddressData>();
const data = computed(() => snapshot.value!.data);
const isUS = computed(() => data.value.country === "US");
const stateName = computed(() =>
  US_STATES.find(s => s.code === data.value.state)?.name ?? data.value.state
);
</script>

<template>
  <div v-if="snapshot" class="form-body">
    <p class="step-intro">Please review your address before submitting.</p>

    <div class="confirm-card">
      <div class="confirm-section">
        <p class="confirm-label">Country</p>
        <p class="confirm-value">{{ isUS ? "🇺🇸 United States" : "🇮🇪 Ireland" }}</p>
      </div>

      <div class="confirm-divider" />

      <div class="confirm-section">
        <p class="confirm-label">Address</p>
        <div v-if="isUS" class="confirm-address">
          <p>{{ data.streetAddress }}{{ data.aptUnit ? `, ${data.aptUnit}` : "" }}</p>
          <p>{{ data.city }}, {{ stateName }} {{ data.zipCode }}</p>
          <p>United States</p>
        </div>
        <div v-else class="confirm-address">
          <p>{{ data.addressLine1 }}</p>
          <p v-if="data.addressLine2">{{ data.addressLine2 }}</p>
          <p>{{ data.town }}</p>
          <p>Co. {{ data.county }}{{ data.eircode ? `, ${data.eircode}` : "" }}</p>
          <p>Ireland</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.confirm-card {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
}
.confirm-section {
  padding: 16px 20px;
}
.confirm-label {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #2563eb;
}
.confirm-value {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  color: #1f2937;
}
.confirm-address {
  margin: 0;
  font-size: 14px;
  color: #374151;
  line-height: 1.7;
}
.confirm-address p {
  margin: 0;
}
.confirm-divider {
  height: 1px;
  background: #f1f3f7;
}
</style>
