<script lang="ts">
  import { getPathContext } from "@daltonr/pathwrite-svelte";
  import type { SubscriptionData } from "./subscription";

  const ctx = getPathContext<SubscriptionData>();
  let errors = $derived(ctx.snapshot?.hasAttemptedNext ? ctx.snapshot.fieldMessages : {});
</script>

{#if ctx.snapshot}
  {@const data = ctx.snapshot.data}
  <div class="form-body">
    <p class="step-intro">Where should we ship your welcome kit?</p>

    <div class="field" class:field--error={errors.shippingName}>
      <label for="shippingName">Full Name <span class="required">*</span></label>
      <input id="shippingName" type="text" value={data.shippingName ?? ""}
        oninput={(e) => ctx.setData("shippingName", e.currentTarget.value)} placeholder="Jane Smith" autocomplete="name" autofocus />
      {#if errors.shippingName}<span class="field-error">{errors.shippingName}</span>{/if}
    </div>

    <div class="field" class:field--error={errors.shippingAddress}>
      <label for="shippingAddress">Street Address <span class="required">*</span></label>
      <input id="shippingAddress" type="text" value={data.shippingAddress ?? ""}
        oninput={(e) => ctx.setData("shippingAddress", e.currentTarget.value)} placeholder="123 Main St" autocomplete="street-address" />
      {#if errors.shippingAddress}<span class="field-error">{errors.shippingAddress}</span>{/if}
    </div>

    <div class="row">
      <div class="field" class:field--error={errors.shippingCity}>
        <label for="shippingCity">City <span class="required">*</span></label>
        <input id="shippingCity" type="text" value={data.shippingCity ?? ""}
          oninput={(e) => ctx.setData("shippingCity", e.currentTarget.value)} placeholder="Dublin" autocomplete="address-level2" />
        {#if errors.shippingCity}<span class="field-error">{errors.shippingCity}</span>{/if}
      </div>
      <div class="field" class:field--error={errors.shippingPostcode}>
        <label for="shippingPostcode">Postcode <span class="required">*</span></label>
        <input id="shippingPostcode" type="text" value={data.shippingPostcode ?? ""}
          oninput={(e) => ctx.setData("shippingPostcode", e.currentTarget.value)} placeholder="D01 AB12" autocomplete="postal-code" />
        {#if errors.shippingPostcode}<span class="field-error">{errors.shippingPostcode}</span>{/if}
      </div>
    </div>

    {#if data.plan === 'paid'}
      <div class="toggle-option">
        <div class="toggle-text">
          <strong>Billing same as shipping</strong>
          <span>Use this address for billing too</span>
        </div>
        <label class="toggle">
          <input type="checkbox" checked={!!data.billingSameAsShipping}
            onchange={(e) => ctx.setData("billingSameAsShipping", e.currentTarget.checked)} />
          <span class="toggle-track"></span>
          <span class="toggle-thumb"></span>
        </label>
      </div>
    {/if}

    {#if data.plan === 'paid' && data.billingSameAsShipping}
      <p class="plan-note">ℹ️ Billing address step will be skipped — using shipping address.</p>
    {/if}
  </div>
{/if}

