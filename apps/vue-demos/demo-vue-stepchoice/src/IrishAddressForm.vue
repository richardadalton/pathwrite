<script setup lang="ts">
import { computed } from "vue";
import { usePathContext } from "@daltonr/pathwrite-vue";
import { IE_COUNTIES, type AddressData } from "./address-path";

const { snapshot, setData } = usePathContext<AddressData>();
const errors = computed(() =>
  snapshot.value?.hasAttemptedNext ? snapshot.value.fieldErrors : {}
);
</script>

<template>
  <div v-if="snapshot" class="form-body">
    <div class="field" :class="{ 'field--error': errors.addressLine1 }">
      <label for="addressLine1">Address Line 1 <span class="required">*</span></label>
      <input
        id="addressLine1"
        type="text"
        :value="snapshot.data.addressLine1 ?? ''"
        @input="setData('addressLine1', ($event.target as HTMLInputElement).value)"
        placeholder="12 O'Connell Street"
        autocomplete="address-line1"
        autofocus
      />
      <span v-if="errors.addressLine1" class="field-error">{{ errors.addressLine1 }}</span>
    </div>

    <div class="field">
      <label for="addressLine2">Address Line 2 <span class="optional">(optional)</span></label>
      <input
        id="addressLine2"
        type="text"
        :value="snapshot.data.addressLine2 ?? ''"
        @input="setData('addressLine2', ($event.target as HTMLInputElement).value)"
        placeholder="Apartment 3"
        autocomplete="address-line2"
      />
    </div>

    <div class="row">
      <div class="field" :class="{ 'field--error': errors.town }">
        <label for="town">Town / City <span class="required">*</span></label>
        <input
          id="town"
          type="text"
          :value="snapshot.data.town ?? ''"
          @input="setData('town', ($event.target as HTMLInputElement).value)"
          placeholder="Dublin"
          autocomplete="address-level2"
        />
        <span v-if="errors.town" class="field-error">{{ errors.town }}</span>
      </div>

      <div class="field" :class="{ 'field--error': errors.county }">
        <label for="county">County <span class="required">*</span></label>
        <select
          id="county"
          :value="snapshot.data.county ?? ''"
          @change="setData('county', ($event.target as HTMLSelectElement).value)"
          autocomplete="address-level1"
        >
          <option value="">Select county…</option>
          <option v-for="c in IE_COUNTIES" :key="c" :value="c">{{ c }}</option>
        </select>
        <span v-if="errors.county" class="field-error">{{ errors.county }}</span>
      </div>
    </div>

    <div class="field field--short">
      <label for="eircode">Eircode <span class="optional">(optional)</span></label>
      <input
        id="eircode"
        type="text"
        :value="snapshot.data.eircode ?? ''"
        @input="setData('eircode', ($event.target as HTMLInputElement).value.toUpperCase())"
        placeholder="D01 F5P2"
        autocomplete="postal-code"
        maxlength="8"
      />
    </div>
  </div>
</template>

<style scoped>
.field--short {
  max-width: 180px;
}
</style>
