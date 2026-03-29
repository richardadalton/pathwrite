import { Component, computed } from "@angular/core";
import { usePathContext } from "@daltonr/pathwrite-angular";
import { US_STATES, type AddressData } from "../address.types";

@Component({
  selector: "app-us-address-step",
  standalone: true,
  styles: [`
    .form-body { display: flex; flex-direction: column; gap: 18px; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field label {
      font-size: 14px; font-weight: 500; color: #374151;
      display: flex; align-items: baseline; gap: 4px;
    }
    .required { color: #dc2626; font-size: 13px; }
    .optional { font-size: 12px; color: #9ca3af; font-weight: 400; }
    .field input, .field select {
      border: 1px solid #c2d0e5; border-radius: 6px;
      padding: 9px 12px; font-size: 14px; font-family: inherit;
      color: #1f2937; background: #fff; width: 100%;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .field input:focus, .field select:focus {
      outline: none; border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
    }
    .field select {
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%235b677a' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 12px center;
      padding-right: 32px; cursor: pointer;
    }
    .field--error input, .field--error select { border-color: #dc2626; }
    .field--error input:focus, .field--error select:focus {
      border-color: #dc2626; box-shadow: 0 0 0 3px rgba(220,38,38,0.1);
    }
    .field-error { font-size: 13px; color: #dc2626; }
    .field--short input { max-width: 160px; }
  `],
  template: `
    <div class="form-body">

      <!-- Street Address -->
      <div class="field" [class.field--error]="errors()['streetAddress']">
        <label for="streetAddress">Street Address <span class="required">*</span></label>
        <input
          id="streetAddress" type="text"
          [value]="data.streetAddress ?? ''"
          (input)="path.setData('streetAddress', $any($event.target).value)"
          placeholder="123 Main Street"
          autocomplete="address-line1"
          autofocus
        />
        @if (errors()['streetAddress']; as msg) {
          <span class="field-error">{{ msg }}</span>
        }
      </div>

      <!-- Apt / Unit -->
      <div class="field">
        <label for="aptUnit">Apt / Unit <span class="optional">(optional)</span></label>
        <input
          id="aptUnit" type="text"
          [value]="data.aptUnit ?? ''"
          (input)="path.setData('aptUnit', $any($event.target).value)"
          placeholder="Apt 4B"
          autocomplete="address-line2"
        />
      </div>

      <!-- City + State -->
      <div class="row">
        <div class="field" [class.field--error]="errors()['city']">
          <label for="city">City <span class="required">*</span></label>
          <input
            id="city" type="text"
            [value]="data.city ?? ''"
            (input)="path.setData('city', $any($event.target).value)"
            placeholder="Springfield"
            autocomplete="address-level2"
          />
          @if (errors()['city']; as msg) {
            <span class="field-error">{{ msg }}</span>
          }
        </div>

        <div class="field" [class.field--error]="errors()['state']">
          <label for="state">State <span class="required">*</span></label>
          <select
            id="state"
            (change)="path.setData('state', $any($event.target).value)"
            autocomplete="address-level1"
          >
            <option value="" disabled [selected]="!data.state">Select state…</option>
            @for (s of states; track s.code) {
              <option [value]="s.code" [selected]="data.state === s.code">{{ s.name }}</option>
            }
          </select>
          @if (errors()['state']; as msg) {
            <span class="field-error">{{ msg }}</span>
          }
        </div>
      </div>

      <!-- ZIP Code -->
      <div class="field field--short" [class.field--error]="errors()['zipCode']">
        <label for="zipCode">ZIP Code <span class="required">*</span></label>
        <input
          id="zipCode" type="text"
          [value]="data.zipCode ?? ''"
          (input)="path.setData('zipCode', $any($event.target).value)"
          placeholder="90210"
          autocomplete="postal-code"
          maxlength="10"
        />
        @if (errors()['zipCode']; as msg) {
          <span class="field-error">{{ msg }}</span>
        }
      </div>

    </div>
  `
})
export class UsAddressStepComponent {
  protected readonly path = usePathContext<AddressData>();
  protected readonly errors = computed(() => {
    const s = this.path.snapshot();
    return s?.hasAttemptedNext ? s.fieldErrors : {};
  });
  protected readonly states = US_STATES;

  protected get data(): AddressData {
    return this.path.snapshot()!.data;
  }
}
