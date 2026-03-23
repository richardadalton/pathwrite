import { usePathContext } from "@daltonr/pathwrite-react";
import type { SubscriptionData } from "./subscription";

export function ShippingAddressStep() {
  const { snapshot, setData } = usePathContext<SubscriptionData>();
  const snap   = snapshot!;
  const data   = snap.data;
  const errors = snap.hasAttemptedNext ? snap.fieldMessages : {};

  return (
    <div className="form-body">
      <p className="step-intro">Where should we ship your welcome kit?</p>

      <div className={`field ${errors.shippingName ? "field--error" : ""}`}>
        <label htmlFor="shippingName">Full Name <span className="required">*</span></label>
        <input id="shippingName" type="text" value={data.shippingName ?? ""} autoFocus
          onChange={e => setData("shippingName", e.target.value)} placeholder="Jane Smith" autoComplete="name" />
        {errors.shippingName && <span className="field-error">{errors.shippingName}</span>}
      </div>

      <div className={`field ${errors.shippingAddress ? "field--error" : ""}`}>
        <label htmlFor="shippingAddress">Street Address <span className="required">*</span></label>
        <input id="shippingAddress" type="text" value={data.shippingAddress ?? ""}
          onChange={e => setData("shippingAddress", e.target.value)} placeholder="123 Main St" autoComplete="street-address" />
        {errors.shippingAddress && <span className="field-error">{errors.shippingAddress}</span>}
      </div>

      <div className="row">
        <div className={`field ${errors.shippingCity ? "field--error" : ""}`}>
          <label htmlFor="shippingCity">City <span className="required">*</span></label>
          <input id="shippingCity" type="text" value={data.shippingCity ?? ""}
            onChange={e => setData("shippingCity", e.target.value)} placeholder="Dublin" autoComplete="address-level2" />
          {errors.shippingCity && <span className="field-error">{errors.shippingCity}</span>}
        </div>
        <div className={`field ${errors.shippingPostcode ? "field--error" : ""}`}>
          <label htmlFor="shippingPostcode">Postcode <span className="required">*</span></label>
          <input id="shippingPostcode" type="text" value={data.shippingPostcode ?? ""}
            onChange={e => setData("shippingPostcode", e.target.value)} placeholder="D01 AB12" autoComplete="postal-code" />
          {errors.shippingPostcode && <span className="field-error">{errors.shippingPostcode}</span>}
        </div>
      </div>

      {data.plan === "paid" && (
        <div className="toggle-option">
          <div className="toggle-text">
            <strong>Billing same as shipping</strong>
            <span>Use this address for billing too</span>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={!!data.billingSameAsShipping}
              onChange={e => setData("billingSameAsShipping", e.target.checked)} />
            <span className="toggle-track" />
            <span className="toggle-thumb" />
          </label>
        </div>
      )}

      {data.plan === "paid" && data.billingSameAsShipping && (
        <p className="plan-note">ℹ️ Billing address step will be skipped — using shipping address.</p>
      )}
    </div>
  );
}

