import type { PathDefinition } from "@daltonr/pathwrite-core";
import type { DocumentData, ApprovalData, ApproverResult } from "./types";

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

export const approvalSubPath: PathDefinition<ApprovalData> = {
  id: "approval",
  steps: [
    { id: "view-document", title: "Review Document" },
    {
      id: "decision",
      title: "Your Decision",
      fieldErrors: ({ data }) => ({
        decision: !data.decision ? "Please select approve or reject." : undefined,
      }),
    },
  ],
};

export const approvalWorkflowPath: PathDefinition<DocumentData> = {
  id: "approval-workflow",
  steps: [
    {
      id: "create-document",
      title: "Create Document",
      fieldErrors: ({ data }) => ({
        title:       !data.title?.toString().trim()       ? "Document title is required." : undefined,
        description: !data.description?.toString().trim() ? "Description is required."   : undefined,
      }),
    },
    {
      id: "select-approvers",
      title: "Select Approvers",
      fieldErrors: ({ data }) => ({
        approvers: !(data.approvers as string[])?.length ? "Select at least one approver." : undefined,
      }),
    },
    {
      id: "approval-review",
      title: "Awaiting Approvals",
      fieldErrors: ({ data }) => {
        const results = (data.approvalResults ?? {}) as Record<string, ApproverResult>;
        const pending = (data.approvers as string[]).filter(id => !results[id]?.decision);
        return {
          _: pending.length > 0
            ? `Waiting for ${pending.length} approver${pending.length !== 1 ? "s" : ""} to complete their review.`
            : undefined,
        };
      },
      onSubPathComplete(_subPathId, subPathData, ctx, meta) {
        const approverId = meta?.approverId as string;
        const existing = (ctx.data.approvalResults ?? {}) as Record<string, ApproverResult>;
        return {
          approvalResults: {
            ...existing,
            [approverId]: {
              decision: subPathData.decision as "approved" | "rejected",
              comment:  (subPathData.comment as string) ?? "",
            },
          },
        };
      },
    },
    { id: "summary", title: "Summary" },
  ],
};
