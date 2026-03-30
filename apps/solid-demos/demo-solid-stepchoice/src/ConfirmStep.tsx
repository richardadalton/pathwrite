import { createMemo, Show } from "solid-js";
import type { PathSnapshot } from "@daltonr/pathwrite-core";
import type { AddressData } from "./address-path";

interface Props {
  snapshot: PathSnapshot;
}

const COUNTRY_NAMES: Record<string, string> = { US: "United States", IE: "Ireland" };

export default function ConfirmStep(props: Props) {
  const data = createMemo(() => props.snapshot.data as AddressData);
  const isUS = createMemo(() => data().country === "US");

  return (
    <div class="form-body">
      <p class="step-intro">
        Please review your address before confirming. The form used the{" "}
        <code>select</code> field to show the correct address variant for your country.
      </p>

      <div class="review-section">
        <p class="section-title">Country</p>
        <div class="review-card">
          <div class="review-row">
            <span class="review-key">Country</span>
            <span>{COUNTRY_NAMES[data().country] ?? data().country}</span>
          </div>
        </div>
      </div>

      <Show when={isUS()}>
        <div class="review-section">
          <p class="section-title">US Address</p>
          <div class="review-card">
            <div class="review-row">
              <span class="review-key">Street</span>
              <span>
                {data().streetAddress}
                {data().aptUnit ? `, ${data().aptUnit}` : ""}
              </span>
            </div>
            <div class="review-row">
              <span class="review-key">City</span>
              <span>{data().city}</span>
            </div>
            <div class="review-row">
              <span class="review-key">State</span>
              <span>{data().state}</span>
            </div>
            <div class="review-row">
              <span class="review-key">ZIP Code</span>
              <span>{data().zipCode}</span>
            </div>
          </div>
        </div>
      </Show>

      <Show when={!isUS()}>
        <div class="review-section">
          <p class="section-title">Irish Address</p>
          <div class="review-card">
            <div class="review-row">
              <span class="review-key">Address Line 1</span>
              <span>{data().addressLine1}</span>
            </div>
            <Show when={data().addressLine2}>
              <div class="review-row">
                <span class="review-key">Address Line 2</span>
                <span>{data().addressLine2}</span>
              </div>
            </Show>
            <div class="review-row">
              <span class="review-key">Town / City</span>
              <span>{data().town}</span>
            </div>
            <div class="review-row">
              <span class="review-key">County</span>
              <span>{data().county}</span>
            </div>
            <Show when={data().eircode}>
              <div class="review-row">
                <span class="review-key">Eircode</span>
                <span>{data().eircode}</span>
              </div>
            </Show>
          </div>
        </div>
      </Show>

      <p class="hint">
        Clicking <strong>Finish</strong> will complete the path. The <code>address</code> step
        used <code>select</code> to route to <code>{isUS() ? "address-us" : "address-ie"}</code>{" "}
        based on your country choice.
      </p>
    </div>
  );
}
