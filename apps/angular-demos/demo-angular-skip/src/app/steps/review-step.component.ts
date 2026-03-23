import { Component } from "@angular/core";
import { injectPath } from "@daltonr/pathwrite-angular";
import { PLAN_LABELS, type SubscriptionData } from "../subscription.types";

@Component({
  selector: "app-review-step",
  standalone: true,
  styles: [`
    .form-body { display: flex; flex-direction: column; gap: 18px; }
    .review-section { margin-bottom: 4px; }
    .section-title { font-size: 11px; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 8px; }
    .review-card { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
    .review-row { display: grid; grid-template-columns: 110px 1fr; gap: 8px 16px; padding: 9px 16px; border-bottom: 1px solid #f1f3f7; font-size: 14px; }
    .review-row:last-child { border-bottom: none; }
    .review-key { color: #6b7280; font-weight: 500; }
    .plan-badge { display: inline-flex; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .plan-badge--free { background: #f3f4f6; color: #6b7280; }
    .plan-badge--pro { background: #dbeafe; color: #1d4ed8; }
    .skip-summary { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; }
    .skip-summary__title { margin: 0 0 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; }
    .skip-summary__list { margin: 0; padding: 0 0 0 20px; font-size: 13px; line-height: 2; color: #374151; }
    .skip-summary__skipped { color: #9ca3af; font-style: italic; }
    .skip-summary__current { color: #2563eb; font-weight: 600; }
  `],
  template: `
    <div class="form-body">
      <div class="review-section">
        <p class="section-title">Plan</p>
        <div class="review-card">
          <div class="review-row">
            <span class="review-key">Selected Plan</span>
            <span>
              <span class="plan-badge" [class.plan-badge--pro]="data.plan === 'paid'" [class.plan-badge--free]="data.plan !== 'paid'">
                {{ planLabel(data.plan) }}
              </span>
            </span>
          </div>
        </div>
      </div>

      <div class="review-section">
        <p class="section-title">Shipping Address</p>
        <div class="review-card">
          <div class="review-row"><span class="review-key">Name</span><span>{{ data.shippingName }}</span></div>
          <div class="review-row"><span class="review-key">Address</span><span>{{ data.shippingAddress }}</span></div>
          <div class="review-row"><span class="review-key">City</span><span>{{ data.shippingCity }}</span></div>
          <div class="review-row"><span class="review-key">Postcode</span><span>{{ data.shippingPostcode }}</span></div>
        </div>
      </div>

      @if (data.plan === 'paid') {
        <div class="review-section">
          <p class="section-title">Payment</p>
          <div class="review-card">
            <div class="review-row"><span class="review-key">Card</span><span>•••• {{ cardLast4 }}</span></div>
            <div class="review-row"><span class="review-key">Expiry</span><span>{{ data.cardExpiry }}</span></div>
          </div>
        </div>

        <div class="review-section">
          <p class="section-title">Billing Address</p>
          <div class="review-card">
            <div class="review-row"><span class="review-key">Billing</span><span>{{ billingLabel }}</span></div>
            @if (!data.billingSameAsShipping) {
              <div class="review-row"><span class="review-key">Name</span><span>{{ data.billingName }}</span></div>
              <div class="review-row"><span class="review-key">Address</span><span>{{ data.billingAddress }}</span></div>
              <div class="review-row"><span class="review-key">City</span><span>{{ data.billingCity }}</span></div>
              <div class="review-row"><span class="review-key">Postcode</span><span>{{ data.billingPostcode }}</span></div>
            }
          </div>
        </div>
      }

      <div class="skip-summary">
        <p class="skip-summary__title">Steps in this flow</p>
        <ul class="skip-summary__list">
          <li>✓ Select Plan</li>
          <li>✓ Shipping Address</li>
          <li [class.skip-summary__skipped]="data.plan === 'free'">
            {{ data.plan === 'free' ? '⏭ Payment Details (skipped)' : '✓ Payment Details' }}
          </li>
          <li [class.skip-summary__skipped]="data.plan === 'free' || data.billingSameAsShipping">
            {{ data.plan === 'free' ? '⏭ Billing Address (skipped — free plan)' : data.billingSameAsShipping ? '⏭ Billing Address (skipped — same as shipping)' : '✓ Billing Address' }}
          </li>
          <li class="skip-summary__current">● Review (you are here)</li>
        </ul>
      </div>
    </div>
  `
})
export class ReviewStepComponent {
  protected readonly path = injectPath<SubscriptionData>();
  protected get data(): SubscriptionData { return this.path.snapshot()!.data; }
  protected get cardLast4(): string { return (this.data.cardNumber as string).slice(-4); }
  protected get billingLabel(): string {
    if (this.data.plan === "free") return "N/A (Free plan)";
    if (this.data.billingSameAsShipping) return "Same as shipping";
    return `${this.data.billingName}, ${this.data.billingAddress}, ${this.data.billingCity} ${this.data.billingPostcode}`;
  }
  protected planLabel(plan: string): string { return PLAN_LABELS[plan] ?? plan; }
}

