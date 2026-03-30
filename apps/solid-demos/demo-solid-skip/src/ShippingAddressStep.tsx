import { createMemo } from "solid-js";
import { usePathContext } from "@daltonr/pathwrite-solid";
import type { PathSnapshot } from "@daltonr/pathwrite-core";
import type { SubscriptionData } from "./subscription";

interface Props {
  snapshot: PathSnapshot;
}

export default function ShippingAddressStep(props: Props) {
  const { setData } = usePathContext<SubscriptionData>();
  const data = createMemo(() => props.snapshot.data as SubscriptionData);
  const errors = createMemo(() => props.snapshot.fieldErrors ?? {});

  return (
    <div class="form-body">
      <p class="step-intro">Enter your shipping address.</p>

      <div class={`field${errors().shippingName ? " field--error" : ""}`}>
        <label for="shippingName">
          Full Name <span class="required">*</span>
        </label>
        <input
          id="shippingName"
          type="text"
          value={data().shippingName}
          onInput={(e) => setData({ shippingName: e.currentTarget.value })}
          placeholder="Jane Smith"
        />
        {errors().shippingName && <span class="field-error">{errors().shippingName}</span>}
      </div>

      <div class={`field${errors().shippingAddress ? " field--error" : ""}`}>
        <label for="shippingAddress">
          Street Address <span class="required">*</span>
        </label>
        <input
          id="shippingAddress"
          type="text"
          value={data().shippingAddress}
          onInput={(e) => setData({ shippingAddress: e.currentTarget.value })}
          placeholder="123 Main St"
        />
        {errors().shippingAddress && (
          <span class="field-error">{errors().shippingAddress}</span>
        )}
      </div>

      <div class={`field${errors().shippingCity ? " field--error" : ""}`}>
        <label for="shippingCity">
          City <span class="required">*</span>
        </label>
        <input
          id="shippingCity"
          type="text"
          value={data().shippingCity}
          onInput={(e) => setData({ shippingCity: e.currentTarget.value })}
          placeholder="Dublin"
        />
        {errors().shippingCity && <span class="field-error">{errors().shippingCity}</span>}
      </div>

      <div class={`field${errors().shippingPostcode ? " field--error" : ""}`}>
        <label for="shippingPostcode">
          Postcode <span class="required">*</span>
        </label>
        <input
          id="shippingPostcode"
          type="text"
          value={data().shippingPostcode}
          onInput={(e) => setData({ shippingPostcode: e.currentTarget.value })}
          placeholder="D01 F5P2"
        />
        {errors().shippingPostcode && (
          <span class="field-error">{errors().shippingPostcode}</span>
        )}
      </div>

      <div class="field">
        <label class="radio-option" style={{ "border-radius": "8px" }}>
          <input
            type="checkbox"
            checked={data().billingSameAsShipping}
            onChange={(e) => setData({ billingSameAsShipping: e.currentTarget.checked })}
          />
          <span class="radio-option-label">Billing address same as shipping</span>
        </label>
        <p class="skip-note">
          {data().billingSameAsShipping
            ? "Billing address step will be skipped."
            : "You will be asked for a separate billing address."}
        </p>
      </div>
    </div>
  );
}
