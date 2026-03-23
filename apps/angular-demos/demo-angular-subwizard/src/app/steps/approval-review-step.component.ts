import { Component, computed } from "@angular/core";
import { injectPath } from "@daltonr/pathwrite-angular";
import { approvalSubPath } from "../approval.path";
import { AVAILABLE_APPROVERS, type DocumentData, type ApprovalData, type ApproverResult } from "../approval.types";

@Component({
  selector: "app-approval-review-step",
  standalone: true,
  styles: [`
    .form-body { display: flex; flex-direction: column; gap: 18px; }
    .doc-summary-card { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; }
    .doc-summary-label { margin: 0 0 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; }
    .doc-summary-title { margin: 0 0 4px; font-size: 15px; font-weight: 600; color: #1f2937; }
    .doc-summary-desc  { margin: 0; font-size: 14px; color: #5b677a; }
    .pref-label { font-size: 14px; font-weight: 600; color: #374151; margin: 0 0 10px; }
    .approver-review-list { display: flex; flex-direction: column; gap: 8px; }
    .approver-review-item { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 8px; border: 1px solid #e5e7eb; background: #fff; }
    .approver-avatar { width: 32px; height: 32px; border-radius: 50%; background: #dbeafe; color: #1d4ed8; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .approver-review-name { font-size: 14px; font-weight: 500; color: #1f2937; flex: 1; }
    .btn-review { padding: 6px 14px; border-radius: 6px; border: 1px solid #2563eb; background: #eff6ff; color: #2563eb; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.15s; }
    .btn-review:hover:not(:disabled) { background: #dbeafe; }
    .btn-review:disabled { opacity: 0.5; cursor: not-allowed; }
    .decision-badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; white-space: nowrap; }
    .decision-badge--approved { background: #dcfce7; color: #15803d; }
    .decision-badge--rejected { background: #fee2e2; color: #dc2626; }
    .gate-message { margin: 0; font-size: 13px; color: #9ca3af; font-style: italic; }
    .gate-message--done { color: #15803d; font-style: normal; font-weight: 500; }
  `],
  template: `
    <div class="form-body">
      <div class="doc-summary-card">
        <p class="doc-summary-label">Document</p>
        <p class="doc-summary-title">{{ data.title }}</p>
        <p class="doc-summary-desc">{{ data.description }}</p>
      </div>

      <div>
        <p class="pref-label">Approvers</p>
        <div class="approver-review-list">
          @for (approver of selectedApprovers(); track approver.id) {
            <div class="approver-review-item">
              <span class="approver-avatar">{{ approver.name.charAt(0) }}</span>
              <span class="approver-review-name">{{ approver.name }}</span>
              @if (getResult(approver.id); as result) {
                <span class="decision-badge"
                  [class.decision-badge--approved]="result.decision === 'approved'"
                  [class.decision-badge--rejected]="result.decision === 'rejected'">
                  {{ result.decision === 'approved' ? '✓ Approved' : '✗ Rejected' }}
                </span>
              } @else {
                <button type="button" class="btn-review"
                  [disabled]="path.snapshot()?.isNavigating"
                  (click)="launchReview(approver.id, approver.name)">
                  Review →
                </button>
              }
            </div>
          }
        </div>
      </div>

      @if (errors()['_']; as msg) {
        <p class="gate-message">⏳ {{ msg }}</p>
      }
      @if (allDone()) {
        <p class="gate-message gate-message--done">✓ All approvers have responded. Click Next to continue.</p>
      }
    </div>
  `
})
export class ApprovalReviewStepComponent {
  protected readonly path   = injectPath<DocumentData>();
  protected readonly errors = computed(() => {
    const s = this.path.snapshot();
    return s?.hasAttemptedNext ? s.fieldMessages : {};
  });

  protected get data(): DocumentData { return this.path.snapshot()!.data; }

  protected readonly selectedApprovers = computed(() =>
    AVAILABLE_APPROVERS.filter(a =>
      ((this.path.snapshot()!.data.approvers ?? []) as string[]).includes(a.id)
    )
  );

  protected readonly allDone = computed(() => {
    const approvers = this.selectedApprovers();
    return approvers.length > 0 && approvers.every(a => !!this.getResult(a.id)?.decision);
  });

  protected getResult(id: string): ApproverResult | null {
    return (this.data.approvalResults as Record<string, ApproverResult>)?.[id] ?? null;
  }

  protected launchReview(approverId: string, approverName: string): void {
    const initialData: ApprovalData = {
      approverId,
      approverName,
      documentTitle:       this.data.title       ?? "",
      documentDescription: this.data.description ?? "",
      decision: "",
      comment:  "",
    };
    this.path.startSubPath(approvalSubPath, initialData, { approverId });
  }
}

