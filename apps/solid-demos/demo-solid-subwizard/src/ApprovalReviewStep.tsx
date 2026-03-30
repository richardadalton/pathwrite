import { createMemo, Show, For } from "solid-js";
import { usePathContext } from "@daltonr/pathwrite-solid";
import { approvalSubPath, AVAILABLE_APPROVERS } from "./approval";
import type { DocumentData, ApprovalData, ApproverResult } from "./types";

export default function ApprovalReviewStep() {
  const ctx = usePathContext<DocumentData>();

  const errors = createMemo(() =>
    ctx.snapshot()?.hasAttemptedNext ? (ctx.snapshot()?.fieldErrors ?? {}) : {}
  );

  const data = createMemo(() => ctx.snapshot()?.data);

  const results = createMemo(() =>
    (data()?.approvalResults ?? {}) as Record<string, ApproverResult>
  );

  const selectedApprovers = createMemo(() =>
    AVAILABLE_APPROVERS.filter(a => ((data()?.approvers ?? []) as string[]).includes(a.id))
  );

  const allDone = createMemo(() =>
    selectedApprovers().length > 0 &&
    selectedApprovers().every(a => !!results()[a.id]?.decision)
  );

  function launchReview(approverId: string, approverName: string) {
    const d = data();
    const initialData: ApprovalData = {
      approverId,
      approverName,
      documentTitle:       d?.title       ?? "",
      documentDescription: d?.description ?? "",
      decision: "",
      comment:  "",
    };
    ctx.startSubPath(approvalSubPath, initialData, { approverId });
  }

  return (
    <Show when={ctx.snapshot()}>
      <div class="form-body">
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px;">
          <p style="margin: 0 0 2px; font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em;">Document</p>
          <p style="margin: 0 0 2px; font-size: 15px; font-weight: 600; color: #1f2937;">{data()?.title}</p>
          <p style="margin: 0; font-size: 13px; color: #6b7280;">{data()?.description}</p>
        </div>

        <div>
          <p class="section-title">Approvers</p>
          <div class="profile-list">
            <For each={selectedApprovers()}>
              {(approver) => (
                <div class="profile-item" classList={{ "profile-item--done": !!results()[approver.id]?.decision }}>
                  <div class="member-avatar">{approver.name.charAt(0)}</div>
                  <div class="profile-item-info">
                    <p class="profile-item-name">{approver.name}</p>
                  </div>

                  <Show when={results()[approver.id]?.decision}>
                    <div class="profile-done-meta">
                      <span classList={{
                        "text-approved": results()[approver.id]?.decision === "approved",
                        "text-rejected": results()[approver.id]?.decision === "rejected",
                      }} style="font-size: 13px; font-weight: 500;">
                        {results()[approver.id]?.decision === "approved" ? "✓ Approved" : "✗ Rejected"}
                      </span>
                    </div>
                  </Show>

                  <Show when={!results()[approver.id]?.decision}>
                    <button
                      type="button"
                      class="btn-fill"
                      disabled={ctx.snapshot()?.isNavigating}
                      onClick={() => launchReview(approver.id, approver.name)}
                    >
                      Review →
                    </button>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </div>

        <Show when={allDone()}>
          <p class="gate-done">✓ All approvers have responded. Click Next to continue.</p>
        </Show>
        <Show when={ctx.snapshot()?.hasAttemptedNext && errors()._}>
          <p class="gate-pending">⏳ {errors()._}</p>
        </Show>
      </div>
    </Show>
  );
}
