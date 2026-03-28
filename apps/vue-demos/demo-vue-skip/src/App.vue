<script setup lang="ts">
import { ref } from "vue";
import { PathShell } from "@daltonr/pathwrite-vue";
import type { PathData } from "@daltonr/pathwrite-vue";
import { subscriptionPath, INITIAL_DATA, PLAN_LABELS, type SubscriptionData } from "./subscription";
import SelectPlanStep       from "./SelectPlanStep.vue";
import ShippingAddressStep  from "./ShippingAddressStep.vue";
import PaymentStep          from "./PaymentStep.vue";
import BillingAddressStep   from "./BillingAddressStep.vue";
import ReviewStep           from "./ReviewStep.vue";

const isCompleted   = ref(false);
const isCancelled   = ref(false);
const completedData = ref<SubscriptionData | null>(null);

function handleComplete(data: PathData) {
  completedData.value = data as SubscriptionData;
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
      <h1>Subscription Flow</h1>
      <p class="subtitle">Conditional steps demo — <code>shouldSkip</code> hides payment and billing steps for the Free plan.</p>
    </div>

    <!-- Completed -->
    <section v-if="isCompleted && completedData" class="result-panel success-panel">
      <div class="result-icon">🎉</div>
      <h2>Subscription Complete!</h2>
      <p>You're signed up for the <strong>{{ PLAN_LABELS[completedData.plan] ?? completedData.plan }}</strong> plan.</p>
      <div class="summary">
        <div class="summary-section">
          <p class="summary-section__title">Plan</p>
          <div class="summary-row"><span class="summary-key">Plan</span><span>{{ PLAN_LABELS[completedData.plan] }}</span></div>
        </div>
        <div class="summary-section">
          <p class="summary-section__title">Shipping</p>
          <div class="summary-row"><span class="summary-key">Name</span><span>{{ completedData.shippingName }}</span></div>
          <div class="summary-row"><span class="summary-key">Address</span><span>{{ completedData.shippingAddress }}, {{ completedData.shippingCity }} {{ completedData.shippingPostcode }}</span></div>
        </div>
        <div v-if="completedData.plan === 'paid'" class="summary-section">
          <p class="summary-section__title">Payment</p>
          <div class="summary-row"><span class="summary-key">Card</span><span>•••• {{ (completedData.cardNumber as string).slice(-4) }}</span></div>
        </div>
      </div>
      <button class="btn-primary" @click="startOver">Start Over</button>
    </section>

    <!-- Cancelled -->
    <section v-else-if="isCancelled" class="result-panel cancel-panel">
      <div class="result-icon">✖</div>
      <h2>Subscription Cancelled</h2>
      <p>No subscription was created.</p>
      <button class="btn-secondary" @click="startOver">Try Again</button>
    </section>

    <!-- Active wizard -->
    <PathShell
      v-else
      :path="subscriptionPath"
      :initial-data="INITIAL_DATA"
      complete-label="Subscribe"
      cancel-label="Cancel"
      validation-display="inline"
      @complete="handleComplete"
      @cancel="handleCancel"
    >
      <template #select-plan><SelectPlanStep /></template>
      <template #shipping-address><ShippingAddressStep /></template>
      <template #payment><PaymentStep /></template>
      <template #billing-address><BillingAddressStep /></template>
      <template #review><ReviewStep /></template>
    </PathShell>
  </main>
</template>

