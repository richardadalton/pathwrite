import { Component } from "@angular/core";
import { PathData } from "@daltonr/pathwrite-angular";
import { PathShellComponent, PathStepDirective } from "@daltonr/pathwrite-angular/shell";
import { approvalWorkflowPath } from "./approval.path";
import { INITIAL_DATA, AVAILABLE_APPROVERS, type DocumentData, type ApproverResult } from "./approval.types";
import { CreateDocumentStepComponent }  from "./steps/create-document-step.component";
import { SelectApproversStepComponent } from "./steps/select-approvers-step.component";
import { ApprovalReviewStepComponent }  from "./steps/approval-review-step.component";
import { SummaryStepComponent }         from "./steps/summary-step.component";
import { ViewDocumentStepComponent }    from "./steps/view-document-step.component";
import { DecisionStepComponent }        from "./steps/decision-step.component";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    PathShellComponent,
    PathStepDirective,
    CreateDocumentStepComponent,
    SelectApproversStepComponent,
    ApprovalReviewStepComponent,
    SummaryStepComponent,
    ViewDocumentStepComponent,
    DecisionStepComponent,
  ],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
})
export class AppComponent {
  protected readonly approvalWorkflowPath = approvalWorkflowPath;
  protected readonly initialData          = INITIAL_DATA;

  protected isCompleted  = false;
  protected isCancelled  = false;
  protected completedData: DocumentData | null = null;

  protected onComplete(data: PathData): void {
    this.completedData = data as DocumentData;
    this.isCompleted   = true;
  }

  protected onCancel(): void { this.isCancelled = true; }

  protected startOver(): void {
    this.isCompleted   = false;
    this.isCancelled   = false;
    this.completedData = null;
  }

  protected getApproverName(id: string): string {
    return AVAILABLE_APPROVERS.find(a => a.id === id)?.name ?? id;
  }

  protected getResult(data: DocumentData, id: string): ApproverResult | null {
    return (data.approvalResults as Record<string, ApproverResult>)?.[id] ?? null;
  }

  protected overallStatus(data: DocumentData): string {
    const ids = data.approvers as string[];
    const results = (data.approvalResults ?? {}) as Record<string, ApproverResult>;
    if (ids.every(id => results[id]?.decision === "approved")) return "approved";
    if (ids.some(id  => results[id]?.decision === "rejected"))  return "rejected";
    return "mixed";
  }
}

