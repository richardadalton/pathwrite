import { Component, OnInit, computed } from "@angular/core";
import { injectPath } from "@daltonr/pathwrite-angular";
import type { OnboardingData } from "../onboarding.types";

@Component({
  selector: "app-personal-info-step",
  standalone: true,
  styles: [`
    .step-intro {
      margin: 0 0 24px;
      font-size: 14px;
      color: #5b677a;
    }
    .form-body { display: flex; flex-direction: column; gap: 18px; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
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
    <p class="step-intro">Let's start with the basics — we just need a name and email.</p>

    <div class="form-body">

      <div class="row">
        <!-- First Name -->
        <div class="field" [class.field--error]="errors()['firstName']">
          <label for="firstName">First Name <span class="required">*</span></label>
          <input
            id="firstName" type="text"
            [value]="firstName"
            (input)="update('firstName', $any($event.target).value)"
            placeholder="Jane"
            autocomplete="given-name"
            autofocus
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
            [value]="lastName"
            (input)="update('lastName', $any($event.target).value)"
            placeholder="Smith"
            autocomplete="family-name"
          />
          @if (errors()['lastName']; as msg) {
            <span class="field-error">{{ msg }}</span>
          }
        </div>
      </div>

      <!-- Email -->
      <div class="field" [class.field--error]="errors()['email']">
        <label for="email">Email Address <span class="required">*</span></label>
        <input
          id="email" type="email"
          [value]="email"
          (input)="update('email', $any($event.target).value)"
          placeholder="jane@example.com"
          autocomplete="email"
        />
        @if (errors()['email']; as msg) {
          <span class="field-error">{{ msg }}</span>
        }
      </div>

    </div>
  `
})
export class PersonalInfoStepComponent implements OnInit {
  protected readonly path = injectPath<OnboardingData>();
  protected readonly errors = computed(() => {
    const s = this.path.snapshot();
    return s?.hasAttemptedNext ? (s.fieldMessages ?? {}) : {};
  });

  protected firstName = "";
  protected lastName  = "";
  protected email     = "";

  ngOnInit(): void {
    // Restore field values when navigating back to this step.
    const data = this.path.snapshot()?.data;
    if (data) {
      this.firstName = (data.firstName as string) ?? "";
      this.lastName  = (data.lastName  as string) ?? "";
      this.email     = (data.email     as string) ?? "";
    }
  }

  protected update(field: string & keyof OnboardingData, raw: string): void {
    const value = raw.trim();
    (this as any)[field] = raw;
    this.path.setData(field, value);
  }
}


