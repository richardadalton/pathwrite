import { createMemo } from "solid-js";
import { usePathContext } from "@daltonr/pathwrite-solid";
import type { PathSnapshot } from "@daltonr/pathwrite-core";
import type { SubscriptionData } from "./subscription";

interface Props {
  snapshot: PathSnapshot;
}

export default function BillingAddressStep(props: Props) {
  const { setData } = usePathContext<SubscriptionData>();
  const data = createMemo(() => props.snapshot.data as SubscriptionData);
  const errors = createMemo(() => props.snapshot.fieldErrors ?? {});

  return (
    <div class="form-body">
      <p class="step-intro">
        Enter your billing address. Fields are pre-filled from your shipping address via{" "}
        <code>onEnter</code>.
      </p>

      <div class={`field${errors().billingName ? " field--error" : ""}`}>
        <label for="billingName">
          Full Name <span class="required">*</span>
        </label>
        <input
          id="billingName"
          type="text"
          value={data().billingName}
          onInput={(e) => setData({ billingName: e.currentTarget.value })}
          placeholder="Jane Smith"
        />
        {errors().billingName && <span class="field-error">{errors().billingName}</span>}
      </div>

      <div class={`field${errors().billingAddress ? " field--error" : ""}`}>
        <label for="billingAddress">
          Street Address <span class="required">*</span>
        </label>
        <input
          id="billingAddress"
          type="text"
          value={data().billingAddress}
          onInput={(e) => setData({ billingAddress: e.currentTarget.value })}
          placeholder="123 Main St"
        />
        {errors().billingAddress && (
          <span class="field-error">{errors().billingAddress}</span>
        )}
      </div>

      <div class={`field${errors().billingCity ? " field--error" : ""}`}>
        <label for="billingCity">
          City <span class="required">*</span>
        </label>
        <input
          id="billingCity"
          type="text"
          value={data().billingCity}
          onInput={(e) => setData({ billingCity: e.currentTarget.value })}
          placeholder="Dublin"
        />
        {errors().billingCity && <span class="field-error">{errors().billingCity}</span>}
      </div>

      <div class={`field${errors().billingPostcode ? " field--error" : ""}`}>
        <label for="billingPostcode">
          Postcode <span class="required">*</span>
        </label>
        <input
          id="billingPostcode"
          type="text"
          value={data().billingPostcode}
          onInput={(e) => setData({ billingPostcode: e.currentTarget.value })}
          placeholder="D01 F5P2"
        />
        {errors().billingPostcode && (
          <span class="field-error">{errors().billingPostcode}</span>
        )}
      </div>
    </div>
  );
}
