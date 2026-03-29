import { Component, computed } from "@angular/core";
import { usePathContext } from "@daltonr/pathwrite-angular";
import { IE_COUNTIES, type AddressData } from "../address.types";

@Component({
  selector: "app-ie-address-step",
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

      <!-- Address Line 1 -->
      <div class="field" [class.field--error]="errors()['addressLine1']">
        <label for="addressLine1">Address Line 1 <span class="required">*</span></label>
        <input
          id="addressLine1" type="text"
          [value]="data.addressLine1 ?? ''"
          (input)="path.setData('addressLine1', $any($event.target).value)"
          placeholder="12 O'Connell Street"
          autocomplete="address-line1"
          autofocus
        />
        @if (errors()['addressLine1']; as msg) {
          <span class="field-error">{{ msg }}</span>
        }
      </div>

      <!-- Address Line 2 -->
      <div class="field">
        <label for="addressLine2">Address Line 2 <span class="optional">(optional)</span></label>
        <input
          id="addressLine2" type="text"
          [value]="data.addressLine2 ?? ''"
          (input)="path.setData('addressLine2', $any($event.target).value)"
          placeholder="Apartment 3"
          autocomplete="address-line2"
        />
      </div>

      <!-- Town + County -->
      <div class="row">
        <div class="field" [class.field--error]="errors()['town']">
          <label for="town">Town / City <span class="required">*</span></label>
          <input
            id="town" type="text"
            [value]="data.town ?? ''"
            (input)="path.setData('town', $any($event.target).value)"
            placeholder="Dublin"
            autocomplete="address-level2"
          />
          @if (errors()['town']; as msg) {
            <span class="field-error">{{ msg }}</span>
          }
        </div>

        <div class="field" [class.field--error]="errors()['county']">
          <label for="county">County <span class="required">*</span></label>
          <select
            id="county"
            (change)="path.setData('county', $any($event.target).value)"
            autocomplete="address-level1"
          >
            <option value="" disabled [selected]="!data.county">Select county…</option>
            @for (c of counties; track c) {
              <option [value]="c" [selected]="data.county === c">{{ c }}</option>
            }
          </select>
          @if (errors()['county']; as msg) {
            <span class="field-error">{{ msg }}</span>
          }
        </div>
      </div>

      <!-- Eircode -->
      <div class="field field--short">
        <label for="eircode">Eircode <span class="optional">(optional)</span></label>
        <input
          id="eircode" type="text"
          [value]="data.eircode ?? ''"
          (input)="path.setData('eircode', $any($event.target).value.toUpperCase())"
          placeholder="D01 F5P2"
          autocomplete="postal-code"
          maxlength="8"
        />
      </div>

    </div>
  `
})
export class IeAddressStepComponent {
  protected readonly path = usePathContext<AddressData>();
  protected readonly errors = computed(() => {
    const s = this.path.snapshot();
    return s?.hasAttemptedNext ? s.fieldErrors : {};
  });
  protected readonly counties = IE_COUNTIES;

  protected get data(): AddressData {
    return this.path.snapshot()!.data;
  }
}
