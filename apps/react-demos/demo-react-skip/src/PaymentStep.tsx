import { usePathContext } from "@daltonr/pathwrite-react";
import type { SubscriptionData } from "./subscription";

export function PaymentStep() {
  const { snapshot, setData } = usePathContext<SubscriptionData>();
  const snap   = snapshot!;
  const data   = snap.data;
  const errors = snap.hasAttemptedNext ? snap.fieldMessages : {};

  return (
    <div className="form-body">
      <p className="step-intro">Enter your payment details for the Pro plan.</p>

      <div className={`field ${errors.cardNumber ? "field--error" : ""}`}>
        <label htmlFor="cardNumber">Card Number <span className="required">*</span></label>
        <input id="cardNumber" type="text" value={data.cardNumber ?? ""} autoFocus
          onChange={e => setData("cardNumber", e.target.value)} placeholder="4242 4242 4242 4242" autoComplete="cc-number" />
        {errors.cardNumber && <span className="field-error">{errors.cardNumber}</span>}
      </div>

      <div className="row">
        <div className={`field ${errors.cardExpiry ? "field--error" : ""}`}>
          <label htmlFor="cardExpiry">Expiry Date <span className="required">*</span></label>
          <input id="cardExpiry" type="text" value={data.cardExpiry ?? ""}
            onChange={e => setData("cardExpiry", e.target.value)} placeholder="MM/YY" autoComplete="cc-exp" />
          {errors.cardExpiry && <span className="field-error">{errors.cardExpiry}</span>}
        </div>
        <div className={`field ${errors.cardCvc ? "field--error" : ""}`}>
          <label htmlFor="cardCvc">CVC <span className="required">*</span></label>
          <input id="cardCvc" type="text" value={data.cardCvc ?? ""}
            onChange={e => setData("cardCvc", e.target.value)} placeholder="123" autoComplete="cc-csc" />
          {errors.cardCvc && <span className="field-error">{errors.cardCvc}</span>}
        </div>
      </div>
    </div>
  );
}

