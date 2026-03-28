<script lang="ts">
  import PathShell from "@daltonr/pathwrite-svelte/PathShell.svelte";
  import type { PathData } from "@daltonr/pathwrite-svelte";
  import { subscriptionPath, INITIAL_DATA, PLAN_LABELS, type SubscriptionData } from "./subscription";
  import SelectPlanStep      from "./SelectPlanStep.svelte";
  import ShippingAddressStep from "./ShippingAddressStep.svelte";
  import PaymentStep         from "./PaymentStep.svelte";
  import BillingAddressStep  from "./BillingAddressStep.svelte";
  import ReviewStep          from "./ReviewStep.svelte";

  let isCompleted   = $state(false);
  let isCancelled   = $state(false);
  let completedData = $state<SubscriptionData | null>(null);

  function handleComplete(data: PathData) { completedData = data as SubscriptionData; isCompleted = true; }
  function handleCancel()  { isCancelled = true; }
  function startOver()     { isCompleted = false; isCancelled = false; completedData = null; }
</script>

<main class="page">
  <div class="page-header">
    <h1>Subscription Flow</h1>
    <p class="subtitle">Conditional steps demo — <code>shouldSkip</code> hides payment and billing steps for the Free plan.</p>
  </div>

  {#if isCompleted && completedData}
    <section class="result-panel success-panel">
      <div class="result-icon">🎉</div>
      <h2>Subscription Complete!</h2>
      <p>You're signed up for the <strong>{PLAN_LABELS[completedData.plan] ?? completedData.plan}</strong> plan.</p>
      <div class="summary">
        <div class="summary-section">
          <p class="summary-section__title">Plan</p>
          <div class="summary-row"><span class="summary-key">Plan</span><span>{PLAN_LABELS[completedData.plan]}</span></div>
        </div>
        <div class="summary-section">
          <p class="summary-section__title">Shipping</p>
          <div class="summary-row"><span class="summary-key">Name</span><span>{completedData.shippingName}</span></div>
          <div class="summary-row"><span class="summary-key">Address</span><span>{completedData.shippingAddress}, {completedData.shippingCity} {completedData.shippingPostcode}</span></div>
        </div>
        {#if completedData.plan === 'paid'}
          <div class="summary-section">
            <p class="summary-section__title">Payment</p>
            <div class="summary-row"><span class="summary-key">Card</span><span>•••• {completedData.cardNumber.slice(-4)}</span></div>
          </div>
        {/if}
      </div>
      <button class="btn-primary" onclick={startOver}>Start Over</button>
    </section>
  {/if}

  {#if isCancelled}
    <section class="result-panel cancel-panel">
      <div class="result-icon">✖</div>
      <h2>Subscription Cancelled</h2>
      <p>No subscription was created.</p>
      <button class="btn-secondary" onclick={startOver}>Try Again</button>
    </section>
  {/if}

  {#if !isCompleted && !isCancelled}
    <PathShell
      path={subscriptionPath}
      initialData={INITIAL_DATA}
      completeLabel="Subscribe"
      cancelLabel="Cancel"
      validationDisplay="inline"
      oncomplete={handleComplete}
      oncancel={handleCancel}
      selectPlan={SelectPlanStep}
      shippingAddress={ShippingAddressStep}
      payment={PaymentStep}
      billingAddress={BillingAddressStep}
      review={ReviewStep}
    />
  {/if}
</main>

