import { createMemo, Show, For } from "solid-js";
import { usePathContext } from "@daltonr/pathwrite-solid";
import { AVAILABLE_APPROVERS } from "./approval";
import type { DocumentData, ApproverResult } from "./types";

export default function SummaryStep() {
  const ctx = usePathContext<DocumentData>();

  const data = createMemo(() => ctx.snapshot()?.data);

  const results = createMemo(() =>
    (data()?.approvalResults ?? {}) as Record<string, ApproverResult>
  );

  const selectedApprovers = createMemo(() =>
    AVAILABLE_APPROVERS.filter(a => ((data()?.approvers ?? []) as string[]).includes(a.id))
  );

  const status = createMemo((): "approved" | "rejected" | "mixed" => {
    const approvers = selectedApprovers();
    if (approvers.every(a => results()[a.id]?.decision === "approved")) return "approved";
    if (approvers.some(a  => results()[a.id]?.decision === "rejected"))  return "rejected";
    return "mixed";
  });

  const bannerStyle = createMemo(() => {
    const s = status();
    if (s === "approved") return "background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; display: flex; align-items: center; gap: 10px; font-size: 14px; color: #15803d;";
    if (s === "rejected") return "background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; display: flex; align-items: center; gap: 10px; font-size: 14px; color: #dc2626;";
    return "background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px; display: flex; align-items: center; gap: 10px; font-size: 14px; color: #92400e;";
  });

  return (
    <Show when={ctx.snapshot()}>
      <div class="form-body">
        <div style={bannerStyle()}>
          <span style="font-size: 20px;">
            {status() === "approved" ? "✓" : status() === "rejected" ? "✗" : "⚠"}
          </span>
          <span>
            {status() === "approved"
              ? "All approvers approved the document."
              : status() === "rejected"
              ? "One or more approvers rejected the document."
              : "Mixed results — review comments below."}
          </span>
        </div>

        <div class="review-section">
          <p class="section-title">Document</p>
          <div class="review-card">
            <div class="review-row">
              <span class="review-key">Title</span>
              <span>{data()?.title}</span>
            </div>
            <div class="review-row">
              <span class="review-key">Description</span>
              <span>{data()?.description}</span>
            </div>
          </div>
        </div>

        <div class="review-section" style="margin-bottom: 0;">
          <p class="section-title">Approver Decisions</p>
          <div class="review-card">
            <For each={selectedApprovers()}>
              {(approver) => (
                <div style="display: flex; align-items: flex-start; gap: 10px; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
                  <div class="member-avatar" style="width: 28px; height: 28px; font-size: 12px; flex-shrink: 0;">{approver.name.charAt(0)}</div>
                  <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                      <span style="font-size: 14px; font-weight: 500; color: #1f2937;">{approver.name}</span>
                      <span classList={{
                        "text-approved": results()[approver.id]?.decision === "approved",
                        "text-rejected": results()[approver.id]?.decision === "rejected",
                      }} style="font-size: 13px;">
                        {results()[approver.id]?.decision === "approved" ? "✓ Approved" : "✗ Rejected"}
                      </span>
                    </div>
                    <Show when={results()[approver.id]?.comment}>
                      <p style="margin: 0; font-size: 13px; color: #6b7280; font-style: italic;">
                        "{results()[approver.id].comment}"
                      </p>
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>
    </Show>
  );
}
