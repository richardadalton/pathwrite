import { Component, computed } from "@angular/core";
import { usePathContext } from "@daltonr/pathwrite-angular";
import { AVAILABLE_APPROVERS, type DocumentData, type ApproverResult } from "../approval.types";

@Component({
  selector: "app-summary-step",
  standalone: true,
  styles: [`
    .form-body { display: flex; flex-direction: column; gap: 18px; }
    .outcome-banner { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 8px; font-size: 14px; font-weight: 500; }
    .outcome-banner--approved { background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; }
    .outcome-banner--rejected { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; }
    .outcome-banner--mixed    { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
    .outcome-icon { font-size: 20px; }
    .review-section { margin-bottom: 4px; }
    .section-title { font-size: 11px; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 8px; }
    .review-card { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
    .review-row { display: grid; grid-template-columns: 130px 1fr; gap: 8px 16px; padding: 9px 16px; border-bottom: 1px solid #f1f3f7; font-size: 14px; }
    .review-row:last-child { border-bottom: none; }
    .review-key { color: #6b7280; font-weight: 500; }
    .approver-result-row { display: flex; align-items: flex-start; gap: 10px; padding: 10px 16px; border-bottom: 1px solid #f1f3f7; flex-wrap: wrap; }
    .approver-result-row:last-child { border-bottom: none; }
    .approver-avatar { width: 32px; height: 32px; border-radius: 50%; background: #dbeafe; color: #1d4ed8; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .approver-result-name { font-size: 14px; font-weight: 500; color: #374151; flex: 1; min-width: 100px; }
    .decision-badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; white-space: nowrap; }
    .decision-badge--approved { background: #dcfce7; color: #15803d; }
    .decision-badge--rejected { background: #fee2e2; color: #dc2626; }
    .approver-comment { font-size: 13px; color: #6b7280; font-style: italic; width: 100%; padding-left: 44px; }
  `],
  template: `
    <div class="form-body">
      <div class="outcome-banner"
        [class.outcome-banner--approved]="status() === 'approved'"
        [class.outcome-banner--rejected]="status() === 'rejected'"
        [class.outcome-banner--mixed]="status() === 'mixed'">
        <span class="outcome-icon">{{ status() === 'approved' ? '✓' : status() === 'rejected' ? '✗' : '⚠' }}</span>
        <span>
          @switch (status()) {
            @case ('approved') { All approvers approved the document. }
            @case ('rejected') { One or more approvers rejected the document. }
            @default { Mixed results — review comments below. }
          }
        </span>
      </div>

      <div class="review-section">
        <p class="section-title">Document</p>
        <div class="review-card">
          <div class="review-row"><span class="review-key">Title</span><span>{{ data.title }}</span></div>
          <div class="review-row"><span class="review-key">Description</span><span>{{ data.description }}</span></div>
        </div>
      </div>

      <div class="review-section">
        <p class="section-title">Approver Decisions</p>
        <div class="review-card">
          @for (approver of selectedApprovers(); track approver.id) {
            <div class="approver-result-row">
              <span class="approver-avatar">{{ approver.name.charAt(0) }}</span>
              <span class="approver-result-name">{{ approver.name }}</span>
              <span class="decision-badge"
                [class.decision-badge--approved]="getResult(approver.id)?.decision === 'approved'"
                [class.decision-badge--rejected]="getResult(approver.id)?.decision === 'rejected'">
                {{ getResult(approver.id)?.decision === 'approved' ? '✓ Approved' : '✗ Rejected' }}
              </span>
              @if (getResult(approver.id)?.comment) {
                <span class="approver-comment">"{{ getResult(approver.id)!.comment }}"</span>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `
})
export class SummaryStepComponent {
  protected readonly path = usePathContext<DocumentData>();

  protected get data(): DocumentData { return this.path.snapshot()!.data; }

  protected readonly selectedApprovers = computed(() =>
    AVAILABLE_APPROVERS.filter(a =>
      ((this.path.snapshot()!.data.approvers ?? []) as string[]).includes(a.id)
    )
  );

  protected readonly status = computed(() => {
    const approvers = this.selectedApprovers();
    const results = (this.data.approvalResults ?? {}) as Record<string, ApproverResult>;
    if (approvers.every(a => results[a.id]?.decision === "approved")) return "approved";
    if (approvers.some(a  => results[a.id]?.decision === "rejected"))  return "rejected";
    return "mixed";
  });

  protected getResult(id: string): ApproverResult | null {
    return (this.data.approvalResults as Record<string, ApproverResult>)?.[id] ?? null;
  }
}

