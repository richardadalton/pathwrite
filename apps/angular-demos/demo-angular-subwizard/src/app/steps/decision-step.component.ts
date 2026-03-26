import { Component, computed } from "@angular/core";
import { injectPath } from "@daltonr/pathwrite-angular";
import type { ApprovalData } from "../approval.types";

@Component({
  selector: "app-decision-step",
  standalone: true,
  styles: [`
    .form-body { display: flex; flex-direction: column; gap: 18px; }
    .step-intro { margin: 0; font-size: 14px; color: #5b677a; }
    .pref-label { font-size: 14px; font-weight: 600; color: #374151; margin: 0 0 10px; }
    .required { color: #dc2626; font-size: 13px; }
    .optional { font-size: 12px; color: #9ca3af; font-weight: 400; }
    .radio-group { display: flex; flex-direction: column; gap: 10px; }
    .radio-option { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 8px; border: 1px solid #e5e7eb; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
    .radio-option--selected { border-color: #2563eb; background: #eff6ff; }
    .radio-option--approved { border-color: #16a34a; background: #f0fdf4; }
    .radio-option--rejected { border-color: #dc2626; background: #fef2f2; }
    .radio-option input[type="radio"] { accent-color: #2563eb; width: 16px; height: 16px; cursor: pointer; flex-shrink: 0; }
    .radio-option-label { font-size: 14px; font-weight: 600; color: #374151; }
    .radio-option-desc  { font-size: 12px; color: #9ca3af; margin-left: auto; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field label { font-size: 14px; font-weight: 500; color: #374151; display: flex; align-items: baseline; gap: 4px; }
    .field textarea { border: 1px solid #c2d0e5; border-radius: 6px; padding: 9px 12px; font-size: 14px; font-family: inherit; color: #1f2937; background: #fff; width: 100%; resize: vertical; }
    .field textarea:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
    .field-error { font-size: 13px; color: #dc2626; }
  `],
  template: `
    <div class="form-body">
      <p class="step-intro">You are reviewing <strong>{{ data.documentTitle }}</strong> as <strong>{{ data.approverName }}</strong>.</p>

      <div>
        <p class="pref-label">Your Decision <span class="required">*</span></p>
        <div class="radio-group">
          <label class="radio-option" [class.radio-option--approved]="data.decision === 'approved'">
            <input type="radio" name="decision" value="approved"
              [checked]="data.decision === 'approved'"
              (change)="path.setData('decision', 'approved')" />
            <span class="radio-option-label">✓ Approve</span>
            <span class="radio-option-desc">The document is ready to proceed.</span>
          </label>
          <label class="radio-option" [class.radio-option--rejected]="data.decision === 'rejected'">
            <input type="radio" name="decision" value="rejected"
              [checked]="data.decision === 'rejected'"
              (change)="path.setData('decision', 'rejected')" />
            <span class="radio-option-label">✗ Reject</span>
            <span class="radio-option-desc">Changes are required before this can proceed.</span>
          </label>
        </div>
        @if (errors()['decision']; as msg) { <span class="field-error">{{ msg }}</span> }
      </div>

      <div class="field">
        <label for="comment">Comment <span class="optional">(optional)</span></label>
        <textarea id="comment" [value]="data.comment ?? ''" rows="3"
          (input)="path.setData('comment', $any($event.target).value)"
          placeholder="Add any notes or feedback for the document author..."></textarea>
      </div>
    </div>
  `
})
export class DecisionStepComponent {
  protected readonly path   = injectPath<ApprovalData>();
  protected readonly errors = computed(() => {
    const s = this.path.snapshot();
    return s?.hasAttemptedNext ? s.fieldErrors : {};
  });
  protected get data(): ApprovalData { return this.path.snapshot()!.data; }
}

