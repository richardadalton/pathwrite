import { Component, computed } from "@angular/core";
import { usePathContext } from "@daltonr/pathwrite-angular";
import type { SubscriptionData } from "../subscription.types";

@Component({
  selector: "app-billing-address-step",
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
  `],
  template: `
    <div class="form-body">
      <p class="step-intro">Enter a separate billing address for your Pro subscription.</p>
      <div class="field" [class.field--error]="errors()['billingName']">
        <label for="billingName">Full Name <span class="required">*</span></label>
        <input id="billingName" type="text" [value]="data.billingName ?? ''" autofocus autocomplete="name"
          (input)="path.setData('billingName', $any($event.target).value)" placeholder="Jane Smith" />
        @if (errors()['billingName']; as msg) { <span class="field-error">{{ msg }}</span> }
      </div>
      <div class="field" [class.field--error]="errors()['billingAddress']">
        <label for="billingAddress">Street Address <span class="required">*</span></label>
        <input id="billingAddress" type="text" [value]="data.billingAddress ?? ''" autocomplete="street-address"
          (input)="path.setData('billingAddress', $any($event.target).value)" placeholder="456 Billing Rd" />
        @if (errors()['billingAddress']; as msg) { <span class="field-error">{{ msg }}</span> }
      </div>
      <div class="row">
        <div class="field" [class.field--error]="errors()['billingCity']">
          <label for="billingCity">City <span class="required">*</span></label>
          <input id="billingCity" type="text" [value]="data.billingCity ?? ''" autocomplete="address-level2"
            (input)="path.setData('billingCity', $any($event.target).value)" placeholder="Dublin" />
          @if (errors()['billingCity']; as msg) { <span class="field-error">{{ msg }}</span> }
        </div>
        <div class="field" [class.field--error]="errors()['billingPostcode']">
          <label for="billingPostcode">Postcode <span class="required">*</span></label>
          <input id="billingPostcode" type="text" [value]="data.billingPostcode ?? ''" autocomplete="postal-code"
            (input)="path.setData('billingPostcode', $any($event.target).value)" placeholder="D02 XY34" />
          @if (errors()['billingPostcode']; as msg) { <span class="field-error">{{ msg }}</span> }
        </div>
      </div>
    </div>
  `
})
export class BillingAddressStepComponent {
  protected readonly path = usePathContext<SubscriptionData>();
  protected readonly errors = computed(() => {
    const s = this.path.snapshot();
    return s?.hasAttemptedNext ? s.fieldErrors : {};
  });
  protected get data(): SubscriptionData { return this.path.snapshot()!.data; }
}

