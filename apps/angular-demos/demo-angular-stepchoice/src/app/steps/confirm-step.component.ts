import { Component, computed } from "@angular/core";
import { injectPath } from "@daltonr/pathwrite-angular";
import { US_STATES, type AddressData } from "../address.types";

@Component({
  selector: "app-confirm-step",
  standalone: true,
  styles: [`
    .step-intro { margin: 0 0 24px; font-size: 14px; color: #5b677a; }
    .confirm-card {
      background: #f8fafc;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      overflow: hidden;
    }
    .confirm-section { padding: 16px 20px; }
    .confirm-divider { border: none; border-top: 1px solid #e5e7eb; margin: 0; }
    .confirm-label {
      margin: 0 0 6px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #6b7280;
    }
    .confirm-value { margin: 0; font-size: 15px; font-weight: 600; color: #1f2937; }
    .confirm-address { margin: 0; }
    .confirm-address p { margin: 0 0 2px; font-size: 14px; color: #374151; }
    .confirm-address p:last-child { margin-bottom: 0; }
  `],
  template: `
    <p class="step-intro">Please review your address before submitting.</p>

    <div class="confirm-card">
      <div class="confirm-section">
        <p class="confirm-label">Country</p>
        <p class="confirm-value">{{ data.country === 'US' ? '🇺🇸 United States' : '🇮🇪 Ireland' }}</p>
      </div>

      <hr class="confirm-divider" />

      <div class="confirm-section">
        <p class="confirm-label">Address</p>
        @if (data.country === 'US') {
          <div class="confirm-address">
            <p>{{ data.streetAddress }}{{ data.aptUnit ? ', ' + data.aptUnit : '' }}</p>
            <p>{{ data.city }}, {{ data.state }} {{ data.zipCode }}</p>
            <p>United States</p>
          </div>
        } @else {
          <div class="confirm-address">
            <p>{{ data.addressLine1 }}</p>
            @if (data.addressLine2) { <p>{{ data.addressLine2 }}</p> }
            <p>{{ data.town }}</p>
            <p>Co. {{ data.county }}{{ data.eircode ? ', ' + data.eircode : '' }}</p>
            <p>Ireland</p>
          </div>
        }
      </div>
    </div>
  `
})
export class ConfirmStepComponent {
  protected readonly path = injectPath<AddressData>();
  protected readonly states = US_STATES;

  protected get data(): AddressData {
    return this.path.snapshot()!.data;
  }

  protected stateName(code: string): string {
    return this.states.find(s => s.code === code)?.name ?? code;
  }
}
