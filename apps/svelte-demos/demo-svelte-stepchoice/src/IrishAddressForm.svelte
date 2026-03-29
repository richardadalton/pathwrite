<script lang="ts">
  import { usePathContext } from "@daltonr/pathwrite-svelte";
  import { IE_COUNTIES, type AddressData } from "./address-path";

  const ctx = usePathContext<AddressData>();
  let errors = $derived(ctx.snapshot?.hasAttemptedNext ? ctx.snapshot.fieldErrors : {});
</script>

{#if ctx.snapshot}
  <div class="form-body">
    <div class="field" class:field--error={errors.addressLine1}>
      <label for="addressLine1">Address Line 1 <span class="required">*</span></label>
      <input
        id="addressLine1"
        type="text"
        value={ctx.snapshot.data.addressLine1 ?? ""}
        oninput={(e) => ctx.setData("addressLine1", e.currentTarget.value)}
        placeholder="12 O'Connell Street"
        autocomplete="address-line1"
        autofocus
      />
      {#if errors.addressLine1}<span class="field-error">{errors.addressLine1}</span>{/if}
    </div>

    <div class="field">
      <label for="addressLine2">Address Line 2 <span class="optional">(optional)</span></label>
      <input
        id="addressLine2"
        type="text"
        value={ctx.snapshot.data.addressLine2 ?? ""}
        oninput={(e) => ctx.setData("addressLine2", e.currentTarget.value)}
        placeholder="Apartment 3"
        autocomplete="address-line2"
      />
    </div>

    <div class="row">
      <div class="field" class:field--error={errors.town}>
        <label for="town">Town / City <span class="required">*</span></label>
        <input
          id="town"
          type="text"
          value={ctx.snapshot.data.town ?? ""}
          oninput={(e) => ctx.setData("town", e.currentTarget.value)}
          placeholder="Dublin"
          autocomplete="address-level2"
        />
        {#if errors.town}<span class="field-error">{errors.town}</span>{/if}
      </div>

      <div class="field" class:field--error={errors.county}>
        <label for="county">County <span class="required">*</span></label>
        <select
          id="county"
          value={ctx.snapshot.data.county ?? ""}
          onchange={(e) => ctx.setData("county", e.currentTarget.value)}
          autocomplete="address-level1"
        >
          <option value="">Select county…</option>
          {#each IE_COUNTIES as c}
            <option value={c}>{c}</option>
          {/each}
        </select>
        {#if errors.county}<span class="field-error">{errors.county}</span>{/if}
      </div>
    </div>

    <div class="field field--short">
      <label for="eircode">Eircode <span class="optional">(optional)</span></label>
      <input
        id="eircode"
        type="text"
        value={ctx.snapshot.data.eircode ?? ""}
        oninput={(e) => ctx.setData("eircode", e.currentTarget.value.toUpperCase())}
        placeholder="D01 F5P2"
        autocomplete="postal-code"
        maxlength="8"
      />
    </div>
  </div>
{/if}
