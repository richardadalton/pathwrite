<script setup lang="ts">
import { computed } from "vue";
import { usePathContext } from "@daltonr/pathwrite-vue";
import { US_STATES, type AddressData } from "./address-path";

const { snapshot, setData } = usePathContext<AddressData>();
const errors = computed(() =>
  snapshot.value?.hasAttemptedNext ? snapshot.value.fieldErrors : {}
);
</script>

<template>
  <div v-if="snapshot" class="form-body">
    <div class="field" :class="{ 'field--error': errors.streetAddress }">
      <label for="streetAddress">Street Address <span class="required">*</span></label>
      <input
        id="streetAddress"
        type="text"
        :value="snapshot.data.streetAddress ?? ''"
        @input="setData('streetAddress', ($event.target as HTMLInputElement).value)"
        placeholder="123 Main Street"
        autocomplete="address-line1"
        autofocus
      />
      <span v-if="errors.streetAddress" class="field-error">{{ errors.streetAddress }}</span>
    </div>

    <div class="field">
      <label for="aptUnit">Apt / Unit <span class="optional">(optional)</span></label>
      <input
        id="aptUnit"
        type="text"
        :value="snapshot.data.aptUnit ?? ''"
        @input="setData('aptUnit', ($event.target as HTMLInputElement).value)"
        placeholder="Apt 4B"
        autocomplete="address-line2"
      />
    </div>

    <div class="row">
      <div class="field" :class="{ 'field--error': errors.city }">
        <label for="city">City <span class="required">*</span></label>
        <input
          id="city"
          type="text"
          :value="snapshot.data.city ?? ''"
          @input="setData('city', ($event.target as HTMLInputElement).value)"
          placeholder="Springfield"
          autocomplete="address-level2"
        />
        <span v-if="errors.city" class="field-error">{{ errors.city }}</span>
      </div>

      <div class="field" :class="{ 'field--error': errors.state }">
        <label for="state">State <span class="required">*</span></label>
        <select
          id="state"
          :value="snapshot.data.state ?? ''"
          @change="setData('state', ($event.target as HTMLSelectElement).value)"
          autocomplete="address-level1"
        >
          <option value="">Select state…</option>
          <option v-for="s in US_STATES" :key="s.code" :value="s.code">{{ s.name }}</option>
        </select>
        <span v-if="errors.state" class="field-error">{{ errors.state }}</span>
      </div>
    </div>

    <div class="field field--short">
      <label for="zipCode">ZIP Code <span class="required">*</span></label>
      <input
        id="zipCode"
        type="text"
        :value="snapshot.data.zipCode ?? ''"
        @input="setData('zipCode', ($event.target as HTMLInputElement).value)"
        placeholder="90210"
        autocomplete="postal-code"
        maxlength="10"
      />
      <span v-if="errors.zipCode" class="field-error">{{ errors.zipCode }}</span>
    </div>
  </div>
</template>

<style scoped>
.field--short {
  max-width: 180px;
}
</style>
