import { createMemo } from "solid-js";
import { usePathContext } from "@daltonr/pathwrite-solid";
import type { PathSnapshot } from "@daltonr/pathwrite-core";
import type { AddressData } from "./address-path";
import { US_STATES } from "./address-path";

interface Props {
  snapshot: PathSnapshot;
}

export default function USAddressForm(props: Props) {
  const { setData } = usePathContext<AddressData>();
  const data = createMemo(() => props.snapshot.data as AddressData);
  const errors = createMemo(() => props.snapshot.fieldErrors ?? {});

  return (
    <div class="form-body">
      <p class="step-intro">Enter your US address.</p>

      <div class={`field${errors().streetAddress ? " field--error" : ""}`}>
        <label for="streetAddress">
          Street Address <span class="required">*</span>
        </label>
        <input
          id="streetAddress"
          type="text"
          value={data().streetAddress}
          onInput={(e) => setData({ streetAddress: e.currentTarget.value })}
          placeholder="123 Main St"
        />
        {errors().streetAddress && (
          <span class="field-error">{errors().streetAddress}</span>
        )}
      </div>

      <div class="field">
        <label for="aptUnit">
          Apt / Unit <span class="optional">(optional)</span>
        </label>
        <input
          id="aptUnit"
          type="text"
          value={data().aptUnit}
          onInput={(e) => setData({ aptUnit: e.currentTarget.value })}
          placeholder="Apt 4B"
        />
      </div>

      <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "16px" }}>
        <div class={`field${errors().city ? " field--error" : ""}`}>
          <label for="city">
            City <span class="required">*</span>
          </label>
          <input
            id="city"
            type="text"
            value={data().city}
            onInput={(e) => setData({ city: e.currentTarget.value })}
            placeholder="Los Angeles"
          />
          {errors().city && <span class="field-error">{errors().city}</span>}
        </div>

        <div class={`field${errors().state ? " field--error" : ""}`}>
          <label for="state">
            State <span class="required">*</span>
          </label>
          <select
            id="state"
            value={data().state}
            onChange={(e) => setData({ state: e.currentTarget.value })}
          >
            <option value="">Select state…</option>
            {US_STATES.map((s) => (
              <option value={s.code}>{s.name}</option>
            ))}
          </select>
          {errors().state && <span class="field-error">{errors().state}</span>}
        </div>
      </div>

      <div class={`field${errors().zipCode ? " field--error" : ""}`}>
        <label for="zipCode">
          ZIP Code <span class="required">*</span>
        </label>
        <input
          id="zipCode"
          type="text"
          value={data().zipCode}
          onInput={(e) => setData({ zipCode: e.currentTarget.value })}
          placeholder="90210"
          maxLength={10}
        />
        {errors().zipCode && <span class="field-error">{errors().zipCode}</span>}
      </div>
    </div>
  );
}
