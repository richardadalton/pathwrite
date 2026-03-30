import { createMemo, Show, For } from "solid-js";
import { usePathContext } from "@daltonr/pathwrite-solid";
import type { WizardData, Person } from "./wizard";

export default function TeamSetupStep() {
  const ctx = usePathContext<WizardData>();

  const members = createMemo(() =>
    (ctx.snapshot()?.data.members ?? []) as Person[]
  );

  const errors = createMemo(() =>
    ctx.snapshot()?.hasAttemptedNext ? (ctx.snapshot()?.fieldErrors ?? {}) : {}
  );

  function addMember() {
    ctx.setData("members", [...members(), { name: "", role: "" }]);
  }

  function removeMember(index: number) {
    ctx.setData("members", members().filter((_, i) => i !== index));
  }

  function updateMemberName(index: number, value: string) {
    ctx.setData("members", members().map((m, i) => i === index ? { ...m, name: value } : m));
  }

  function updateMemberRole(index: number, value: string) {
    ctx.setData("members", members().map((m, i) => i === index ? { ...m, role: value } : m));
  }

  return (
    <Show when={ctx.snapshot()}>
      <div class="form-body">
        <p class="step-intro">
          Enter your team's name and add everyone you'll be onboarding. You'll fill in a detailed
          profile for each person on the next step.
        </p>

        {/* Team name */}
        <div class="field" classList={{ "field--error": !!errors().teamName }}>
          <label for="team-name">Team Name <span class="required">*</span></label>
          <input
            id="team-name"
            type="text"
            placeholder="e.g. Platform Engineering"
            value={(ctx.snapshot()?.data.teamName as string) ?? ""}
            onInput={(e) => ctx.setData("teamName", e.currentTarget.value)}
          />
          <Show when={errors().teamName}>
            <p class="field-error">{errors().teamName}</p>
          </Show>
        </div>

        {/* Members list */}
        <div>
          <div class="members-header">
            <p class="section-label">Team Members <span class="required">*</span></p>
            <button type="button" class="btn-add" onClick={addMember}>+ Add Member</button>
          </div>

          <Show when={members().length === 0}>
            <div class="empty-members">
              <span class="empty-members__icon">👥</span>
              <p>No members yet. Click <strong>+ Add Member</strong> to get started.</p>
            </div>
          </Show>

          <Show when={members().length > 0}>
            <div class="member-list">
              <For each={members()}>
                {(member, i) => (
                  <div class="member-row">
                    <span class="member-number">{i() + 1}</span>
                    <div class="member-fields">
                      <input
                        type="text"
                        placeholder="Full name *"
                        value={member.name}
                        onInput={(e) => updateMemberName(i(), e.currentTarget.value)}
                        class="member-name-input"
                        classList={{ "input--error": !!errors().members && !member.name.trim() }}
                      />
                      <input
                        type="text"
                        placeholder="Role / title (optional)"
                        value={member.role}
                        onInput={(e) => updateMemberRole(i(), e.currentTarget.value)}
                        class="member-role-input"
                      />
                    </div>
                    <button
                      type="button"
                      class="btn-remove"
                      onClick={() => removeMember(i())}
                      title="Remove member"
                    >✕</button>
                  </div>
                )}
              </For>
            </div>
          </Show>

          <Show when={errors().members}>
            <p class="field-error">{errors().members}</p>
          </Show>
        </div>
      </div>
    </Show>
  );
}
