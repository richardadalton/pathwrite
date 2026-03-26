import { usePathContext } from "@daltonr/pathwrite-react";
import type { SubscriptionData } from "./subscription";

export function BillingAddressStep() {
  const { snapshot, setData } = usePathContext<SubscriptionData>();
  const snap   = snapshot!;
  const data   = snap.data;
  const errors = snap.hasAttemptedNext ? snap.fieldErrors : {};

  return (
    <div className="form-body">
      <p className="step-intro">Enter a separate billing address for your Pro subscription.</p>

      <div className={`field ${errors.billingName ? "field--error" : ""}`}>
        <label htmlFor="billingName">Full Name <span className="required">*</span></label>
        <input id="billingName" type="text" value={data.billingName ?? ""} autoFocus
          onChange={e => setData("billingName", e.target.value)} placeholder="Jane Smith" autoComplete="name" />
        {errors.billingName && <span className="field-error">{errors.billingName}</span>}
      </div>

      <div className={`field ${errors.billingAddress ? "field--error" : ""}`}>
        <label htmlFor="billingAddress">Street Address <span className="required">*</span></label>
        <input id="billingAddress" type="text" value={data.billingAddress ?? ""}
          onChange={e => setData("billingAddress", e.target.value)} placeholder="456 Billing Rd" autoComplete="street-address" />
        {errors.billingAddress && <span className="field-error">{errors.billingAddress}</span>}
      </div>

      <div className="row">
        <div className={`field ${errors.billingCity ? "field--error" : ""}`}>
          <label htmlFor="billingCity">City <span className="required">*</span></label>
          <input id="billingCity" type="text" value={data.billingCity ?? ""}
            onChange={e => setData("billingCity", e.target.value)} placeholder="Dublin" autoComplete="address-level2" />
          {errors.billingCity && <span className="field-error">{errors.billingCity}</span>}
        </div>
        <div className={`field ${errors.billingPostcode ? "field--error" : ""}`}>
          <label htmlFor="billingPostcode">Postcode <span className="required">*</span></label>
          <input id="billingPostcode" type="text" value={data.billingPostcode ?? ""}
            onChange={e => setData("billingPostcode", e.target.value)} placeholder="D02 XY34" autoComplete="postal-code" />
          {errors.billingPostcode && <span className="field-error">{errors.billingPostcode}</span>}
        </div>
      </div>
    </div>
  );
}

