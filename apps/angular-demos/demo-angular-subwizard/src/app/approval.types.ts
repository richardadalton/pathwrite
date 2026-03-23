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

export const AVAILABLE_APPROVERS = [
  { id: "alice", name: "Alice Johnson" },
  { id: "bob",   name: "Bob Smith" },
  { id: "carol", name: "Carol Williams" },
  { id: "dave",  name: "Dave Brown" },
  { id: "eve",   name: "Eve Davis" },
];

export const INITIAL_DATA: DocumentData = {
  title: "",
  description: "",
  approvers: [],
  approvalResults: {},
};

