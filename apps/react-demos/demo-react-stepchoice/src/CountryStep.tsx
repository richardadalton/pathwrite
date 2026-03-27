import { usePathContext } from "@daltonr/pathwrite-react";
import type { AddressData } from "./address-path";

const COUNTRIES = [
  { code: "US", label: "United States" },
  { code: "IE", label: "Ireland" },
];

export function CountryStep() {
  const { snapshot, setData } = usePathContext<AddressData>();
  const snap   = snapshot!;
  const data   = snap.data;
  const errors = snap.hasAttemptedNext ? snap.fieldErrors : {};

  return (
    <div className="form-body">
      <p className="step-intro">Where are you based? We'll show you the right address form on the next step.</p>

      <div className="country-grid">
        {COUNTRIES.map(({ code, label }) => (
          <label key={code} className={`country-card ${data.country === code ? "country-card--selected" : ""}`}>
            <input
              type="radio"
              name="country"
              value={code}
              checked={data.country === code}
              onChange={() => setData("country", code)}
            />
            <span className="country-flag">{code === "US" ? "🇺🇸" : "🇮🇪"}</span>
            <span className="country-name">{label}</span>
          </label>
        ))}
      </div>

      {errors.country && <span className="field-error">{errors.country}</span>}
    </div>
  );
}
