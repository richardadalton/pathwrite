import { usePathContext } from "@daltonr/pathwrite-react";
import { US_STATES, type AddressData } from "./address-path";

export function USAddressForm() {
  const { snapshot, setData } = usePathContext<AddressData>();
  const snap   = snapshot!;
  const data   = snap.data;
  const errors = snap.hasAttemptedNext ? snap.fieldErrors : {};

  return (
    <div className="form-body">
      <div className={`field ${errors.streetAddress ? "field--error" : ""}`}>
        <label htmlFor="streetAddress">Street Address <span className="required">*</span></label>
        <input
          id="streetAddress"
          type="text"
          value={data.streetAddress ?? ""}
          onChange={e => setData("streetAddress", e.target.value)}
          placeholder="123 Main Street"
          autoComplete="address-line1"
          autoFocus
        />
        {errors.streetAddress && <span className="field-error">{errors.streetAddress}</span>}
      </div>

      <div className="field">
        <label htmlFor="aptUnit">Apt / Unit <span className="optional">(optional)</span></label>
        <input
          id="aptUnit"
          type="text"
          value={data.aptUnit ?? ""}
          onChange={e => setData("aptUnit", e.target.value)}
          placeholder="Apt 4B"
          autoComplete="address-line2"
        />
      </div>

      <div className="row">
        <div className={`field ${errors.city ? "field--error" : ""}`}>
          <label htmlFor="city">City <span className="required">*</span></label>
          <input
            id="city"
            type="text"
            value={data.city ?? ""}
            onChange={e => setData("city", e.target.value)}
            placeholder="Springfield"
            autoComplete="address-level2"
          />
          {errors.city && <span className="field-error">{errors.city}</span>}
        </div>

        <div className={`field ${errors.state ? "field--error" : ""}`}>
          <label htmlFor="state">State <span className="required">*</span></label>
          <select
            id="state"
            value={data.state ?? ""}
            onChange={e => setData("state", e.target.value)}
            autoComplete="address-level1"
          >
            <option value="">Select state…</option>
            {US_STATES.map(s => (
              <option key={s.code} value={s.code}>{s.name}</option>
            ))}
          </select>
          {errors.state && <span className="field-error">{errors.state}</span>}
        </div>
      </div>

      <div className="field field--short">
        <label htmlFor="zipCode">ZIP Code <span className="required">*</span></label>
        <input
          id="zipCode"
          type="text"
          value={data.zipCode ?? ""}
          onChange={e => setData("zipCode", e.target.value)}
          placeholder="90210"
          autoComplete="postal-code"
          maxLength={10}
        />
        {errors.zipCode && <span className="field-error">{errors.zipCode}</span>}
      </div>
    </div>
  );
}
