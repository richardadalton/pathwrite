import { Component, computed } from "@angular/core";
import { usePathContext } from "@daltonr/pathwrite-angular";
import type { ApplicationData } from "../application-path";

@Component({
  selector: "app-cover-letter-step",
  standalone: true,
  styles: [`
    .form-body { display: flex; flex-direction: column; gap: 18px; }
    .step-intro { margin: 0; font-size: 14px; color: #5b677a; line-height: 1.6; }
    .step-intro strong { color: #1f2937; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field label { font-size: 14px; font-weight: 500; color: #374151; }
    .field textarea {
      border: 1px solid #c2d0e5; border-radius: 6px; padding: 9px 12px; font-size: 14px;
      font-family: inherit; color: #1f2937; background: #fff; width: 100%; resize: vertical;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .field textarea:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
    .field--error textarea { border-color: #dc2626; }
    .field-error { font-size: 13px; color: #dc2626; }
    .hint { margin: 0; font-size: 13px; color: #6b7280; line-height: 1.6; padding: 10px 14px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 6px; }
    .hint code { font-size: 12px; background: #eef2ff; color: #4f46e5; padding: 1px 5px; border-radius: 4px; }
    .hint strong { color: #374151; }
  `],
  template: `
    <div class="form-body">
      <p class="step-intro">
        This step uses an async <code>shouldSkip</code>. Selecting
        <strong>Software Engineer</strong> or <strong>Data Scientist</strong> on the first
        step routes here; other roles skip straight to Review.
      </p>

      <div class="field" [class.field--error]="errors()['coverLetter']">
        <label for="coverLetter">Cover Letter</label>
        <textarea
          id="coverLetter"
          rows="5"
          [value]="data.coverLetter ?? ''"
          (input)="path.setData('coverLetter', $any($event.target).value)"
          placeholder="Tell us why you're a great fit for this role…"
        ></textarea>
        @if (errors()['coverLetter']; as msg) {
          <span class="field-error">{{ msg }}</span>
        }
      </div>

      <p class="hint">
        <strong>What's happening:</strong> <code>shouldSkip</code> called
        <code>svc.requiresCoverLetter(roleId)</code> asynchronously. Before that resolved,
        <code>snapshot().stepCount</code> included this step optimistically. Once navigation
        walked past it, the engine cached the result and the progress bar reflects the true
        visible count.
      </p>
    </div>
  `
})
export class CoverLetterStepComponent {
  protected readonly path = usePathContext<ApplicationData>();

  protected readonly errors = computed(() => {
    const s = this.path.snapshot();
    return s?.hasAttemptedNext ? s.fieldErrors : {};
  });

  protected get data(): ApplicationData {
    return this.path.snapshot()!.data;
  }
}
