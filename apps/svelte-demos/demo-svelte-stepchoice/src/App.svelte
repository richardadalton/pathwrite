<script lang="ts">
  import { PathShell } from "@daltonr/pathwrite-svelte";
  import type { PathData } from "@daltonr/pathwrite-svelte";
  import { addressPath, INITIAL_DATA, type AddressData } from "./address-path";
  import CountryStep      from "./CountryStep.svelte";
  import USAddressForm    from "./USAddressForm.svelte";
  import IrishAddressForm from "./IrishAddressForm.svelte";
  import ConfirmStep      from "./ConfirmStep.svelte";

  const COUNTRY_NAMES: Record<string, string> = { US: "United States", IE: "Ireland" };

  let isCompleted   = $state(false);
  let isCancelled   = $state(false);
  let completedData = $state<AddressData | null>(null);

  function handleComplete(data: PathData) { completedData = data as AddressData; isCompleted = true; }
  function handleCancel()  { isCancelled = true; }
  function startOver()     { isCompleted = false; isCancelled = false; completedData = null; }
</script>

<main class="page">
  <div class="page-header">
    <h1>Address Form</h1>
    <p class="subtitle">StepChoice demo — the address step selects US or Irish fields based on your country selection.</p>
  </div>

  {#if isCompleted && completedData}
    {@const d = completedData}
    <section class="result-panel success-panel">
      <div class="result-icon">✓</div>
      <h2>Address Saved!</h2>
      <p>Your {COUNTRY_NAMES[d.country] ?? d.country} address has been saved.</p>
      <div class="summary">
        <div class="summary-section">
          <p class="summary-section__title">Country</p>
          <div class="summary-row"><span class="summary-key">Country</span><span>{COUNTRY_NAMES[d.country] ?? d.country}</span></div>
        </div>
        {#if d.country === "US"}
          <div class="summary-section">
            <p class="summary-section__title">Address</p>
            <div class="summary-row"><span class="summary-key">Street</span><span>{d.streetAddress}{d.aptUnit ? `, ${d.aptUnit}` : ""}</span></div>
            <div class="summary-row"><span class="summary-key">City</span><span>{d.city}</span></div>
            <div class="summary-row"><span class="summary-key">State</span><span>{d.state}</span></div>
            <div class="summary-row"><span class="summary-key">ZIP</span><span>{d.zipCode}</span></div>
          </div>
        {:else}
          <div class="summary-section">
            <p class="summary-section__title">Address</p>
            <div class="summary-row"><span class="summary-key">Line 1</span><span>{d.addressLine1}</span></div>
            {#if d.addressLine2}<div class="summary-row"><span class="summary-key">Line 2</span><span>{d.addressLine2}</span></div>{/if}
            <div class="summary-row"><span class="summary-key">Town</span><span>{d.town}</span></div>
            <div class="summary-row"><span class="summary-key">County</span><span>{d.county}</span></div>
            {#if d.eircode}<div class="summary-row"><span class="summary-key">Eircode</span><span>{d.eircode}</span></div>{/if}
          </div>
        {/if}
      </div>
      <button class="btn-primary" onclick={startOver}>Start Over</button>
    </section>
  {/if}

  {#if isCancelled}
    <section class="result-panel cancel-panel">
      <div class="result-icon">✖</div>
      <h2>Cancelled</h2>
      <p>No address was saved.</p>
      <button class="btn-secondary" onclick={startOver}>Try Again</button>
    </section>
  {/if}

  {#if !isCompleted && !isCancelled}
    <PathShell
      path={addressPath}
      initialData={INITIAL_DATA}
      completeLabel="Save Address"
      cancelLabel="Cancel"
      validationDisplay="inline"
      oncomplete={handleComplete}
      oncancel={handleCancel}
      country={CountryStep}
      addressUs={USAddressForm}
      addressIe={IrishAddressForm}
      confirm={ConfirmStep}
    />
  {/if}
</main>
