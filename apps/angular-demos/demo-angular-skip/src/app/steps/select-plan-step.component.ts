import { Component, computed } from "@angular/core";
import { usePathContext } from "@daltonr/pathwrite-angular";
import type { SubscriptionData } from "../subscription.types";

@Component({
  selector: "app-select-plan-step",
  standalone: true,
  styles: [`
    .form-body { display: flex; flex-direction: column; gap: 18px; }
    .step-intro { margin: 0; font-size: 14px; color: #5b677a; }
    .plan-options { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .plan-card { display: flex; align-items: flex-start; gap: 12px; padding: 16px; border-radius: 10px; border: 2px solid #e5e7eb; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
    .plan-card:hover { border-color: #c2d0e5; }
    .plan-card--selected { border-color: #2563eb; background: #eff6ff; }
    .plan-card input[type="radio"] { accent-color: #2563eb; width: 18px; height: 18px; margin-top: 2px; cursor: pointer; flex-shrink: 0; }
    .plan-card__body { display: flex; flex-direction: column; gap: 4px; }
    .plan-card__name { font-size: 16px; font-weight: 700; color: #1f2937; }
    .plan-card__price { font-size: 14px; color: #2563eb; font-weight: 600; }
    .plan-card__features { margin: 6px 0 0; padding: 0 0 0 18px; font-size: 13px; color: #5b677a; line-height: 1.8; }
    .field-error { font-size: 13px; color: #dc2626; }
    .plan-note { margin: 0; font-size: 13px; color: #2563eb; font-weight: 500; }
  `],
  template: `
    <div class="form-body">
      <p class="step-intro">Choose the plan that's right for you. Free gets you started — upgrade anytime.</p>
      <div class="plan-options">
        <label class="plan-card" [class.plan-card--selected]="data.plan === 'free'">
          <input type="radio" name="plan" value="free" [checked]="data.plan === 'free'" (change)="path.setData('plan', 'free')" />
          <div class="plan-card__body">
            <span class="plan-card__name">Free</span>
            <span class="plan-card__price">$0 / month</span>
            <ul class="plan-card__features"><li>1 project</li><li>Community support</li><li>Basic analytics</li></ul>
          </div>
        </label>
        <label class="plan-card" [class.plan-card--selected]="data.plan === 'paid'">
          <input type="radio" name="plan" value="paid" [checked]="data.plan === 'paid'" (change)="path.setData('plan', 'paid')" />
          <div class="plan-card__body">
            <span class="plan-card__name">Pro</span>
            <span class="plan-card__price">$29 / month</span>
            <ul class="plan-card__features"><li>Unlimited projects</li><li>Priority support</li><li>Advanced analytics</li><li>Custom branding</li></ul>
          </div>
        </label>
      </div>
      @if (errors()['plan']; as msg) { <span class="field-error">{{ msg }}</span> }
      @if (data.plan === 'free') { <p class="plan-note">ℹ️ Free plan — payment and billing steps will be skipped.</p> }
    </div>
  `
})
export class SelectPlanStepComponent {
  protected readonly path = usePathContext<SubscriptionData>();
  protected readonly errors = computed(() => {
    const s = this.path.snapshot();
    return s?.hasAttemptedNext ? s.fieldErrors : {};
  });
  protected get data(): SubscriptionData { return this.path.snapshot()!.data; }
}

