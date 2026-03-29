import { Component } from "@angular/core";
import { usePathContext } from "@daltonr/pathwrite-angular";
import type { ApprovalData } from "../approval.types";

@Component({
  selector: "app-view-document-step",
  standalone: true,
  styles: [`
    .form-body { display: flex; flex-direction: column; gap: 18px; }
    .step-intro { margin: 0; font-size: 14px; color: #5b677a; }
    .step-note  { margin: 0; font-size: 13px; color: #9ca3af; font-style: italic; }
    .document-preview { background: #f8fafc; border: 1px solid #dbe4f0; border-left: 4px solid #2563eb; border-radius: 6px; padding: 16px 20px; }
    .document-preview__label { margin: 0 0 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #2563eb; }
    .document-preview__title { margin: 0 0 8px; font-size: 16px; font-weight: 600; color: #1f2937; }
    .document-preview__body  { margin: 0; font-size: 14px; color: #374151; line-height: 1.6; }
  `],
  template: `
    <div class="form-body">
      <p class="step-intro">Reviewing as <strong>{{ data.approverName }}</strong>. Please read the document carefully before making your decision.</p>

      <div class="document-preview">
        <p class="document-preview__label">Document</p>
        <p class="document-preview__title">{{ data.documentTitle }}</p>
        <p class="document-preview__body">{{ data.documentDescription }}</p>
      </div>

      <p class="step-note">Click <strong>Next</strong> to record your decision, or <strong>Previous</strong> to return to the approvals list.</p>
    </div>
  `
})
export class ViewDocumentStepComponent {
  protected readonly path = usePathContext<ApprovalData>();
  protected get data(): ApprovalData { return this.path.snapshot()!.data; }
}

