import { usePathContext } from "@daltonr/pathwrite-react";
import type { SubscriptionData } from "./subscription";

export function SelectPlanStep() {
  const { snapshot, setData } = usePathContext<SubscriptionData>();
  const snap   = snapshot!;
  const data   = snap.data;
  const errors = snap.hasAttemptedNext ? snap.fieldMessages : {};

  return (
    <div className="form-body">
      <p className="step-intro">Choose the plan that's right for you. Free gets you started — upgrade anytime.</p>

      <div className="plan-options">
        <label className={`plan-card ${data.plan === "free" ? "plan-card--selected" : ""}`}>
          <input type="radio" name="plan" value="free" checked={data.plan === "free"} onChange={() => setData("plan", "free")} />
          <div className="plan-card__body">
            <span className="plan-card__name">Free</span>
            <span className="plan-card__price">$0 / month</span>
            <ul className="plan-card__features">
              <li>1 project</li><li>Community support</li><li>Basic analytics</li>
            </ul>
          </div>
        </label>

        <label className={`plan-card ${data.plan === "paid" ? "plan-card--selected" : ""}`}>
          <input type="radio" name="plan" value="paid" checked={data.plan === "paid"} onChange={() => setData("plan", "paid")} />
          <div className="plan-card__body">
            <span className="plan-card__name">Pro</span>
            <span className="plan-card__price">$29 / month</span>
            <ul className="plan-card__features">
              <li>Unlimited projects</li><li>Priority support</li><li>Advanced analytics</li><li>Custom branding</li>
            </ul>
          </div>
        </label>
      </div>

      {errors.plan && <span className="field-error">{errors.plan}</span>}
      {data.plan === "free" && <p className="plan-note">ℹ️ Free plan — payment and billing steps will be skipped.</p>}
    </div>
  );
}

