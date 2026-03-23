import { Component, computed } from "@angular/core";
import { injectPath } from "@daltonr/pathwrite-angular";
import type { SubscriptionData } from "../subscription.types";

@Component({
  selector: "app-shipping-address-step",
  standalone: true,
  styles: [`
    .form-body { display: flex; flex-direction: column; gap: 18px; }
    .step-intro { margin: 0; font-size: 14px; color: #5b677a; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field label { font-size: 14px; font-weight: 500; color: #374151; display: flex; align-items: baseline; gap: 4px; }
    .required { color: #dc2626; font-size: 13px; }
    .field input { border: 1px solid #c2d0e5; border-radius: 6px; padding: 9px 12px; font-size: 14px; font-family: inherit; color: #1f2937; background: #fff; width: 100%; transition: border-color 0.15s, box-shadow 0.15s; }
    .field input:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
    .field--error input { border-color: #dc2626; }
    .field-error { font-size: 13px; color: #dc2626; }
    .toggle-option { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-radius: 8px; border: 1px solid #e5e7eb; background: #fff; }
    .toggle-text strong { font-size: 14px; color: #1f2937; display: block; }
    .toggle-text span { font-size: 12px; color: #9ca3af; }
    .toggle { position: relative; width: 44px; height: 24px; cursor: pointer; }
    .toggle input { opacity: 0; width: 0; height: 0; }
    .toggle-track { position: absolute; inset: 0; background: #d1d5db; border-radius: 12px; transition: background 0.2s; }
    .toggle input:checked ~ .toggle-track { background: #2563eb; }
    .toggle-thumb { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; background: #fff; border-radius: 50%; transition: transform 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
    .toggle input:checked ~ .toggle-thumb { transform: translateX(20px); }
    .plan-note { margin: 0; font-size: 13px; color: #2563eb; font-weight: 500; }
  `],
  template: `
    <div class="form-body">
      <p class="step-intro">Where should we ship your welcome kit?</p>

      <div class="field" [class.field--error]="errors()['shippingName']">
        <label for="shippingName">Full Name <span class="required">*</span></label>
        <input id="shippingName" type="text" [value]="data.shippingName ?? ''" autofocus autocomplete="name"
          (input)="path.setData('shippingName', $any($event.target).value)" placeholder="Jane Smith" />
        @if (errors()['shippingName']; as msg) { <span class="field-error">{{ msg }}</span> }
      </div>

      <div class="field" [class.field--error]="errors()['shippingAddress']">
        <label for="shippingAddress">Street Address <span class="required">*</span></label>
        <input id="shippingAddress" type="text" [value]="data.shippingAddress ?? ''" autocomplete="street-address"
          (input)="path.setData('shippingAddress', $any($event.target).value)" placeholder="123 Main St" />
        @if (errors()['shippingAddress']; as msg) { <span class="field-error">{{ msg }}</span> }
      </div>

      <div class="row">
        <div class="field" [class.field--error]="errors()['shippingCity']">
          <label for="shippingCity">City <span class="required">*</span></label>
          <input id="shippingCity" type="text" [value]="data.shippingCity ?? ''" autocomplete="address-level2"
            (input)="path.setData('shippingCity', $any($event.target).value)" placeholder="Dublin" />
          @if (errors()['shippingCity']; as msg) { <span class="field-error">{{ msg }}</span> }
        </div>
        <div class="field" [class.field--error]="errors()['shippingPostcode']">
          <label for="shippingPostcode">Postcode <span class="required">*</span></label>
          <input id="shippingPostcode" type="text" [value]="data.shippingPostcode ?? ''" autocomplete="postal-code"
            (input)="path.setData('shippingPostcode', $any($event.target).value)" placeholder="D01 AB12" />
          @if (errors()['shippingPostcode']; as msg) { <span class="field-error">{{ msg }}</span> }
        </div>
      </div>

      @if (data.plan === 'paid') {
        <div class="toggle-option">
          <div class="toggle-text">
            <strong>Billing same as shipping</strong>
            <span>Use this address for billing too</span>
          </div>
          <label class="toggle">
            <input type="checkbox" [checked]="data.billingSameAsShipping"
              (change)="path.setData('billingSameAsShipping', $any($event.target).checked)" />
            <span class="toggle-track"></span>
            <span class="toggle-thumb"></span>
          </label>
        </div>
      }
      @if (data.plan === 'paid' && data.billingSameAsShipping) {
        <p class="plan-note">ℹ️ Billing address step will be skipped — using shipping address.</p>
      }
    </div>
  `
})
export class ShippingAddressStepComponent {
  protected readonly path = injectPath<SubscriptionData>();
  protected readonly errors = computed(() => {
    const s = this.path.snapshot();
    return s?.hasAttemptedNext ? s.fieldMessages : {};
  });
  protected get data(): SubscriptionData { return this.path.snapshot()!.data; }
}

