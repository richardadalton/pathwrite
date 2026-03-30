export interface DocumentData {
  title: string;
  description: string;
  approvers: string[];
  approvalResults: Record<string, ApproverResult>;
  [key: string]: unknown;
}
export interface ApprovalData {
  decision: string;
  comment: string;
  [key: string]: unknown;
}
export interface ApproverResult {
  decision: "approved" | "rejected";
  comment: string;
}
