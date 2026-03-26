<script lang="ts">
  import { getPathContext } from "@daltonr/pathwrite-svelte";
  import type { SubscriptionData } from "./subscription";

  const ctx = getPathContext<SubscriptionData>();
  let errors = $derived(ctx.snapshot?.hasAttemptedNext ? ctx.snapshot.fieldErrors : {});
</script>

{#if ctx.snapshot}
  {@const data = ctx.snapshot.data}
  <div class="form-body">
    <p class="step-intro">Enter your payment details for the Pro plan.</p>

    <div class="field" class:field--error={errors.cardNumber}>
      <label for="cardNumber">Card Number <span class="required">*</span></label>
      <input id="cardNumber" type="text" value={data.cardNumber ?? ""}
        oninput={(e) => ctx.setData("cardNumber", e.currentTarget.value)} placeholder="4242 4242 4242 4242" autocomplete="cc-number" autofocus />
      {#if errors.cardNumber}<span class="field-error">{errors.cardNumber}</span>{/if}
    </div>

    <div class="row">
      <div class="field" class:field--error={errors.cardExpiry}>
        <label for="cardExpiry">Expiry Date <span class="required">*</span></label>
        <input id="cardExpiry" type="text" value={data.cardExpiry ?? ""}
          oninput={(e) => ctx.setData("cardExpiry", e.currentTarget.value)} placeholder="MM/YY" autocomplete="cc-exp" />
        {#if errors.cardExpiry}<span class="field-error">{errors.cardExpiry}</span>{/if}
      </div>
      <div class="field" class:field--error={errors.cardCvc}>
        <label for="cardCvc">CVC <span class="required">*</span></label>
        <input id="cardCvc" type="text" value={data.cardCvc ?? ""}
          oninput={(e) => ctx.setData("cardCvc", e.currentTarget.value)} placeholder="123" autocomplete="cc-csc" />
        {#if errors.cardCvc}<span class="field-error">{errors.cardCvc}</span>{/if}
      </div>
    </div>
  </div>
{/if}

