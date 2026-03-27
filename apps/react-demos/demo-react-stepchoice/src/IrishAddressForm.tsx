import { usePathContext } from "@daltonr/pathwrite-react";
import { IE_COUNTIES, type AddressData } from "./address-path";

export function IrishAddressForm() {
  const { snapshot, setData } = usePathContext<AddressData>();
  const snap   = snapshot!;
  const data   = snap.data;
  const errors = snap.hasAttemptedNext ? snap.fieldErrors : {};

  return (
    <div className="form-body">
      <div className={`field ${errors.addressLine1 ? "field--error" : ""}`}>
        <label htmlFor="addressLine1">Address Line 1 <span className="required">*</span></label>
        <input
          id="addressLine1"
          type="text"
          value={data.addressLine1 ?? ""}
          onChange={e => setData("addressLine1", e.target.value)}
          placeholder="12 O'Connell Street"
          autoComplete="address-line1"
          autoFocus
        />
        {errors.addressLine1 && <span className="field-error">{errors.addressLine1}</span>}
      </div>

      <div className="field">
        <label htmlFor="addressLine2">Address Line 2 <span className="optional">(optional)</span></label>
        <input
          id="addressLine2"
          type="text"
          value={data.addressLine2 ?? ""}
          onChange={e => setData("addressLine2", e.target.value)}
          placeholder="Apartment 3"
          autoComplete="address-line2"
        />
      </div>

      <div className="row">
        <div className={`field ${errors.town ? "field--error" : ""}`}>
          <label htmlFor="town">Town / City <span className="required">*</span></label>
          <input
            id="town"
            type="text"
            value={data.town ?? ""}
            onChange={e => setData("town", e.target.value)}
            placeholder="Dublin"
            autoComplete="address-level2"
          />
          {errors.town && <span className="field-error">{errors.town}</span>}
        </div>

        <div className={`field ${errors.county ? "field--error" : ""}`}>
          <label htmlFor="county">County <span className="required">*</span></label>
          <select
            id="county"
            value={data.county ?? ""}
            onChange={e => setData("county", e.target.value)}
            autoComplete="address-level1"
          >
            <option value="">Select county…</option>
            {IE_COUNTIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {errors.county && <span className="field-error">{errors.county}</span>}
        </div>
      </div>

      <div className="field field--short">
        <label htmlFor="eircode">Eircode <span className="optional">(optional)</span></label>
        <input
          id="eircode"
          type="text"
          value={data.eircode ?? ""}
          onChange={e => setData("eircode", e.target.value.toUpperCase())}
          placeholder="D01 F5P2"
          autoComplete="postal-code"
          maxLength={8}
        />
      </div>
    </div>
  );
}
