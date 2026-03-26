import { Component, computed } from "@angular/core";
import { injectPath } from "@daltonr/pathwrite-angular";
import type { SubscriptionData } from "../subscription.types";

@Component({
  selector: "app-payment-step",
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
      <p class="step-intro">Enter your payment details for the Pro plan.</p>
      <div class="field" [class.field--error]="errors()['cardNumber']">
        <label for="cardNumber">Card Number <span class="required">*</span></label>
        <input id="cardNumber" type="text" [value]="data.cardNumber ?? ''" autofocus autocomplete="cc-number"
          (input)="path.setData('cardNumber', $any($event.target).value)" placeholder="4242 4242 4242 4242" />
        @if (errors()['cardNumber']; as msg) { <span class="field-error">{{ msg }}</span> }
      </div>
      <div class="row">
        <div class="field" [class.field--error]="errors()['cardExpiry']">
          <label for="cardExpiry">Expiry Date <span class="required">*</span></label>
          <input id="cardExpiry" type="text" [value]="data.cardExpiry ?? ''" autocomplete="cc-exp"
            (input)="path.setData('cardExpiry', $any($event.target).value)" placeholder="MM/YY" />
          @if (errors()['cardExpiry']; as msg) { <span class="field-error">{{ msg }}</span> }
        </div>
        <div class="field" [class.field--error]="errors()['cardCvc']">
          <label for="cardCvc">CVC <span class="required">*</span></label>
          <input id="cardCvc" type="text" [value]="data.cardCvc ?? ''" autocomplete="cc-csc"
            (input)="path.setData('cardCvc', $any($event.target).value)" placeholder="123" />
          @if (errors()['cardCvc']; as msg) { <span class="field-error">{{ msg }}</span> }
        </div>
      </div>
    </div>
  `
})
export class PaymentStepComponent {
  protected readonly path = injectPath<SubscriptionData>();
  protected readonly errors = computed(() => {
    const s = this.path.snapshot();
    return s?.hasAttemptedNext ? s.fieldErrors : {};
  });
  protected get data(): SubscriptionData { return this.path.snapshot()!.data; }
}

