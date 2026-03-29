import { Component, computed } from "@angular/core";
import { usePathContext } from "@daltonr/pathwrite-angular";
import type { ApplicationData } from "../application-path";

@Component({
  selector: "app-eligibility-step",
  standalone: true,
  styles: [`
    .form-body { display: flex; flex-direction: column; gap: 18px; }
    .step-intro { margin: 0; font-size: 14px; color: #5b677a; line-height: 1.6; }
    .eligibility-summary { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
    .summary-row { display: grid; grid-template-columns: 130px 1fr; gap: 8px 16px; padding: 10px 16px; border-bottom: 1px solid #f1f3f7; font-size: 14px; }
    .summary-row:last-child { border-bottom: none; }
    .summary-key { color: #6b7280; font-weight: 500; }
    .field-error { font-size: 13px; color: #dc2626; margin-top: 12px; }
    .hint { margin: 0; font-size: 13px; color: #6b7280; line-height: 1.6; padding: 10px 14px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 6px; }
    .hint code { font-size: 12px; background: #eef2ff; color: #4f46e5; padding: 1px 5px; border-radius: 4px; }
    .hint strong { color: #374151; }
  `],
  template: `
    <div class="form-body">
      <p class="step-intro">
        Clicking <strong>Next</strong> runs an async eligibility check against our API.
        The check takes ~900ms — watch the spinner on the button.
      </p>

      <div class="eligibility-summary">
        <div class="summary-row">
          <span class="summary-key">Role</span>
          <span>{{ data.roleId || "—" }}</span>
        </div>
        <div class="summary-row">
          <span class="summary-key">Experience</span>
          <span>{{ data.yearsExperience ? data.yearsExperience + ' years' : '—' }}</span>
        </div>
        <div class="summary-row">
          <span class="summary-key">Skills</span>
          <span>{{ data.skills || "—" }}</span>
        </div>
      </div>

      @if (blockingError()) {
        <p class="field-error">{{ blockingError() }}</p>
      }

      @if (!guardRunning()) {
        <p class="hint">
          <strong>What's happening:</strong> <code>canMoveNext</code> is async — it calls
          <code>svc.checkEligibility()</code> and the engine awaits the result before deciding
          whether to advance. While it runs, <code>snapshot().status === "validating"</code>
          and the shell shows a CSS spinner. If blocked, we read
          <code>snapshot().blockingError</code> here (since <code>validationDisplay="inline"</code>
          suppresses the shell's own rendering).
        </p>
      }
    </div>
  `
})
export class EligibilityStepComponent {
  protected readonly path = usePathContext<ApplicationData>();

  // validationDisplay="inline" suppresses the shell's blockingError rendering.
  protected readonly blockingError = computed(() => {
    const s = this.path.snapshot();
    return s?.hasAttemptedNext ? s.blockingError : null;
  });

  protected readonly guardRunning = computed(() =>
    this.path.snapshot()?.status === "validating"
  );

  protected get data(): ApplicationData {
    return this.path.snapshot()!.data;
  }
}
