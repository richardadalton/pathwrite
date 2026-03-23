import { usePathContext } from "@daltonr/pathwrite-react";
import { PLAN_LABELS, type SubscriptionData } from "./subscription";

export function ReviewStep() {
  const { snapshot } = usePathContext<SubscriptionData>();
  const data = snapshot!.data;

  const billingLabel = data.plan === "free" ? "N/A (Free plan)"
    : data.billingSameAsShipping ? "Same as shipping"
    : `${data.billingName}, ${data.billingAddress}, ${data.billingCity} ${data.billingPostcode}`;

  return (
    <div className="form-body">
      <div className="review-section">
        <p className="section-title">Plan</p>
        <div className="review-card">
          <div className="review-row">
            <span className="review-key">Selected Plan</span>
            <span><span className={`plan-badge ${data.plan === "paid" ? "plan-badge--pro" : "plan-badge--free"}`}>{PLAN_LABELS[data.plan] ?? data.plan}</span></span>
          </div>
        </div>
      </div>

      <div className="review-section">
        <p className="section-title">Shipping Address</p>
        <div className="review-card">
          <div className="review-row"><span className="review-key">Name</span><span>{data.shippingName as string}</span></div>
          <div className="review-row"><span className="review-key">Address</span><span>{data.shippingAddress as string}</span></div>
          <div className="review-row"><span className="review-key">City</span><span>{data.shippingCity as string}</span></div>
          <div className="review-row"><span className="review-key">Postcode</span><span>{data.shippingPostcode as string}</span></div>
        </div>
      </div>

      {data.plan === "paid" && (
        <div className="review-section">
          <p className="section-title">Payment</p>
          <div className="review-card">
            <div className="review-row"><span className="review-key">Card</span><span>•••• {(data.cardNumber as string).slice(-4)}</span></div>
            <div className="review-row"><span className="review-key">Expiry</span><span>{data.cardExpiry as string}</span></div>
          </div>
        </div>
      )}

      {data.plan === "paid" && (
        <div className="review-section">
          <p className="section-title">Billing Address</p>
          <div className="review-card">
            <div className="review-row"><span className="review-key">Billing</span><span>{billingLabel}</span></div>
            {!data.billingSameAsShipping && (<>
              <div className="review-row"><span className="review-key">Name</span><span>{data.billingName as string}</span></div>
              <div className="review-row"><span className="review-key">Address</span><span>{data.billingAddress as string}</span></div>
              <div className="review-row"><span className="review-key">City</span><span>{data.billingCity as string}</span></div>
              <div className="review-row"><span className="review-key">Postcode</span><span>{data.billingPostcode as string}</span></div>
            </>)}
          </div>
        </div>
      )}

      <div className="skip-summary">
        <p className="skip-summary__title">Steps in this flow</p>
        <ul className="skip-summary__list">
          <li>✓ Select Plan</li>
          <li>✓ Shipping Address</li>
          <li className={data.plan === "free" ? "skip-summary__skipped" : ""}>{data.plan === "free" ? "⏭ Payment Details (skipped)" : "✓ Payment Details"}</li>
          <li className={data.plan === "free" || data.billingSameAsShipping ? "skip-summary__skipped" : ""}>
            {data.plan === "free" ? "⏭ Billing Address (skipped — free plan)" : data.billingSameAsShipping ? "⏭ Billing Address (skipped — same as shipping)" : "✓ Billing Address"}
          </li>
          <li className="skip-summary__current">● Review (you are here)</li>
        </ul>
      </div>
    </div>
  );
}

