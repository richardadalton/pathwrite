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
    <p class="step-intro">Choose the plan that's right for you. Free gets you started — upgrade anytime.</p>

    <div class="plan-options">
      <label :class="['plan-card', data?.plan === 'free' ? 'plan-card--selected' : '']">
        <input type="radio" name="plan" value="free"
          :checked="data?.plan === 'free'"
          @change="setData('plan', 'free')" />
        <div class="plan-card__body">
          <span class="plan-card__name">Free</span>
          <span class="plan-card__price">$0 / month</span>
          <ul class="plan-card__features">
            <li>1 project</li>
            <li>Community support</li>
            <li>Basic analytics</li>
          </ul>
        </div>
      </label>

      <label :class="['plan-card', data?.plan === 'paid' ? 'plan-card--selected' : '']">
        <input type="radio" name="plan" value="paid"
          :checked="data?.plan === 'paid'"
          @change="setData('plan', 'paid')" />
        <div class="plan-card__body">
          <span class="plan-card__name">Pro</span>
          <span class="plan-card__price">$29 / month</span>
          <ul class="plan-card__features">
            <li>Unlimited projects</li>
            <li>Priority support</li>
            <li>Advanced analytics</li>
            <li>Custom branding</li>
          </ul>
        </div>
      </label>
    </div>

    <span v-if="attempted && errors.plan" class="field-error">{{ errors.plan }}</span>

    <p v-if="data?.plan === 'free'" class="plan-note">
      ℹ️ Free plan — payment and billing steps will be skipped.
    </p>
  </div>
</template>

