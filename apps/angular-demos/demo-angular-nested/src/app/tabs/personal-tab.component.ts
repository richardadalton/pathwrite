import { Component, computed } from "@angular/core";
import { usePathContext } from "@daltonr/pathwrite-angular";
import type { EmployeeDetails } from "../employee-details.types";
import { TabBarComponent } from "./tab-bar.component";

@Component({
  selector: "app-personal-tab",
  standalone: true,
  imports: [TabBarComponent],
  styles: [`
    .tab-content { display: flex; flex-direction: column; }
    .form-body { display: flex; flex-direction: column; gap: 18px; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field label {
      font-size: 14px; font-weight: 500; color: #374151;
      display: flex; align-items: baseline; gap: 4px;
    }
    .required { color: #dc2626; font-size: 13px; }
    .optional { color: #9ca3af; font-size: 12px; font-weight: 400; }
    .field input {
      border: 1px solid #c2d0e5; border-radius: 6px;
      padding: 9px 12px; font-size: 14px; font-family: inherit;
      color: #1f2937; background: #fff; width: 100%;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .field input:focus {
      outline: none; border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
    }
    .field--error input { border-color: #dc2626; }
    .field--error input:focus {
      border-color: #dc2626; box-shadow: 0 0 0 3px rgba(220,38,38,0.1);
    }
    .field-error { font-size: 13px; color: #dc2626; }
  `],
  template: `
    <div class="tab-content">
      <app-tab-bar />
      <div class="form-body">
        <div class="row">
          <!-- First Name -->
          <div class="field" [class.field--error]="errors()['firstName']">
            <label for="firstName">First Name <span class="required">*</span></label>
            <input
              id="firstName" type="text"
              [value]="data.firstName ?? ''"
              (input)="path.setData('firstName', $any($event.target).value)"
              placeholder="Jane"
              autocomplete="given-name"
            />
            @if (errors()['firstName']; as msg) {
              <span class="field-error">{{ msg }}</span>
            }
          </div>

          <!-- Last Name -->
          <div class="field" [class.field--error]="errors()['lastName']">
            <label for="lastName">Last Name <span class="required">*</span></label>
            <input
              id="lastName" type="text"
              [value]="data.lastName ?? ''"
              (input)="path.setData('lastName', $any($event.target).value)"
              placeholder="Smith"
              autocomplete="family-name"
            />
            @if (errors()['lastName']; as msg) {
              <span class="field-error">{{ msg }}</span>
            }
          </div>
        </div>

        <!-- Date of Birth -->
        <div class="field">
          <label for="dateOfBirth">Date of Birth <span class="optional">(optional)</span></label>
          <input
            id="dateOfBirth" type="date"
            [value]="data.dateOfBirth ?? ''"
            (input)="path.setData('dateOfBirth', $any($event.target).value)"
          />
        </div>

        <!-- Phone -->
        <div class="field">
          <label for="phone">Phone Number <span class="optional">(optional)</span></label>
          <input
            id="phone" type="tel"
            [value]="data.phone ?? ''"
            (input)="path.setData('phone', $any($event.target).value)"
            placeholder="+353 86 123 4567"
            autocomplete="tel"
          />
        </div>

        <!-- Personal Email -->
        <div class="field">
          <label for="personalEmail">Personal Email <span class="optional">(optional)</span></label>
          <input
            id="personalEmail" type="email"
            [value]="data.personalEmail ?? ''"
            (input)="path.setData('personalEmail', $any($event.target).value)"
            placeholder="jane@personal.com"
            autocomplete="email"
          />
        </div>
      </div>
    </div>
  `,
})
export class PersonalTabComponent {
  protected readonly path = usePathContext<EmployeeDetails>();

  protected readonly errors = computed(() => {
    const s = this.path.snapshot();
    return (s?.hasAttemptedNext || s?.hasValidated) ? s?.fieldErrors ?? {} : {};
  });

  protected get data(): EmployeeDetails {
    return this.path.snapshot()!.data;
  }
}
