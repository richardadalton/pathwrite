import { Component, computed } from "@angular/core";
import { usePathContext } from "@daltonr/pathwrite-angular";
import type { ApplicationData } from "../application-path";

@Component({
  selector: "app-experience-step",
  standalone: true,
  styles: [`
    .form-body { display: flex; flex-direction: column; gap: 18px; }
    .step-intro { margin: 0; font-size: 14px; color: #5b677a; line-height: 1.6; }
    .step-intro strong { color: #1f2937; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field label { font-size: 14px; font-weight: 500; color: #374151; }
    .field input {
      border: 1px solid #c2d0e5; border-radius: 6px; padding: 9px 12px; font-size: 14px;
      font-family: inherit; color: #1f2937; background: #fff; width: 100%;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .field input:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
    .field--error input { border-color: #dc2626; }
    .field-error { font-size: 13px; color: #dc2626; }
  `],
  template: `
    <div class="form-body">
      <p class="step-intro">
        Tell us about your background. The next step will run an async eligibility
        check — try entering <strong>less than 2 years</strong> to see the guard block navigation.
      </p>

      <div class="field" [class.field--error]="errors()['yearsExperience']">
        <label for="years">Years of Relevant Experience</label>
        <input
          id="years"
          type="number"
          min="0"
          step="1"
          [value]="data.yearsExperience ?? ''"
          (input)="path.setData('yearsExperience', $any($event.target).value)"
          placeholder="e.g. 3"
          autofocus
        />
        @if (errors()['yearsExperience']; as msg) {
          <span class="field-error">{{ msg }}</span>
        }
      </div>

      <div class="field" [class.field--error]="errors()['skills']">
        <label for="skills">Key Skills</label>
        <input
          id="skills"
          type="text"
          [value]="data.skills ?? ''"
          (input)="path.setData('skills', $any($event.target).value)"
          placeholder="e.g. TypeScript, React, Node.js"
        />
        @if (errors()['skills']; as msg) {
          <span class="field-error">{{ msg }}</span>
        }
      </div>
    </div>
  `
})
export class ExperienceStepComponent {
  protected readonly path = usePathContext<ApplicationData>();

  protected readonly errors = computed(() => {
    const s = this.path.snapshot();
    return s?.hasAttemptedNext ? s.fieldErrors : {};
  });

  protected get data(): ApplicationData {
    return this.path.snapshot()!.data;
  }
}
