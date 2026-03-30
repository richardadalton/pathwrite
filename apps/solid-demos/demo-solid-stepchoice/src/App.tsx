import { createSignal, Show } from "solid-js";
import { PathShell } from "@daltonr/pathwrite-solid";
import type { PathData } from "@daltonr/pathwrite-solid";
import { addressPath, INITIAL_DATA, type AddressData } from "./address-path";
import CountryStep from "./CountryStep";
import USAddressForm from "./USAddressForm";
import IrishAddressForm from "./IrishAddressForm";
import ConfirmStep from "./ConfirmStep";

const COUNTRY_NAMES: Record<string, string> = { US: "United States", IE: "Ireland" };

export default function App() {
  const [isCompleted, setIsCompleted] = createSignal(false);
  const [isCancelled, setIsCancelled] = createSignal(false);
  const [completedData, setCompletedData] = createSignal<AddressData | null>(null);

  function handleComplete(data: PathData) {
    setCompletedData(data as AddressData);
    setIsCompleted(true);
  }

  function handleCancel() {
    setIsCancelled(true);
  }

  function startOver() {
    setIsCompleted(false);
    setIsCancelled(false);
    setCompletedData(null);
  }

  return (
    <main class="page">
      <div class="page-header">
        <h1>Address Form</h1>
        <p class="subtitle">
          StepChoice demo — the address step selects US or Irish fields based on your country
          selection.
        </p>
      </div>

      <Show when={isCompleted() && completedData()}>
        {(_) => {
          const d = completedData()!;
          return (
            <section class="result-panel success-panel">
              <div class="result-icon">✓</div>
              <h2>Address Saved!</h2>
              <p>Your {COUNTRY_NAMES[d.country] ?? d.country} address has been saved.</p>
              <div class="review-section">
                <p class="section-title">Country</p>
                <div class="review-card">
                  <div class="review-row">
                    <span class="review-key">Country</span>
                    <span>{COUNTRY_NAMES[d.country] ?? d.country}</span>
                  </div>
                </div>
              </div>
              <Show when={d.country === "US"}>
                <div class="review-section">
                  <p class="section-title">Address</p>
                  <div class="review-card">
                    <div class="review-row">
                      <span class="review-key">Street</span>
                      <span>
                        {d.streetAddress}
                        {d.aptUnit ? `, ${d.aptUnit}` : ""}
                      </span>
                    </div>
                    <div class="review-row">
                      <span class="review-key">City</span>
                      <span>{d.city}</span>
                    </div>
                    <div class="review-row">
                      <span class="review-key">State</span>
                      <span>{d.state}</span>
                    </div>
                    <div class="review-row">
                      <span class="review-key">ZIP</span>
                      <span>{d.zipCode}</span>
                    </div>
                  </div>
                </div>
              </Show>
              <Show when={d.country === "IE"}>
                <div class="review-section">
                  <p class="section-title">Address</p>
                  <div class="review-card">
                    <div class="review-row">
                      <span class="review-key">Line 1</span>
                      <span>{d.addressLine1}</span>
                    </div>
                    <Show when={d.addressLine2}>
                      <div class="review-row">
                        <span class="review-key">Line 2</span>
                        <span>{d.addressLine2}</span>
                      </div>
                    </Show>
                    <div class="review-row">
                      <span class="review-key">Town / City</span>
                      <span>{d.town}</span>
                    </div>
                    <div class="review-row">
                      <span class="review-key">County</span>
                      <span>{d.county}</span>
                    </div>
                    <Show when={d.eircode}>
                      <div class="review-row">
                        <span class="review-key">Eircode</span>
                        <span>{d.eircode}</span>
                      </div>
                    </Show>
                  </div>
                </div>
              </Show>
              <button class="btn-primary" onClick={startOver}>Start Over</button>
            </section>
          );
        }}
      </Show>

      <Show when={isCancelled()}>
        <section class="result-panel cancel-panel">
          <div class="result-icon">✕</div>
          <h2>Cancelled</h2>
          <p>The address form was cancelled.</p>
          <button class="btn-secondary" onClick={startOver}>Start Over</button>
        </section>
      </Show>

      <Show when={!isCompleted() && !isCancelled()}>
        <PathShell
          path={addressPath}
          initialData={INITIAL_DATA}
          onComplete={handleComplete}
          onCancel={handleCancel}
          steps={{
            "country": (snap) => <CountryStep snapshot={snap} />,
            "address-us": (snap) => <USAddressForm snapshot={snap} />,
            "address-ie": (snap) => <IrishAddressForm snapshot={snap} />,
            "confirm": (snap) => <ConfirmStep snapshot={snap} />,
          }}
        />
      </Show>
    </main>
  );
}
