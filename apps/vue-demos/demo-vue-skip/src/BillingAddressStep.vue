<script setup lang="ts">
import { computed } from "vue";
import { usePathContext } from "@daltonr/pathwrite-vue";
import type { SubscriptionData } from "./subscription";

const { snapshot, setData } = usePathContext<SubscriptionData>();
const data     = computed(() => snapshot.value?.data);
const errors   = computed(() => snapshot.value?.fieldMessages ?? {});
const attempted = computed(() => snapshot.value?.hasAttemptedNext ?? false);
</script>

<template>
  <div class="form-body">
    <p class="step-intro">Enter a separate billing address for your Pro subscription.</p>

    <div :class="['field', attempted && errors.billingName ? 'field--error' : '']">
      <label for="billingName">Full Name <span class="required">*</span></label>
      <input id="billingName" type="text" :value="data?.billingName" autofocus
        @input="setData('billingName', ($event.target as HTMLInputElement).value)"
        placeholder="Jane Smith" autocomplete="name" />
      <span v-if="attempted && errors.billingName" class="field-error">{{ errors.billingName }}</span>
    </div>

    <div :class="['field', attempted && errors.billingAddress ? 'field--error' : '']">
      <label for="billingAddress">Street Address <span class="required">*</span></label>
      <input id="billingAddress" type="text" :value="data?.billingAddress"
        @input="setData('billingAddress', ($event.target as HTMLInputElement).value)"
        placeholder="456 Billing Rd" autocomplete="street-address" />
      <span v-if="attempted && errors.billingAddress" class="field-error">{{ errors.billingAddress }}</span>
    </div>

    <div class="row">
      <div :class="['field', attempted && errors.billingCity ? 'field--error' : '']">
        <label for="billingCity">City <span class="required">*</span></label>
        <input id="billingCity" type="text" :value="data?.billingCity"
          @input="setData('billingCity', ($event.target as HTMLInputElement).value)"
          placeholder="Dublin" autocomplete="address-level2" />
        <span v-if="attempted && errors.billingCity" class="field-error">{{ errors.billingCity }}</span>
      </div>

      <div :class="['field', attempted && errors.billingPostcode ? 'field--error' : '']">
        <label for="billingPostcode">Postcode <span class="required">*</span></label>
        <input id="billingPostcode" type="text" :value="data?.billingPostcode"
          @input="setData('billingPostcode', ($event.target as HTMLInputElement).value)"
          placeholder="D02 XY34" autocomplete="postal-code" />
        <span v-if="attempted && errors.billingPostcode" class="field-error">{{ errors.billingPostcode }}</span>
      </div>
    </div>
  </div>
</template>

