import { createMemo, Show, For } from "solid-js";
import { usePathContext } from "@daltonr/pathwrite-solid";
import { memberProfileSubPath } from "./wizard";
import type { WizardData, Person, MemberProfile, ProfileSubData } from "./wizard";

export default function MemberProfilesStep() {
  const ctx = usePathContext<WizardData>();

  const members = createMemo(() =>
    (ctx.snapshot()?.data.members ?? []) as Person[]
  );

  const profiles = createMemo(() =>
    (ctx.snapshot()?.data.profiles ?? {}) as Record<string, MemberProfile>
  );

  const errors = createMemo(() =>
    ctx.snapshot()?.hasAttemptedNext ? (ctx.snapshot()?.fieldErrors ?? {}) : {}
  );

  function getProfile(index: number): MemberProfile | null {
    return profiles()[String(index)] ?? null;
  }

  const allDone = createMemo(() =>
    members().length > 0 &&
    members().every((_, i) => !!getProfile(i)?.department)
  );

  function openProfile(member: Person, index: number) {
    const existing = getProfile(index);
    const initialData: ProfileSubData = {
      memberName:  member.name,
      memberRole:  member.role,
      memberIndex: index,
      department: existing?.department ?? "",
      startDate:  existing?.startDate  ?? "",
      bio:        existing?.bio        ?? "",
      goals30:    existing?.goals30    ?? "",
      goals90:    existing?.goals90    ?? "",
    };
    ctx.startSubPath(memberProfileSubPath, initialData, { memberIndex: index });
  }

  return (
    <Show when={ctx.snapshot()}>
      <div class="form-body">
        <p class="step-intro">
          Complete a profile for each team member. Click <strong>Fill in Profile</strong> to open a
          short two-step wizard, then return here when done. You can edit any profile before moving on.
        </p>

        <div class="profile-list">
          <For each={members()}>
            {(member, i) => (
              <div class="profile-item" classList={{ "profile-item--done": !!getProfile(i()) }}>
                <div class="member-avatar">{member.name.charAt(0).toUpperCase()}</div>

                <div class="profile-item-info">
                  <p class="profile-item-name">{member.name}</p>
                  <Show when={member.role}>
                    <p class="profile-item-role">{member.role}</p>
                  </Show>
                </div>

                <Show when={getProfile(i())}>
                  <div class="profile-done-meta">
                    <span class="profile-done-dept">{getProfile(i())!.department}</span>
                    <span class="profile-done-badge">✓ Done</span>
                  </div>
                  <button
                    type="button"
                    class="btn-edit"
                    disabled={ctx.snapshot()?.isNavigating}
                    onClick={() => openProfile(member, i())}
                  >Edit</button>
                </Show>

                <Show when={!getProfile(i())}>
                  <button
                    type="button"
                    class="btn-fill"
                    disabled={ctx.snapshot()?.isNavigating}
                    onClick={() => openProfile(member, i())}
                  >Fill in Profile →</button>
                </Show>
              </div>
            )}
          </For>
        </div>

        <Show when={allDone()}>
          <p class="gate-done">✓ All {members().length} profiles complete — click Next to review.</p>
        </Show>
        <Show when={!allDone() && errors()._}>
          <p class="gate-pending">⏳ {errors()._}</p>
        </Show>
      </div>
    </Show>
  );
}
