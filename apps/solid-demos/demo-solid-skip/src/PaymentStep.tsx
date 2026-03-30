import { createMemo } from "solid-js";
import { usePathContext } from "@daltonr/pathwrite-solid";
import type { PathSnapshot } from "@daltonr/pathwrite-core";
import type { SubscriptionData } from "./subscription";

interface Props {
  snapshot: PathSnapshot;
}

export default function PaymentStep(props: Props) {
  const { setData } = usePathContext<SubscriptionData>();
  const data = createMemo(() => props.snapshot.data as SubscriptionData);
  const errors = createMemo(() => props.snapshot.fieldErrors ?? {});

  return (
    <div class="form-body">
      <p class="step-intro">Enter your payment details. This step is only shown for paid plans.</p>

      <div class={`field${errors().cardNumber ? " field--error" : ""}`}>
        <label for="cardNumber">
          Card Number <span class="required">*</span>
        </label>
        <input
          id="cardNumber"
          type="text"
          value={data().cardNumber}
          onInput={(e) => setData({ cardNumber: e.currentTarget.value })}
          placeholder="4242 4242 4242 4242"
          maxLength={19}
        />
        {errors().cardNumber && <span class="field-error">{errors().cardNumber}</span>}
      </div>

      <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: "16px" }}>
        <div class={`field${errors().cardExpiry ? " field--error" : ""}`}>
          <label for="cardExpiry">
            Expiry <span class="required">*</span>
          </label>
          <input
            id="cardExpiry"
            type="text"
            value={data().cardExpiry}
            onInput={(e) => setData({ cardExpiry: e.currentTarget.value })}
            placeholder="MM / YY"
            maxLength={7}
          />
          {errors().cardExpiry && <span class="field-error">{errors().cardExpiry}</span>}
        </div>

        <div class={`field${errors().cardCvc ? " field--error" : ""}`}>
          <label for="cardCvc">
            CVC <span class="required">*</span>
          </label>
          <input
            id="cardCvc"
            type="text"
            value={data().cardCvc}
            onInput={(e) => setData({ cardCvc: e.currentTarget.value })}
            placeholder="123"
            maxLength={4}
          />
          {errors().cardCvc && <span class="field-error">{errors().cardCvc}</span>}
        </div>
      </div>

      <p class="hint">
        This is a demo — use any values. Real payment processing is not performed.
      </p>
    </div>
  );
}
