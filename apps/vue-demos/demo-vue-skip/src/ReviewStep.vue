<script setup lang="ts">
import { computed } from "vue";
import { usePathContext } from "@daltonr/pathwrite-vue";
import { PLAN_LABELS, type SubscriptionData } from "./subscription";

const { snapshot } = usePathContext<SubscriptionData>();
const data = computed(() => snapshot.value?.data);

const billingLabel = computed(() => {
  if (data.value?.plan === "free") return "N/A (Free plan)";
  if (data.value?.billingSameAsShipping) return "Same as shipping";
  return `${data.value?.billingName}, ${data.value?.billingAddress}, ${data.value?.billingCity} ${data.value?.billingPostcode}`;
});
</script>

<template>
  <div class="form-body" v-if="data">
    <div class="review-section">
      <p class="section-title">Plan</p>
      <div class="review-card">
        <div class="review-row">
          <span class="review-key">Selected Plan</span>
          <span>
            <span :class="['plan-badge', data.plan === 'paid' ? 'plan-badge--pro' : 'plan-badge--free']">
              {{ PLAN_LABELS[data.plan] ?? data.plan }}
            </span>
          </span>
        </div>
      </div>
    </div>

    <div class="review-section">
      <p class="section-title">Shipping Address</p>
      <div class="review-card">
        <div class="review-row"><span class="review-key">Name</span><span>{{ data.shippingName }}</span></div>
        <div class="review-row"><span class="review-key">Address</span><span>{{ data.shippingAddress }}</span></div>
        <div class="review-row"><span class="review-key">City</span><span>{{ data.shippingCity }}</span></div>
        <div class="review-row"><span class="review-key">Postcode</span><span>{{ data.shippingPostcode }}</span></div>
      </div>
    </div>

    <div v-if="data.plan === 'paid'" class="review-section">
      <p class="section-title">Payment</p>
      <div class="review-card">
        <div class="review-row"><span class="review-key">Card</span><span>•••• {{ (data.cardNumber as string).slice(-4) }}</span></div>
        <div class="review-row"><span class="review-key">Expiry</span><span>{{ data.cardExpiry }}</span></div>
      </div>
    </div>

    <div v-if="data.plan === 'paid'" class="review-section">
      <p class="section-title">Billing Address</p>
      <div class="review-card">
        <div class="review-row">
          <span class="review-key">Billing</span>
          <span>{{ billingLabel }}</span>
        </div>
        <template v-if="!data.billingSameAsShipping">
          <div class="review-row"><span class="review-key">Name</span><span>{{ data.billingName }}</span></div>
          <div class="review-row"><span class="review-key">Address</span><span>{{ data.billingAddress }}</span></div>
          <div class="review-row"><span class="review-key">City</span><span>{{ data.billingCity }}</span></div>
          <div class="review-row"><span class="review-key">Postcode</span><span>{{ data.billingPostcode }}</span></div>
        </template>
      </div>
    </div>

    <div class="skip-summary">
      <p class="skip-summary__title">Steps in this flow</p>
      <ul class="skip-summary__list">
        <li>✓ Select Plan</li>
        <li>✓ Shipping Address</li>
        <li :class="data.plan === 'free' ? 'skip-summary__skipped' : ''">
          {{ data.plan === 'free' ? '⏭ Payment Details (skipped)' : '✓ Payment Details' }}
        </li>
        <li :class="data.plan === 'free' || data.billingSameAsShipping ? 'skip-summary__skipped' : ''">
          {{ data.plan === 'free' ? '⏭ Billing Address (skipped — free plan)' : data.billingSameAsShipping ? '⏭ Billing Address (skipped — same as shipping)' : '✓ Billing Address' }}
        </li>
        <li class="skip-summary__current">● Review (you are here)</li>
      </ul>
    </div>
  </div>
</template>

