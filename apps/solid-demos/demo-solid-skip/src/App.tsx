import { createSignal, Show } from "solid-js";
import { PathShell } from "@daltonr/pathwrite-solid";
import type { PathData } from "@daltonr/pathwrite-solid";
import { subscriptionPath, INITIAL_DATA, PLAN_LABELS, type SubscriptionData } from "./subscription";
import SelectPlanStep from "./SelectPlanStep";
import ShippingAddressStep from "./ShippingAddressStep";
import PaymentStep from "./PaymentStep";
import BillingAddressStep from "./BillingAddressStep";
import ReviewStep from "./ReviewStep";

export default function App() {
  const [isCompleted, setIsCompleted] = createSignal(false);
  const [isCancelled, setIsCancelled] = createSignal(false);
  const [completedData, setCompletedData] = createSignal<SubscriptionData | null>(null);

  function handleComplete(data: PathData) {
    setCompletedData(data as SubscriptionData);
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
        <h1>Subscription Signup</h1>
        <p class="subtitle">
          Skip demo — Free plan skips payment and billing steps automatically.
        </p>
      </div>

      <Show when={isCompleted() && completedData()}>
        {(_) => {
          const d = completedData()!;
          return (
            <section class="result-panel success-panel">
              <div class="result-icon">✓</div>
              <h2>Subscription Active!</h2>
              <p>You're signed up for the {PLAN_LABELS[d.plan] ?? d.plan} plan.</p>
              <div class="review-section">
                <p class="section-title">Plan</p>
                <div class="review-card">
                  <div class="review-row">
                    <span class="review-key">Plan</span>
                    <span>{PLAN_LABELS[d.plan] ?? d.plan}</span>
                  </div>
                </div>
              </div>
              <div class="review-section">
                <p class="section-title">Shipping</p>
                <div class="review-card">
                  <div class="review-row">
                    <span class="review-key">Name</span>
                    <span>{d.shippingName}</span>
                  </div>
                  <div class="review-row">
                    <span class="review-key">Address</span>
                    <span>{d.shippingAddress}</span>
                  </div>
                  <div class="review-row">
                    <span class="review-key">City</span>
                    <span>{d.shippingCity}</span>
                  </div>
                  <div class="review-row">
                    <span class="review-key">Postcode</span>
                    <span>{d.shippingPostcode}</span>
                  </div>
                </div>
              </div>
              <Show when={d.plan === "paid"}>
                <div class="review-section">
                  <p class="section-title">Payment</p>
                  <div class="review-card">
                    <div class="review-row">
                      <span class="review-key">Card</span>
                      <span>**** **** **** {d.cardNumber.slice(-4)}</span>
                    </div>
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
          <h2>Signup Cancelled</h2>
          <p>Your signup was cancelled. No charges have been made.</p>
          <button class="btn-secondary" onClick={startOver}>Start Over</button>
        </section>
      </Show>

      <Show when={!isCompleted() && !isCancelled()}>
        <PathShell
          path={subscriptionPath}
          initialData={INITIAL_DATA}
          onComplete={handleComplete}
          onCancel={handleCancel}
          steps={{
            "select-plan": (snap) => <SelectPlanStep snapshot={snap} />,
            "shipping-address": (snap) => <ShippingAddressStep snapshot={snap} />,
            "payment": (snap) => <PaymentStep snapshot={snap} />,
            "billing-address": (snap) => <BillingAddressStep snapshot={snap} />,
            "review": (snap) => <ReviewStep snapshot={snap} />,
          }}
        />
      </Show>
    </main>
  );
}
