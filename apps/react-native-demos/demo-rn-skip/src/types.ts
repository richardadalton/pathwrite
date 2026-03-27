export interface ApproverResult {
  decision: "approved" | "rejected";
  comment: string;
}

export interface DocumentData {
  title: string;
  description: string;
  approvers: string[];
  approvalResults: Record<string, ApproverResult>;
  [key: string]: unknown;
}

export interface ApprovalData {
  approverId: string;
  approverName: string;
  documentTitle: string;
  documentDescription: string;
  decision: "approved" | "rejected" | "";
  comment: string;
  [key: string]: unknown;
}
