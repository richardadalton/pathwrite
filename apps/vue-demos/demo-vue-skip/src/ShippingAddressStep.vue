<script setup lang="ts">
import { computed } from "vue";
import { usePathContext } from "@daltonr/pathwrite-vue";
import type { SubscriptionData } from "./subscription";

const { snapshot, setData } = usePathContext<SubscriptionData>();
const data     = computed(() => snapshot.value?.data);
const errors   = computed(() => snapshot.value?.fieldErrors ?? {});
const attempted = computed(() => snapshot.value?.hasAttemptedNext ?? false);
</script>

<template>
  <div class="form-body">
    <p class="step-intro">Where should we ship your welcome kit?</p>

    <div :class="['field', attempted && errors.shippingName ? 'field--error' : '']">
      <label for="shippingName">Full Name <span class="required">*</span></label>
      <input id="shippingName" type="text" :value="data?.shippingName" autofocus
        @input="setData('shippingName', ($event.target as HTMLInputElement).value)"
        placeholder="Jane Smith" autocomplete="name" />
      <span v-if="attempted && errors.shippingName" class="field-error">{{ errors.shippingName }}</span>
    </div>

    <div :class="['field', attempted && errors.shippingAddress ? 'field--error' : '']">
      <label for="shippingAddress">Street Address <span class="required">*</span></label>
      <input id="shippingAddress" type="text" :value="data?.shippingAddress"
        @input="setData('shippingAddress', ($event.target as HTMLInputElement).value)"
        placeholder="123 Main St" autocomplete="street-address" />
      <span v-if="attempted && errors.shippingAddress" class="field-error">{{ errors.shippingAddress }}</span>
    </div>

    <div class="row">
      <div :class="['field', attempted && errors.shippingCity ? 'field--error' : '']">
        <label for="shippingCity">City <span class="required">*</span></label>
        <input id="shippingCity" type="text" :value="data?.shippingCity"
          @input="setData('shippingCity', ($event.target as HTMLInputElement).value)"
          placeholder="Dublin" autocomplete="address-level2" />
        <span v-if="attempted && errors.shippingCity" class="field-error">{{ errors.shippingCity }}</span>
      </div>

      <div :class="['field', attempted && errors.shippingPostcode ? 'field--error' : '']">
        <label for="shippingPostcode">Postcode <span class="required">*</span></label>
        <input id="shippingPostcode" type="text" :value="data?.shippingPostcode"
          @input="setData('shippingPostcode', ($event.target as HTMLInputElement).value)"
          placeholder="D01 AB12" autocomplete="postal-code" />
        <span v-if="attempted && errors.shippingPostcode" class="field-error">{{ errors.shippingPostcode }}</span>
      </div>
    </div>

    <!-- Billing same as shipping toggle — only visible for paid plans -->
    <div v-if="data?.plan === 'paid'" class="toggle-option">
      <div class="toggle-text">
        <strong>Billing same as shipping</strong>
        <span>Use this address for billing too</span>
      </div>
      <label class="toggle">
        <input type="checkbox" :checked="data?.billingSameAsShipping"
          @change="setData('billingSameAsShipping', ($event.target as HTMLInputElement).checked)" />
        <span class="toggle-track" />
        <span class="toggle-thumb" />
      </label>
    </div>

    <p v-if="data?.plan === 'paid' && data?.billingSameAsShipping" class="plan-note">
      ℹ️ Billing address step will be skipped — using shipping address.
    </p>
  </div>
</template>

