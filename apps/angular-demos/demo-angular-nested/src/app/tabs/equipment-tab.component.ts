import { Component } from "@angular/core";
import { usePathContext } from "@daltonr/pathwrite-angular";
import type { EmployeeDetails } from "../employee-details.types";
import { LAPTOP_TYPES } from "../employee-details.types";
import { TabBarComponent } from "./tab-bar.component";

@Component({
  selector: "app-equipment-tab",
  standalone: true,
  imports: [TabBarComponent],
  styles: [`
    .tab-content { display: flex; flex-direction: column; }
    .form-body { display: flex; flex-direction: column; gap: 18px; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field label {
      font-size: 14px; font-weight: 500; color: #374151;
      display: flex; align-items: baseline; gap: 4px;
    }
    .optional { color: #9ca3af; font-size: 12px; font-weight: 400; }
    .field select, .field input[type="text"] {
      border: 1px solid #c2d0e5; border-radius: 6px;
      padding: 9px 12px; font-size: 14px; font-family: inherit;
      color: #1f2937; background: #fff; width: 100%;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .field select:focus, .field input[type="text"]:focus {
      outline: none; border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
    }
    .radio-group { display: flex; flex-direction: column; gap: 8px; }
    .radio-option {
      display: flex; align-items: center; gap: 10px;
      cursor: pointer; padding: 10px 12px;
      border: 1px solid #e5e7eb; border-radius: 6px;
      transition: border-color 0.15s;
    }
    .radio-option:hover { border-color: #9ca3af; }
    .radio-option input[type="radio"] { width: 16px; height: 16px; cursor: pointer; }
    .radio-option-label { font-size: 14px; color: #374151; }
  `],
  template: `
    <div class="tab-content">
      <app-tab-bar />
      <div class="form-body">
        <!-- Laptop -->
        <div class="field">
          <label for="laptopType">Laptop <span class="optional">(optional)</span></label>
          <select
            id="laptopType"
            [value]="data.laptopType ?? 'macbook-pro'"
            (change)="path.setData('laptopType', $any($event.target).value)"
          >
            @for (laptop of laptopTypes; track laptop.value) {
              <option [value]="laptop.value">{{ laptop.label }}</option>
            }
          </select>
        </div>

        <!-- Mobile Phone -->
        <div class="field">
          <label>Mobile Phone</label>
          <div class="radio-group">
            @for (val of yesNoOptions; track val) {
              <label class="radio-option">
                <input
                  type="radio"
                  name="needsPhone"
                  [value]="val"
                  [checked]="(data.needsPhone ?? 'no') === val"
                  (change)="path.setData('needsPhone', val)"
                />
                <span class="radio-option-label">
                  {{ val === 'yes' ? 'Provide a company phone' : 'No phone needed' }}
                </span>
              </label>
            }
          </div>
        </div>

        <!-- Access Card -->
        <div class="field">
          <label>Access Card</label>
          <div class="radio-group">
            @for (val of yesNoOptions; track val) {
              <label class="radio-option">
                <input
                  type="radio"
                  name="needsAccessCard"
                  [value]="val"
                  [checked]="(data.needsAccessCard ?? 'yes') === val"
                  (change)="path.setData('needsAccessCard', val)"
                />
                <span class="radio-option-label">
                  {{ val === 'yes' ? 'Issue an access card' : 'No access card' }}
                </span>
              </label>
            }
          </div>
        </div>

        <!-- Other Equipment -->
        <div class="field">
          <label for="otherEquipment">Other Equipment <span class="optional">(optional)</span></label>
          <input
            id="otherEquipment" type="text"
            [value]="data.otherEquipment ?? ''"
            (input)="path.setData('otherEquipment', $any($event.target).value)"
            placeholder="e.g. standing desk, external monitor..."
          />
        </div>
      </div>
    </div>
  `,
})
export class EquipmentTabComponent {
  protected readonly path = usePathContext<EmployeeDetails>();
  protected readonly laptopTypes = LAPTOP_TYPES;
  protected readonly yesNoOptions = ["yes", "no"];

  protected get data(): EmployeeDetails {
    return this.path.snapshot()!.data;
  }
}
