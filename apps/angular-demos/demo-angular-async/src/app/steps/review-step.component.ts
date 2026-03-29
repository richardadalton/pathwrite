import { Component } from "@angular/core";
import { usePathContext } from "@daltonr/pathwrite-angular";
import type { ApplicationData } from "../application-path";

@Component({
  selector: "app-review-step",
  standalone: true,
  styles: [`
    .form-body { display: flex; flex-direction: column; gap: 18px; }
    .step-intro { margin: 0; font-size: 14px; color: #5b677a; line-height: 1.6; }
    .eligibility-summary { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
    .summary-row { display: grid; grid-template-columns: 130px 1fr; gap: 8px 16px; padding: 10px 16px; border-bottom: 1px solid #f1f3f7; font-size: 14px; }
    .summary-row:last-child { border-bottom: none; }
    .summary-key { color: #6b7280; font-weight: 500; }
  `],
  template: `
    <div class="form-body">
      <p class="step-intro">All async checks passed. Review your application before submitting.</p>

      <div class="eligibility-summary">
        <div class="summary-row">
          <span class="summary-key">Role</span>
          <span>{{ data.roleId }}</span>
        </div>
        <div class="summary-row">
          <span class="summary-key">Experience</span>
          <span>{{ data.yearsExperience }} years</span>
        </div>
        <div class="summary-row">
          <span class="summary-key">Skills</span>
          <span>{{ data.skills }}</span>
        </div>
        @if (data.coverLetter) {
          <div class="summary-row">
            <span class="summary-key">Cover Letter</span>
            <span>{{ data.coverLetter }}</span>
          </div>
        }
      </div>
    </div>
  `
})
export class ReviewStepComponent {
  protected readonly path = usePathContext<ApplicationData>();

  protected get data(): ApplicationData {
    return this.path.snapshot()!.data;
  }
}
