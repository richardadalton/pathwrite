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
    <p class="step-intro">Enter your payment details for the Pro plan.</p>

    <div :class="['field', attempted && errors.cardNumber ? 'field--error' : '']">
      <label for="cardNumber">Card Number <span class="required">*</span></label>
      <input id="cardNumber" type="text" :value="data?.cardNumber" autofocus
        @input="setData('cardNumber', ($event.target as HTMLInputElement).value)"
        placeholder="4242 4242 4242 4242" autocomplete="cc-number" />
      <span v-if="attempted && errors.cardNumber" class="field-error">{{ errors.cardNumber }}</span>
    </div>

    <div class="row">
      <div :class="['field', attempted && errors.cardExpiry ? 'field--error' : '']">
        <label for="cardExpiry">Expiry Date <span class="required">*</span></label>
        <input id="cardExpiry" type="text" :value="data?.cardExpiry"
          @input="setData('cardExpiry', ($event.target as HTMLInputElement).value)"
          placeholder="MM/YY" autocomplete="cc-exp" />
        <span v-if="attempted && errors.cardExpiry" class="field-error">{{ errors.cardExpiry }}</span>
      </div>

      <div :class="['field', attempted && errors.cardCvc ? 'field--error' : '']">
        <label for="cardCvc">CVC <span class="required">*</span></label>
        <input id="cardCvc" type="text" :value="data?.cardCvc"
          @input="setData('cardCvc', ($event.target as HTMLInputElement).value)"
          placeholder="123" autocomplete="cc-csc" />
        <span v-if="attempted && errors.cardCvc" class="field-error">{{ errors.cardCvc }}</span>
      </div>
    </div>
  </div>
</template>

