<script lang="ts">
  import { usePathContext } from "@daltonr/pathwrite-svelte";
  import { PLAN_LABELS, type SubscriptionData } from "./subscription";

  const ctx = usePathContext<SubscriptionData>();
</script>

{#if ctx.snapshot}
  {@const data = ctx.snapshot.data}
  {@const billingLabel = data.plan === 'free' ? 'N/A (Free plan)' : data.billingSameAsShipping ? 'Same as shipping' : `${data.billingName}, ${data.billingAddress}, ${data.billingCity} ${data.billingPostcode}`}
  <div class="form-body">
    <div class="review-section">
      <p class="section-title">Plan</p>
      <div class="review-card">
        <div class="review-row">
          <span class="review-key">Selected Plan</span>
          <span><span class="plan-badge" class:plan-badge--pro={data.plan === 'paid'} class:plan-badge--free={data.plan !== 'paid'}>{PLAN_LABELS[data.plan] ?? data.plan}</span></span>
        </div>
      </div>
    </div>

    <div class="review-section">
      <p class="section-title">Shipping Address</p>
      <div class="review-card">
        <div class="review-row"><span class="review-key">Name</span><span>{data.shippingName}</span></div>
        <div class="review-row"><span class="review-key">Address</span><span>{data.shippingAddress}</span></div>
        <div class="review-row"><span class="review-key">City</span><span>{data.shippingCity}</span></div>
        <div class="review-row"><span class="review-key">Postcode</span><span>{data.shippingPostcode}</span></div>
      </div>
    </div>

    {#if data.plan === 'paid'}
      <div class="review-section">
        <p class="section-title">Payment</p>
        <div class="review-card">
          <div class="review-row"><span class="review-key">Card</span><span>•••• {(data.cardNumber as string).slice(-4)}</span></div>
          <div class="review-row"><span class="review-key">Expiry</span><span>{data.cardExpiry}</span></div>
        </div>
      </div>

      <div class="review-section">
        <p class="section-title">Billing Address</p>
        <div class="review-card">
          <div class="review-row"><span class="review-key">Billing</span><span>{billingLabel}</span></div>
          {#if !data.billingSameAsShipping}
            <div class="review-row"><span class="review-key">Name</span><span>{data.billingName}</span></div>
            <div class="review-row"><span class="review-key">Address</span><span>{data.billingAddress}</span></div>
            <div class="review-row"><span class="review-key">City</span><span>{data.billingCity}</span></div>
            <div class="review-row"><span class="review-key">Postcode</span><span>{data.billingPostcode}</span></div>
          {/if}
        </div>
      </div>
    {/if}

    <div class="skip-summary">
      <p class="skip-summary__title">Steps in this flow</p>
      <ul class="skip-summary__list">
        <li>✓ Select Plan</li>
        <li>✓ Shipping Address</li>
        <li class:skip-summary__skipped={data.plan === 'free'}>{data.plan === 'free' ? '⏭ Payment Details (skipped)' : '✓ Payment Details'}</li>
        <li class:skip-summary__skipped={data.plan === 'free' || data.billingSameAsShipping}>
          {data.plan === 'free' ? '⏭ Billing Address (skipped — free plan)' : data.billingSameAsShipping ? '⏭ Billing Address (skipped — same as shipping)' : '✓ Billing Address'}
        </li>
        <li class="skip-summary__current">● Review (you are here)</li>
      </ul>
    </div>
  </div>
{/if}

