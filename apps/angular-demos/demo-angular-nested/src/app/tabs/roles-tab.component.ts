import { Component, computed } from "@angular/core";
import { usePathContext } from "@daltonr/pathwrite-angular";
import type { EmployeeDetails } from "../employee-details.types";
import { TabBarComponent } from "./tab-bar.component";

interface Permission {
  key: keyof EmployeeDetails & string;
  label: string;
  desc: string;
}

const PERMISSIONS: Permission[] = [
  { key: "permAdmin",   label: "Admin Access",     desc: "Full system administration" },
  { key: "permDev",     label: "Developer Access",  desc: "Code repositories & CI/CD pipelines" },
  { key: "permHR",      label: "HR Access",         desc: "Personnel records & payroll" },
  { key: "permFinance", label: "Finance Access",    desc: "Accounting & expense systems" },
];

@Component({
  selector: "app-roles-tab",
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
    .field input[type="text"] {
      border: 1px solid #c2d0e5; border-radius: 6px;
      padding: 9px 12px; font-size: 14px; font-family: inherit;
      color: #1f2937; background: #fff; width: 100%;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .field input[type="text"]:focus {
      outline: none; border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
    }
    .field--error input[type="text"] { border-color: #dc2626; }
    .field--error input[type="text"]:focus {
      border-color: #dc2626; box-shadow: 0 0 0 3px rgba(220,38,38,0.1);
    }
    .field-error { font-size: 13px; color: #dc2626; }
    .pref-label {
      font-size: 13px; font-weight: 600; color: #374151;
      margin: 0 0 10px; text-transform: uppercase; letter-spacing: 0.04em;
    }
    .perm-section { display: flex; flex-direction: column; }
    .perm-list { display: flex; flex-direction: column; gap: 8px; }
    .perm-option {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 14px; border: 1px solid #e5e7eb; border-radius: 8px;
      cursor: pointer; transition: border-color 0.15s;
    }
    .perm-option:hover { border-color: #9ca3af; }
    .perm-text { display: flex; flex-direction: column; gap: 2px; }
    .perm-label { font-size: 14px; font-weight: 500; color: #1f2937; }
    .perm-desc { font-size: 12px; color: #6b7280; }
    /* Toggle switch */
    .toggle { position: relative; display: inline-flex; align-items: center; }
    .toggle input[type="checkbox"] {
      position: absolute; opacity: 0; width: 0; height: 0;
    }
    .toggle-track {
      display: block; width: 40px; height: 22px;
      background: #d1d5db; border-radius: 11px;
      transition: background 0.2s; cursor: pointer;
    }
    .toggle input:checked ~ .toggle-track { background: #2563eb; }
    .toggle-thumb {
      position: absolute; left: 3px; top: 50%;
      transform: translateY(-50%);
      width: 16px; height: 16px;
      background: #fff; border-radius: 50%;
      transition: left 0.2s; pointer-events: none;
    }
    .toggle input:checked ~ .toggle-track ~ .toggle-thumb { left: 21px; }
  `],
  template: `
    <div class="tab-content">
      <app-tab-bar />
      <div class="form-body">
        <!-- Job Title -->
        <div class="field" [class.field--error]="errors()['jobTitle']">
          <label for="jobTitle">Job Title <span class="required">*</span></label>
          <input
            id="jobTitle" type="text"
            [value]="data.jobTitle ?? ''"
            (input)="path.setData('jobTitle', $any($event.target).value)"
            placeholder="e.g. Senior Software Engineer"
          />
          @if (errors()['jobTitle']; as msg) {
            <span class="field-error">{{ msg }}</span>
          }
        </div>

        <!-- System Permissions -->
        <div class="perm-section">
          <p class="pref-label">System Permissions</p>
          <div class="perm-list">
            @for (perm of permissions; track perm.key) {
              <label class="perm-option">
                <div class="perm-text">
                  <span class="perm-label">{{ perm.label }}</span>
                  <span class="perm-desc">{{ perm.desc }}</span>
                </div>
                <div class="toggle">
                  <input
                    type="checkbox"
                    [checked]="(data[perm.key] ?? 'no') === 'yes'"
                    (change)="path.setData(perm.key, $any($event.target).checked ? 'yes' : 'no')"
                  />
                  <span class="toggle-track"></span>
                  <span class="toggle-thumb"></span>
                </div>
              </label>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class RolesTabComponent {
  protected readonly path = usePathContext<EmployeeDetails>();

  protected readonly permissions = PERMISSIONS;

  protected readonly errors = computed(() => {
    const s = this.path.snapshot();
    return (s?.hasAttemptedNext || s?.hasValidated) ? s?.fieldErrors ?? {} : {};
  });

  protected get data(): EmployeeDetails {
    return this.path.snapshot()!.data;
  }
}
