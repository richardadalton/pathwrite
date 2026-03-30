import { createMemo, Show } from "solid-js";
import { usePathContext } from "@daltonr/pathwrite-solid";
import type { ApprovalData } from "./types";

export default function DecisionStep() {
  const ctx = usePathContext<ApprovalData>();

  const errors = createMemo(() =>
    ctx.snapshot()?.hasAttemptedNext ? (ctx.snapshot()?.fieldErrors ?? {}) : {}
  );

  return (
    <Show when={ctx.snapshot()}>
      <div class="form-body">
        <p class="step-intro">
          You are reviewing <strong>{ctx.snapshot()?.data.documentTitle as string}</strong> as <strong>{ctx.snapshot()?.data.approverName as string}</strong>.
        </p>

        <div>
          <p style="font-size: 14px; font-weight: 500; color: #374151; margin: 0 0 10px;">
            Your Decision <span class="required">*</span>
          </p>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <label style="display: flex; align-items: flex-start; gap: 12px; padding: 12px 16px; border: 1px solid #e5e7eb; border-radius: 8px; cursor: pointer; background: #fff;"
              classList={{ "profile-item--done": ctx.snapshot()?.data.decision === "approved" }}>
              <input
                type="radio"
                name="decision"
                value="approved"
                checked={ctx.snapshot()?.data.decision === "approved"}
                onChange={() => ctx.setData("decision", "approved")}
                style="margin-top: 2px; accent-color: #15803d;"
              />
              <div>
                <p style="margin: 0 0 2px; font-size: 14px; font-weight: 600; color: #15803d;">✓ Approve</p>
                <p style="margin: 0; font-size: 13px; color: #6b7280;">The document is ready to proceed.</p>
              </div>
            </label>

            <label style="display: flex; align-items: flex-start; gap: 12px; padding: 12px 16px; border: 1px solid #e5e7eb; border-radius: 8px; cursor: pointer; background: #fff;"
              classList={{ "field--error": ctx.snapshot()?.data.decision === "rejected" }}>
              <input
                type="radio"
                name="decision"
                value="rejected"
                checked={ctx.snapshot()?.data.decision === "rejected"}
                onChange={() => ctx.setData("decision", "rejected")}
                style="margin-top: 2px; accent-color: #dc2626;"
              />
              <div>
                <p style="margin: 0 0 2px; font-size: 14px; font-weight: 600; color: #dc2626;">✗ Reject</p>
                <p style="margin: 0; font-size: 13px; color: #6b7280;">Changes are required before this can proceed.</p>
              </div>
            </label>
          </div>
          <Show when={errors().decision}>
            <span class="field-error" style="display: block; margin-top: 8px;">{errors().decision}</span>
          </Show>
        </div>

        <div class="field">
          <label for="comment">
            Comment <span style="font-size: 12px; color: #9ca3af; font-weight: 400;">(optional)</span>
          </label>
          <textarea
            id="comment"
            rows={3}
            value={(ctx.snapshot()?.data.comment as string) ?? ""}
            onInput={(e) => ctx.setData("comment", e.currentTarget.value)}
            placeholder="Add any notes or feedback for the document author..."
          />
        </div>
      </div>
    </Show>
  );
}
