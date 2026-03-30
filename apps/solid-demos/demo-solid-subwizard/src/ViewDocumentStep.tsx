import { Show } from "solid-js";
import { usePathContext } from "@daltonr/pathwrite-solid";
import type { ApprovalData } from "./types";

export default function ViewDocumentStep() {
  const ctx = usePathContext<ApprovalData>();

  return (
    <Show when={ctx.snapshot()}>
      <div class="form-body">
        <p class="step-intro">
          Reviewing as <strong>{ctx.snapshot()?.data.approverName as string}</strong>. Please read the document carefully before making your decision.
        </p>

        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px 20px 16px;">
          <p style="margin: 0 0 4px; font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em;">Document</p>
          <p style="margin: 0 0 10px; font-size: 17px; font-weight: 600; color: #1f2937;">{ctx.snapshot()?.data.documentTitle as string}</p>
          <p style="margin: 0; font-size: 14px; color: #374151; white-space: pre-wrap;">{ctx.snapshot()?.data.documentDescription as string}</p>
        </div>

        <p style="font-size: 14px; color: #6b7280; margin: 0;">
          Click <strong>Next</strong> to record your decision, or <strong>Previous</strong> to return to the approvals list.
        </p>
      </div>
    </Show>
  );
}
