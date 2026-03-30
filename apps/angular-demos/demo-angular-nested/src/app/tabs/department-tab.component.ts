import { Component, computed } from "@angular/core";
import { usePathContext } from "@daltonr/pathwrite-angular";
import type { EmployeeDetails } from "../employee-details.types";
import { DEPARTMENTS, OFFICES } from "../employee-details.types";
import { TabBarComponent } from "./tab-bar.component";

@Component({
  selector: "app-department-tab",
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
    .required { color: #dc2626; font-size: 13px; }
    .optional { color: #9ca3af; font-size: 12px; font-weight: 400; }
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
    .field--error input, .field--error select { border-color: #dc2626; }
    .field--error input:focus, .field--error select:focus {
      border-color: #dc2626; box-shadow: 0 0 0 3px rgba(220,38,38,0.1);
    }
    .field-error { font-size: 13px; color: #dc2626; }
  `],
  template: `
    <div class="tab-content">
      <app-tab-bar />
      <div class="form-body">
        <!-- Department -->
        <div class="field" [class.field--error]="errors()['department']">
          <label for="department">Department <span class="required">*</span></label>
          <select
            id="department"
            [value]="data.department ?? ''"
            (change)="path.setData('department', $any($event.target).value)"
          >
            <option value="">Select a department...</option>
            @for (dept of departments; track dept) {
              <option [value]="dept">{{ dept }}</option>
            }
          </select>
          @if (errors()['department']; as msg) {
            <span class="field-error">{{ msg }}</span>
          }
        </div>

        <!-- Manager -->
        <div class="field">
          <label for="manager">Reporting Manager <span class="optional">(optional)</span></label>
          <input
            id="manager" type="text"
            [value]="data.manager ?? ''"
            (input)="path.setData('manager', $any($event.target).value)"
            placeholder="e.g. John Murphy"
          />
        </div>

        <!-- Office -->
        <div class="field">
          <label for="office">Office Location <span class="optional">(optional)</span></label>
          <select
            id="office"
            [value]="data.office ?? ''"
            (change)="path.setData('office', $any($event.target).value)"
          >
            <option value="">Select an office...</option>
            @for (office of offices; track office) {
              <option [value]="office">{{ office }}</option>
            }
          </select>
        </div>

        <!-- Start Date -->
        <div class="field">
          <label for="startDate">Start Date <span class="optional">(optional)</span></label>
          <input
            id="startDate" type="date"
            [value]="data.startDate ?? ''"
            (input)="path.setData('startDate', $any($event.target).value)"
          />
        </div>
      </div>
    </div>
  `,
})
export class DepartmentTabComponent {
  protected readonly path = usePathContext<EmployeeDetails>();

  protected readonly departments = DEPARTMENTS;
  protected readonly offices = OFFICES;

  protected readonly errors = computed(() => {
    const s = this.path.snapshot();
    return (s?.hasAttemptedNext || s?.hasValidated) ? s?.fieldErrors ?? {} : {};
  });

  protected get data(): EmployeeDetails {
    return this.path.snapshot()!.data;
  }
}
