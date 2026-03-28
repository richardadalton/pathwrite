<script setup lang="ts">
import { computed } from "vue";
import { usePathContext } from "@daltonr/pathwrite-vue";
import type { AddressData } from "./address-path";

const COUNTRIES = [
  { code: "US", label: "United States" },
  { code: "IE", label: "Ireland" },
];

const { snapshot, setData } = usePathContext<AddressData>();
const errors = computed(() =>
  snapshot.value?.hasAttemptedNext ? snapshot.value.fieldErrors : {}
);
</script>

<template>
  <div v-if="snapshot" class="form-body">
    <p class="step-intro">Where are you based? We'll show you the right address form on the next step.</p>

    <div class="country-grid">
      <label
        v-for="{ code, label } in COUNTRIES"
        :key="code"
        class="country-card"
        :class="{ 'country-card--selected': snapshot.data.country === code }"
      >
        <input
          type="radio"
          name="country"
          :value="code"
          :checked="snapshot.data.country === code"
          @change="setData('country', code)"
        />
        <span class="country-flag">{{ code === "US" ? "🇺🇸" : "🇮🇪" }}</span>
        <span class="country-name">{{ label }}</span>
      </label>
    </div>

    <span v-if="errors.country" class="field-error">{{ errors.country }}</span>
  </div>
</template>

<style scoped>
.country-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.country-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 20px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  user-select: none;
}
.country-card input[type="radio"] {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.country-card:hover {
  border-color: #93c5fd;
  background: #f8fbff;
}
.country-card--selected {
  border-color: #2563eb;
  background: #eff6ff;
}
.country-flag {
  font-size: 36px;
  line-height: 1;
}
.country-name {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}
.country-card--selected .country-name {
  color: #1d4ed8;
}
</style>
