import { useState } from "react";
import { PathShell } from "@daltonr/pathwrite-react";
import { addressPath, INITIAL_DATA, type AddressData } from "./address-path";
import { CountryStep }      from "./CountryStep";
import { USAddressForm }    from "./USAddressForm";
import { IrishAddressForm } from "./IrishAddressForm";
import { ConfirmStep }      from "./ConfirmStep";

export default function App() {
  const [completed,  setCompleted]  = useState(false);
  const [cancelled,  setCancelled]  = useState(false);
  const [result, setResult] = useState<AddressData | null>(null);

  function startOver() {
    setCompleted(false);
    setCancelled(false);
    setResult(null);
  }

  return (
    <main className="page">
      <div className="page-header">
        <h1>Address Form</h1>
        <p className="subtitle">
          Demonstrates <code>StepChoice</code> — the address step automatically shows
          the right form based on your country selection.
        </p>
      </div>

      {completed && result && (
        <section className="result-panel success-panel">
          <div className="result-icon">✓</div>
          <h2>Address saved!</h2>
          <div className="summary">
            <div className="summary-section">
              <p className="summary-section__title">Your Address</p>
              {result.country === "US" ? (
                <>
                  <div className="summary-row"><span className="summary-key">Street</span><span>{result.streetAddress}{result.aptUnit ? `, ${result.aptUnit}` : ""}</span></div>
                  <div className="summary-row"><span className="summary-key">City</span><span>{result.city}</span></div>
                  <div className="summary-row"><span className="summary-key">State</span><span>{result.state}</span></div>
                  <div className="summary-row"><span className="summary-key">ZIP</span><span>{result.zipCode}</span></div>
                  <div className="summary-row"><span className="summary-key">Country</span><span>United States</span></div>
                </>
              ) : (
                <>
                  <div className="summary-row"><span className="summary-key">Line 1</span><span>{result.addressLine1}</span></div>
                  {result.addressLine2 && <div className="summary-row"><span className="summary-key">Line 2</span><span>{result.addressLine2}</span></div>}
                  <div className="summary-row"><span className="summary-key">Town</span><span>{result.town}</span></div>
                  <div className="summary-row"><span className="summary-key">County</span><span>{result.county}</span></div>
                  {result.eircode && <div className="summary-row"><span className="summary-key">Eircode</span><span>{result.eircode}</span></div>}
                  <div className="summary-row"><span className="summary-key">Country</span><span>Ireland</span></div>
                </>
              )}
            </div>
          </div>
          <button className="btn-primary" onClick={startOver}>Start Over</button>
        </section>
      )}

      {cancelled && (
        <section className="result-panel cancel-panel">
          <div className="result-icon">✕</div>
          <h2>Cancelled</h2>
          <p>No address was saved.</p>
          <button className="btn-secondary" onClick={startOver}>Try Again</button>
        </section>
      )}

      {!completed && !cancelled && (
        <PathShell
          path={addressPath}
          initialData={INITIAL_DATA}
          completeLabel="Save Address"
          cancelLabel="Cancel"
          validationDisplay="inline"
          onComplete={(data) => { setResult(data as AddressData); setCompleted(true); }}
          onCancel={() => setCancelled(true)}
          steps={{
            "country":    <CountryStep />,
            "address-us": <USAddressForm />,
            "address-ie": <IrishAddressForm />,
            "confirm":    <ConfirmStep />,
          }}
        />
      )}
    </main>
  );
}
