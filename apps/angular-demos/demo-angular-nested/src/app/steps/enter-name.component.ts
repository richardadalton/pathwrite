import { Component, computed } from "@angular/core";
import { usePathContext } from "@daltonr/pathwrite-angular";
import type { OnboardingData } from "../onboarding.types";

@Component({
  selector: "app-enter-name-step",
  standalone: true,
  styles: [`
    .step-intro {
      margin: 0 0 24px;
      font-size: 14px;
      color: #5b677a;
    }
    .form-body { display: flex; flex-direction: column; gap: 18px; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field label {
      font-size: 14px; font-weight: 500; color: #374151;
      display: flex; align-items: baseline; gap: 4px;
    }
    .required { color: #dc2626; font-size: 13px; }
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
    <div class="form-body">
      <p class="step-intro">
        Enter the new employee's full name to begin their onboarding record.
      </p>
      <div class="field" [class.field--error]="errors()['employeeName']">
        <label for="employeeName">
          Full Name <span class="required">*</span>
        </label>
        <input
          id="employeeName"
          type="text"
          [value]="data.employeeName ?? ''"
          (input)="path.setData('employeeName', $any($event.target).value)"
          placeholder="e.g. Jane Smith"
          autocomplete="name"
          autofocus
        />
        @if (errors()['employeeName']; as msg) {
          <span class="field-error">{{ msg }}</span>
        }
      </div>
    </div>
  `,
})
export class EnterNameComponent {
  protected readonly path = usePathContext<OnboardingData>();

  protected readonly errors = computed(() => {
    const s = this.path.snapshot();
    return s?.hasAttemptedNext ? s.fieldErrors ?? {} : {};
  });

  protected get data(): OnboardingData {
    return this.path.snapshot()!.data;
  }
}
