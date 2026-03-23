<script lang="ts">
  import { getPathContext } from "@daltonr/pathwrite-svelte";
  import type { SubscriptionData } from "./subscription";

  const ctx = getPathContext<SubscriptionData>();
  let errors = $derived(ctx.snapshot?.hasAttemptedNext ? ctx.snapshot.fieldMessages : {});
</script>

{#if ctx.snapshot}
  {@const data = ctx.snapshot.data}
  <div class="form-body">
    <p class="step-intro">Enter a separate billing address for your Pro subscription.</p>

    <div class="field" class:field--error={errors.billingName}>
      <label for="billingName">Full Name <span class="required">*</span></label>
      <input id="billingName" type="text" value={data.billingName ?? ""}
        oninput={(e) => ctx.setData("billingName", e.currentTarget.value)} placeholder="Jane Smith" autocomplete="name" autofocus />
      {#if errors.billingName}<span class="field-error">{errors.billingName}</span>{/if}
    </div>

    <div class="field" class:field--error={errors.billingAddress}>
      <label for="billingAddress">Street Address <span class="required">*</span></label>
      <input id="billingAddress" type="text" value={data.billingAddress ?? ""}
        oninput={(e) => ctx.setData("billingAddress", e.currentTarget.value)} placeholder="456 Billing Rd" autocomplete="street-address" />
      {#if errors.billingAddress}<span class="field-error">{errors.billingAddress}</span>{/if}
    </div>

    <div class="row">
      <div class="field" class:field--error={errors.billingCity}>
        <label for="billingCity">City <span class="required">*</span></label>
        <input id="billingCity" type="text" value={data.billingCity ?? ""}
          oninput={(e) => ctx.setData("billingCity", e.currentTarget.value)} placeholder="Dublin" autocomplete="address-level2" />
        {#if errors.billingCity}<span class="field-error">{errors.billingCity}</span>{/if}
      </div>
      <div class="field" class:field--error={errors.billingPostcode}>
        <label for="billingPostcode">Postcode <span class="required">*</span></label>
        <input id="billingPostcode" type="text" value={data.billingPostcode ?? ""}
          oninput={(e) => ctx.setData("billingPostcode", e.currentTarget.value)} placeholder="D02 XY34" autocomplete="postal-code" />
        {#if errors.billingPostcode}<span class="field-error">{errors.billingPostcode}</span>{/if}
      </div>
    </div>
  </div>
{/if}

