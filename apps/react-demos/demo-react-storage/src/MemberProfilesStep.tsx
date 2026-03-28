import { usePathContext } from "@daltonr/pathwrite-react";
import { memberProfileSubPath } from "./wizard";
import type { WizardData, Person, MemberProfile, ProfileSubData } from "./wizard";

export function MemberProfilesStep() {
  const { snapshot, startSubPath } = usePathContext<WizardData>();
  const snap     = snapshot!;
  const data     = snap.data;
  const members  = (data.members ?? []) as Person[];
  const profiles = (data.profiles ?? {}) as Record<string, MemberProfile>;
  const errors   = snap.hasAttemptedNext ? snap.fieldErrors : {};

  function getProfile(index: number): MemberProfile | null {
    return profiles[String(index)] ?? null;
  }

  const allDone =
    members.length > 0 &&
    members.every((_, i) => !!getProfile(i)?.department);

  async function openProfile(member: Person, index: number) {
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
    await startSubPath(memberProfileSubPath, initialData, { memberIndex: index });
  }

  return (
    <div className="form-body">
      <p className="step-intro">
        Complete a profile for each team member. Click <strong>Fill in Profile</strong> to open a
        short two-step wizard, then return here when done. You can edit any profile before moving on.
      </p>

      <div className="profile-list">
        {members.map((member, i) => {
          const profile = getProfile(i);
          return (
            <div
              key={i}
              className={`profile-item ${profile ? "profile-item--done" : ""}`}
            >
              <span className="member-avatar">{member.name.charAt(0).toUpperCase()}</span>

              <div className="profile-item-info">
                <span className="profile-item-name">{member.name}</span>
                {member.role && <span className="profile-item-role">{member.role}</span>}
              </div>

              {profile ? (
                <>
                  <div className="profile-done-meta">
                    <span className="profile-done-dept">{profile.department}</span>
                    <span className="profile-done-badge">✓ Done</span>
                  </div>
                  <button
                    type="button"
                    className="btn-edit"
                    disabled={snap.isNavigating}
                    onClick={() => openProfile(member, i)}
                  >Edit</button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn-fill"
                  disabled={snap.isNavigating}
                  onClick={() => openProfile(member, i)}
                >Fill in Profile →</button>
              )}
            </div>
          );
        })}
      </div>

      {allDone ? (
        <p className="gate-done">
          ✓ All {members.length} profiles complete — click Next to review.
        </p>
      ) : errors._ ? (
        <p className="gate-pending">⏳ {errors._}</p>
      ) : null}
    </div>
  );
}
