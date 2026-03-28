<script lang="ts">
  import { getPathContext } from "@daltonr/pathwrite-svelte";
  import { US_STATES, type AddressData } from "./address-path";

  const ctx = getPathContext<AddressData>();
  let errors = $derived(ctx.snapshot?.hasAttemptedNext ? ctx.snapshot.fieldErrors : {});
</script>

{#if ctx.snapshot}
  <div class="form-body">
    <div class="field" class:field--error={errors.streetAddress}>
      <label for="streetAddress">Street Address <span class="required">*</span></label>
      <input
        id="streetAddress"
        type="text"
        value={ctx.snapshot.data.streetAddress ?? ""}
        oninput={(e) => ctx.setData("streetAddress", e.currentTarget.value)}
        placeholder="123 Main St"
        autocomplete="address-line1"
        autofocus
      />
      {#if errors.streetAddress}<span class="field-error">{errors.streetAddress}</span>{/if}
    </div>

    <div class="field">
      <label for="aptUnit">Apt / Unit <span class="optional">(optional)</span></label>
      <input
        id="aptUnit"
        type="text"
        value={ctx.snapshot.data.aptUnit ?? ""}
        oninput={(e) => ctx.setData("aptUnit", e.currentTarget.value)}
        placeholder="Apt 4B"
        autocomplete="address-line2"
      />
    </div>

    <div class="row">
      <div class="field" class:field--error={errors.city}>
        <label for="city">City <span class="required">*</span></label>
        <input
          id="city"
          type="text"
          value={ctx.snapshot.data.city ?? ""}
          oninput={(e) => ctx.setData("city", e.currentTarget.value)}
          placeholder="New York"
          autocomplete="address-level2"
        />
        {#if errors.city}<span class="field-error">{errors.city}</span>{/if}
      </div>

      <div class="field" class:field--error={errors.state}>
        <label for="state">State <span class="required">*</span></label>
        <select
          id="state"
          value={ctx.snapshot.data.state ?? ""}
          onchange={(e) => ctx.setData("state", e.currentTarget.value)}
          autocomplete="address-level1"
        >
          <option value="">Select state…</option>
          {#each US_STATES as s}
            <option value={s.code}>{s.name}</option>
          {/each}
        </select>
        {#if errors.state}<span class="field-error">{errors.state}</span>{/if}
      </div>
    </div>

    <div class="field field--short" class:field--error={errors.zipCode}>
      <label for="zipCode">ZIP Code <span class="required">*</span></label>
      <input
        id="zipCode"
        type="text"
        value={ctx.snapshot.data.zipCode ?? ""}
        oninput={(e) => ctx.setData("zipCode", e.currentTarget.value)}
        placeholder="90210"
        autocomplete="postal-code"
        maxlength="10"
      />
      {#if errors.zipCode}<span class="field-error">{errors.zipCode}</span>{/if}
    </div>
  </div>
{/if}
