import { Component, computed } from "@angular/core";
import { usePathContext } from "@daltonr/pathwrite-angular";
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
            [value]="data.firstName ?? ''"
            (input)="path.setData('firstName', $any($event.target).value.trim())"
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
            [value]="data.lastName ?? ''"
            (input)="path.setData('lastName', $any($event.target).value.trim())"
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
          [value]="data.email ?? ''"
          (input)="path.setData('email', $any($event.target).value.trim())"
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
export class PersonalInfoStepComponent {
  protected readonly path = usePathContext<OnboardingData>();
  protected readonly errors = computed(() => {
    const s = this.path.snapshot();
    return s?.hasAttemptedNext ? s.fieldErrors : {};
  });

  // snapshot() is always non-null while this step component is mounted —
  // PathShell only renders step content when the snapshot is active.
  // The non-null assertion (!) is safe here; no cast or fallback needed.
  protected get data(): OnboardingData {
    return this.path.snapshot()!.data;
  }
}
