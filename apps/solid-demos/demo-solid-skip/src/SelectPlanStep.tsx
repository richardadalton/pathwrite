import { createMemo } from "solid-js";
import { usePathContext } from "@daltonr/pathwrite-solid";
import type { PathSnapshot } from "@daltonr/pathwrite-core";
import type { SubscriptionData } from "./subscription";
import { PLAN_LABELS } from "./subscription";

interface Props {
  snapshot: PathSnapshot;
}

export default function SelectPlanStep(props: Props) {
  const { setData } = usePathContext<SubscriptionData>();
  const data = createMemo(() => props.snapshot.data as SubscriptionData);

  return (
    <div class="form-body">
      <p class="step-intro">Choose the plan that suits you. Free plan skips payment and billing steps.</p>
      <div class="field">
        <label>Plan <span class="required">*</span></label>
        <div class="radio-group">
          <label class="radio-option">
            <input
              type="radio"
              name="plan"
              value="free"
              checked={data().plan === "free"}
              onChange={() => setData({ plan: "free" })}
            />
            <span class="radio-option-label">{PLAN_LABELS["free"]} — no payment required</span>
          </label>
          <label class="radio-option">
            <input
              type="radio"
              name="plan"
              value="paid"
              checked={data().plan === "paid"}
              onChange={() => setData({ plan: "paid" })}
            />
            <span class="radio-option-label">{PLAN_LABELS["paid"]}</span>
          </label>
        </div>
      </div>
      <p class="hint">
        Selecting <code>Free</code> will skip the <strong>Payment</strong> and{" "}
        <strong>Billing Address</strong> steps entirely using <code>shouldSkip</code>.
      </p>
    </div>
  );
}
