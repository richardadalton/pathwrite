<script lang="ts">
  import { getPathContext } from "@daltonr/pathwrite-svelte";
  import type { AddressData } from "./address-path";

  const ctx = getPathContext<AddressData>();
  let errors = $derived(ctx.snapshot?.hasAttemptedNext ? ctx.snapshot.fieldErrors : {});
</script>

{#if ctx.snapshot}
  <div class="form-body">
    <p class="step-intro">Select your country. We'll show the right address form for your location.</p>

    <div>
      <div class="country-cards">
        <label class="country-card">
          <input
            type="radio"
            name="country"
            value="US"
            checked={ctx.snapshot.data.country === "US"}
            onchange={() => ctx.setData("country", "US")}
          />
          <span class="country-flag">🇺🇸</span>
          <span class="country-name">United States</span>
        </label>
        <label class="country-card">
          <input
            type="radio"
            name="country"
            value="IE"
            checked={ctx.snapshot.data.country === "IE"}
            onchange={() => ctx.setData("country", "IE")}
          />
          <span class="country-flag">🇮🇪</span>
          <span class="country-name">Ireland</span>
        </label>
      </div>
      {#if errors.country}
        <p class="country-error">{errors.country}</p>
      {/if}
    </div>
  </div>
{/if}
