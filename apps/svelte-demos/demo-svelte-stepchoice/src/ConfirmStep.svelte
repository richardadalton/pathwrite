<script lang="ts">
  import { usePathContext } from "@daltonr/pathwrite-svelte";
  import type { AddressData } from "./address-path";

  const ctx = usePathContext<AddressData>();

  const COUNTRY_NAMES: Record<string, string> = { US: "United States", IE: "Ireland" };
</script>

{#if ctx.snapshot}
  {@const d = ctx.snapshot.data}
  <div class="form-body">
    <p class="step-intro">
      Review your address below. Click <strong>Save Address</strong> to confirm,
      or use <strong>Previous</strong> to make changes.
    </p>

    <div>
      <p class="confirm-section-title">Selected Country</p>
      <div class="confirm-card">
        <div class="confirm-row">
          <span class="confirm-key">Country</span>
          <span>{COUNTRY_NAMES[d.country] ?? d.country}</span>
        </div>
      </div>
    </div>

    {#if d.country === "US"}
      <div>
        <p class="confirm-section-title">US Address</p>
        <div class="confirm-card">
          <div class="confirm-row">
            <span class="confirm-key">Street</span>
            <span>{d.streetAddress}{d.aptUnit ? `, ${d.aptUnit}` : ""}</span>
          </div>
          <div class="confirm-row">
            <span class="confirm-key">City</span>
            <span>{d.city}</span>
          </div>
          <div class="confirm-row">
            <span class="confirm-key">State</span>
            <span>{d.state}</span>
          </div>
          <div class="confirm-row">
            <span class="confirm-key">ZIP Code</span>
            <span>{d.zipCode}</span>
          </div>
        </div>
      </div>
    {:else}
      <div>
        <p class="confirm-section-title">Irish Address</p>
        <div class="confirm-card">
          <div class="confirm-row">
            <span class="confirm-key">Address Line 1</span>
            <span>{d.addressLine1}</span>
          </div>
          {#if d.addressLine2}
            <div class="confirm-row">
              <span class="confirm-key">Address Line 2</span>
              <span>{d.addressLine2}</span>
            </div>
          {/if}
          <div class="confirm-row">
            <span class="confirm-key">Town / City</span>
            <span>{d.town}</span>
          </div>
          <div class="confirm-row">
            <span class="confirm-key">County</span>
            <span>{d.county}</span>
          </div>
          {#if d.eircode}
            <div class="confirm-row">
              <span class="confirm-key">Eircode</span>
              <span>{d.eircode}</span>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/if}
