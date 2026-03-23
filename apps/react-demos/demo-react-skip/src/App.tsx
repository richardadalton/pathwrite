import { useState } from "react";
import { PathShell } from "@daltonr/pathwrite-react";
import type { PathData } from "@daltonr/pathwrite-react";
import { subscriptionPath, INITIAL_DATA, PLAN_LABELS, type SubscriptionData } from "./subscription";
import { SelectPlanStep }      from "./SelectPlanStep";
import { ShippingAddressStep } from "./ShippingAddressStep";
import { PaymentStep }         from "./PaymentStep";
import { BillingAddressStep }  from "./BillingAddressStep";
import { ReviewStep }          from "./ReviewStep";

export default function App() {
  const [isCompleted,   setIsCompleted]   = useState(false);
  const [isCancelled,   setIsCancelled]   = useState(false);
  const [completedData, setCompletedData] = useState<SubscriptionData | null>(null);

  function handleComplete(data: PathData) { setCompletedData(data as SubscriptionData); setIsCompleted(true); }
  function handleCancel()  { setIsCancelled(true); }
  function startOver()     { setIsCompleted(false); setIsCancelled(false); setCompletedData(null); }

  return (
    <main className="page">
      <div className="page-header">
        <h1>Subscription Flow</h1>
        <p className="subtitle">Conditional steps demo — <code>shouldSkip</code> hides payment and billing steps for the Free plan.</p>
      </div>

      {isCompleted && completedData && (
        <section className="result-panel success-panel">
          <div className="result-icon">🎉</div>
          <h2>Subscription Complete!</h2>
          <p>You're signed up for the <strong>{PLAN_LABELS[completedData.plan] ?? completedData.plan}</strong> plan.</p>
          <div className="summary">
            <div className="summary-section">
              <p className="summary-section__title">Plan</p>
              <div className="summary-row"><span className="summary-key">Plan</span><span>{PLAN_LABELS[completedData.plan]}</span></div>
            </div>
            <div className="summary-section">
              <p className="summary-section__title">Shipping</p>
              <div className="summary-row"><span className="summary-key">Name</span><span>{completedData.shippingName}</span></div>
              <div className="summary-row"><span className="summary-key">Address</span><span>{completedData.shippingAddress}, {completedData.shippingCity} {completedData.shippingPostcode}</span></div>
            </div>
            {completedData.plan === "paid" && (
              <div className="summary-section">
                <p className="summary-section__title">Payment</p>
                <div className="summary-row"><span className="summary-key">Card</span><span>•••• {completedData.cardNumber.slice(-4)}</span></div>
              </div>
            )}
          </div>
          <button className="btn-primary" onClick={startOver}>Start Over</button>
        </section>
      )}

      {isCancelled && (
        <section className="result-panel cancel-panel">
          <div className="result-icon">✖</div>
          <h2>Subscription Cancelled</h2>
          <p>No subscription was created.</p>
          <button className="btn-secondary" onClick={startOver}>Try Again</button>
        </section>
      )}

      {!isCompleted && !isCancelled && (
        <PathShell
          path={subscriptionPath}
          initialData={INITIAL_DATA}
          completeLabel="Subscribe"
          cancelLabel="Cancel"
          onComplete={handleComplete}
          onCancel={handleCancel}
          steps={{
            "select-plan":       <SelectPlanStep />,
            "shipping-address":  <ShippingAddressStep />,
            "payment":           <PaymentStep />,
            "billing-address":   <BillingAddressStep />,
            "review":            <ReviewStep />,
          }}
        />
      )}
    </main>
  );
}

