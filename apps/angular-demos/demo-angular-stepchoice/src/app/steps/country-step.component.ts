import { Component, computed } from "@angular/core";
import { injectPath } from "@daltonr/pathwrite-angular";
import type { AddressData } from "../address.types";

const COUNTRIES = [
  { code: "US", label: "United States", flag: "🇺🇸" },
  { code: "IE", label: "Ireland",       flag: "🇮🇪" },
];

@Component({
  selector: "app-country-step",
  standalone: true,
  styles: [`
    .step-intro {
      margin: 0 0 24px;
      font-size: 14px;
      color: #5b677a;
    }
    .country-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .country-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 20px 16px;
      border: 2px solid #e5e7eb;
      border-radius: 10px;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
      user-select: none;
    }
    .country-card:hover { border-color: #93c5fd; background: #f0f9ff; }
    .country-card--selected { border-color: #2563eb; background: #eff6ff; }
    .country-card input[type="radio"] { display: none; }
    .country-flag { font-size: 32px; }
    .country-name { font-size: 14px; font-weight: 600; color: #374151; }
    .country-card--selected .country-name { color: #1d4ed8; }
    .field-error { margin-top: 12px; font-size: 13px; color: #dc2626; display: block; }
  `],
  template: `
    <p class="step-intro">Where are you based? We'll show you the right address form on the next step.</p>

    <div class="country-grid">
      @for (c of countries; track c.code) {
        <label class="country-card" [class.country-card--selected]="data.country === c.code">
          <input
            type="radio"
            name="country"
            [value]="c.code"
            [checked]="data.country === c.code"
            (change)="path.setData('country', c.code)"
          />
          <span class="country-flag">{{ c.flag }}</span>
          <span class="country-name">{{ c.label }}</span>
        </label>
      }
    </div>

    @if (errors()['country']; as msg) {
      <span class="field-error">{{ msg }}</span>
    }
  `
})
export class CountryStepComponent {
  protected readonly path = injectPath<AddressData>();
  protected readonly errors = computed(() => {
    const s = this.path.snapshot();
    return s?.hasAttemptedNext ? s.fieldErrors : {};
  });
  protected readonly countries = COUNTRIES;

  protected get data(): AddressData {
    return this.path.snapshot()!.data;
  }
}
