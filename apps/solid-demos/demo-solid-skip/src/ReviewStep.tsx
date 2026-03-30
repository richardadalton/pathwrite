import { createMemo, Show } from "solid-js";
import type { PathSnapshot } from "@daltonr/pathwrite-core";
import type { SubscriptionData } from "./subscription";
import { PLAN_LABELS } from "./subscription";

interface Props {
  snapshot: PathSnapshot;
}

export default function ReviewStep(props: Props) {
  const data = createMemo(() => props.snapshot.data as SubscriptionData);
  const isPaid = createMemo(() => data().plan === "paid");
  const hasSeparateBilling = createMemo(() => isPaid() && !data().billingSameAsShipping);

  return (
    <div class="form-body">
      <p class="step-intro">Please review your details before confirming.</p>

      <div class="review-section">
        <p class="section-title">Plan</p>
        <div class="review-card">
          <div class="review-row">
            <span class="review-key">Plan</span>
            <span>{PLAN_LABELS[data().plan] ?? data().plan}</span>
          </div>
        </div>
      </div>

      <div class="review-section">
        <p class="section-title">Shipping Address</p>
        <div class="review-card">
          <div class="review-row">
            <span class="review-key">Name</span>
            <span>{data().shippingName}</span>
          </div>
          <div class="review-row">
            <span class="review-key">Address</span>
            <span>{data().shippingAddress}</span>
          </div>
          <div class="review-row">
            <span class="review-key">City</span>
            <span>{data().shippingCity}</span>
          </div>
          <div class="review-row">
            <span class="review-key">Postcode</span>
            <span>{data().shippingPostcode}</span>
          </div>
        </div>
      </div>

      <Show when={isPaid()}>
        <div class="review-section">
          <p class="section-title">Payment</p>
          <div class="review-card">
            <div class="review-row">
              <span class="review-key">Card Number</span>
              <span>**** **** **** {data().cardNumber.slice(-4)}</span>
            </div>
            <div class="review-row">
              <span class="review-key">Expiry</span>
              <span>{data().cardExpiry}</span>
            </div>
          </div>
        </div>
      </Show>

      <Show when={hasSeparateBilling()}>
        <div class="review-section">
          <p class="section-title">Billing Address</p>
          <div class="review-card">
            <div class="review-row">
              <span class="review-key">Name</span>
              <span>{data().billingName}</span>
            </div>
            <div class="review-row">
              <span class="review-key">Address</span>
              <span>{data().billingAddress}</span>
            </div>
            <div class="review-row">
              <span class="review-key">City</span>
              <span>{data().billingCity}</span>
            </div>
            <div class="review-row">
              <span class="review-key">Postcode</span>
              <span>{data().billingPostcode}</span>
            </div>
          </div>
        </div>
      </Show>

      <Show when={!hasSeparateBilling() && isPaid()}>
        <div class="review-section">
          <p class="section-title">Billing Address</p>
          <div class="review-card">
            <div class="review-row">
              <span class="review-key">Billing</span>
              <span>Same as shipping address</span>
            </div>
          </div>
        </div>
      </Show>

      <Show when={!isPaid()}>
        <p class="hint">
          Payment and billing steps were <strong>skipped</strong> — the Free plan has no payment
          required. This is powered by <code>shouldSkip</code> on those steps.
        </p>
      </Show>
    </div>
  );
}
