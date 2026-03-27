import { usePathContext } from "@daltonr/pathwrite-react";
import { US_STATES, type AddressData } from "./address-path";

export function ConfirmStep() {
  const { snapshot } = usePathContext<AddressData>();
  const data = snapshot!.data;

  const isUS = data.country === "US";
  const stateName = US_STATES.find(s => s.code === data.state)?.name ?? data.state;

  return (
    <div className="form-body">
      <p className="step-intro">Please review your address before submitting.</p>

      <div className="confirm-card">
        <div className="confirm-section">
          <p className="confirm-label">Country</p>
          <p className="confirm-value">{isUS ? "🇺🇸 United States" : "🇮🇪 Ireland"}</p>
        </div>

        <div className="confirm-divider" />

        <div className="confirm-section">
          <p className="confirm-label">Address</p>
          {isUS ? (
            <div className="confirm-address">
              <p>{data.streetAddress}{data.aptUnit ? `, ${data.aptUnit}` : ""}</p>
              <p>{data.city}, {data.state} {data.zipCode}</p>
              <p>United States</p>
            </div>
          ) : (
            <div className="confirm-address">
              <p>{data.addressLine1}</p>
              {data.addressLine2 && <p>{data.addressLine2}</p>}
              <p>{data.town}</p>
              <p>Co. {data.county}{data.eircode ? `, ${data.eircode}` : ""}</p>
              <p>Ireland</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
