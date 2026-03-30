import { createMemo, Show, For } from "solid-js";
import { usePathContext } from "@daltonr/pathwrite-solid";
import { AVAILABLE_APPROVERS } from "./approval";
import type { DocumentData } from "./types";

export default function SelectApproversStep() {
  const ctx = usePathContext<DocumentData>();

  const errors = createMemo(() =>
    ctx.snapshot()?.hasAttemptedNext ? (ctx.snapshot()?.fieldErrors ?? {}) : {}
  );

  const selected = createMemo(() =>
    (ctx.snapshot()?.data.approvers ?? []) as string[]
  );

  function toggle(id: string) {
    const current = selected();
    const updated = current.includes(id)
      ? current.filter(a => a !== id)
      : [...current, id];
    ctx.setData("approvers", updated);
  }

  return (
    <Show when={ctx.snapshot()}>
      <div class="form-body">
        <p class="step-intro">
          Choose who needs to approve this document. All selected approvers must review before the workflow can proceed.
        </p>

        <div>
          <p class="section-title" style="text-transform: none; letter-spacing: 0; font-size: 14px; font-weight: 500; color: #374151;">
            Available Approvers
          </p>
          <div class="approver-list">
            <For each={AVAILABLE_APPROVERS}>
              {(approver) => (
                <label
                  class="approver-item"
                  style="cursor: pointer;"
                  classList={{ "profile-item--done": selected().includes(approver.id) }}
                >
                  <input
                    type="checkbox"
                    checked={selected().includes(approver.id)}
                    onChange={() => toggle(approver.id)}
                  />
                  <div class="member-avatar">{approver.name.charAt(0)}</div>
                  <span class="approver-name">{approver.name}</span>
                </label>
              )}
            </For>
          </div>
          <Show when={errors().approvers}>
            <span class="field-error" style="display: block; margin-top: 8px;">{errors().approvers}</span>
          </Show>
        </div>

        <Show when={selected().length > 0}>
          <p style="font-size: 13px; color: #6b7280; margin: 0;">
            {selected().length} approver{selected().length !== 1 ? "s" : ""} selected
          </p>
        </Show>
      </div>
    </Show>
  );
}
