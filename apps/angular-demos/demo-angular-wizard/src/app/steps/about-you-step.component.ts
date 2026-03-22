import { Component, OnInit, computed } from "@angular/core";
import { injectPath } from "@daltonr/pathwrite-angular";
import type { OnboardingData } from "../onboarding.types";

@Component({
  selector: "app-about-you-step",
  standalone: true,
  styles: [`
    .step-intro {
      margin: 0 0 24px; font-size: 14px; color: #5b677a;
    }
    .form-body { display: flex; flex-direction: column; gap: 18px; }
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
  `],
  template: `
    <p class="step-intro">Tell us a bit about your professional background.</p>

    <div class="form-body">

      <!-- Job Title -->
      <div class="field" [class.field--error]="errors()['jobTitle']">
        <label for="jobTitle">Job Title <span class="required">*</span></label>
        <input
          id="jobTitle" type="text"
          [value]="jobTitle"
          (input)="updateText('jobTitle', $any($event.target).value)"
          placeholder="e.g. Frontend Developer"
          autocomplete="organization-title"
          autofocus
        />
        @if (errors()['jobTitle']; as msg) {
          <span class="field-error">{{ msg }}</span>
        }
      </div>

      <!-- Company -->
      <div class="field">
        <label for="company">
          Company <span class="optional">(optional)</span>
        </label>
        <input
          id="company" type="text"
          [value]="company"
          (input)="updateText('company', $any($event.target).value)"
          placeholder="e.g. Acme Corp"
          autocomplete="organization"
        />
      </div>

      <!-- Experience Level -->
      <div class="field" [class.field--error]="errors()['experience']">
        <label for="experience">Experience Level <span class="required">*</span></label>
        <select
          id="experience"
          (change)="updateExperience($any($event.target).value)"
        >
          <option value="" disabled [selected]="!experience">Select your level…</option>
          <option value="junior"  [selected]="experience === 'junior'">Junior (0–2 years)</option>
          <option value="mid"     [selected]="experience === 'mid'">Mid-level (3–5 years)</option>
          <option value="senior"  [selected]="experience === 'senior'">Senior (6–10 years)</option>
          <option value="lead"    [selected]="experience === 'lead'">Lead / Principal (10+ years)</option>
        </select>
        @if (errors()['experience']; as msg) {
          <span class="field-error">{{ msg }}</span>
        }
      </div>

    </div>
  `
})
export class AboutYouStepComponent implements OnInit {
  protected readonly path = injectPath<OnboardingData>();
  protected readonly errors = computed(() => {
    const s = this.path.snapshot();
    return s?.hasAttemptedNext ? (s.fieldMessages ?? {}) : {};
  });

  protected jobTitle   = "";
  protected company    = "";
  protected experience = "";

  ngOnInit(): void {
    const data = this.path.snapshot()?.data;
    if (data) {
      this.jobTitle   = (data.jobTitle   as string) ?? "";
      this.company    = (data.company    as string) ?? "";
      this.experience = (data.experience as string) ?? "";
    }
  }

  protected updateText(field: string & keyof OnboardingData, raw: string): void {
    (this as any)[field] = raw;
    this.path.setData(field, raw.trim());
  }

  protected updateExperience(value: string): void {
    this.experience = value;
    this.path.setData("experience", value);
  }
}


