import { usePathContext } from "@daltonr/pathwrite-react";
import type { WizardData, Person } from "./wizard";

export function TeamSetupStep() {
  const { snapshot, setData } = usePathContext<WizardData>();
  const snap     = snapshot!;
  const data     = snap.data;
  const errors   = snap.hasAttemptedNext ? snap.fieldErrors : {};
  const members  = (data.members ?? []) as Person[];
  const teamName = (data.teamName ?? "") as string;

  function updateTeamName(value: string) {
    setData("teamName", value);
  }

  function addMember() {
    setData("members", [...members, { name: "", role: "" }]);
  }

  function removeMember(index: number) {
    setData("members", members.filter((_, i) => i !== index));
  }

  function updateMemberName(index: number, value: string) {
    setData("members", members.map((m, i) => i === index ? { ...m, name: value } : m));
  }

  function updateMemberRole(index: number, value: string) {
    setData("members", members.map((m, i) => i === index ? { ...m, role: value } : m));
  }

  return (
    <div className="form-body">
      <p className="step-intro">
        Enter your team's name and add everyone you'll be onboarding. You'll fill in a detailed
        profile for each person on the next step.
      </p>

      {/* Team name */}
      <div className={`field ${errors.teamName ? "field--error" : ""}`}>
        <label htmlFor="team-name">
          Team Name <span className="required">*</span>
        </label>
        <input
          id="team-name"
          type="text"
          placeholder="e.g. Platform Engineering"
          value={teamName}
          onChange={e => updateTeamName(e.target.value)}
          autoFocus
        />
        {errors.teamName && <span className="field-error">{errors.teamName}</span>}
      </div>

      {/* Members list */}
      <div>
        <div className="members-header">
          <p className="section-label">Team Members <span className="required">*</span></p>
          <button type="button" className="btn-add" onClick={addMember}>+ Add Member</button>
        </div>

        {members.length === 0 ? (
          <div className="empty-members">
            <span className="empty-members__icon">👥</span>
            <p>No members yet. Click <strong>+ Add Member</strong> to get started.</p>
          </div>
        ) : (
          <div className="member-list">
            {members.map((member, i) => (
              <div key={i} className="member-row">
                <span className="member-number">{i + 1}</span>
                <div className="member-fields">
                  <input
                    type="text"
                    placeholder="Full name *"
                    value={member.name}
                    onChange={e => updateMemberName(i, e.target.value)}
                    className={`member-name-input ${errors.members && snap.hasAttemptedNext && !member.name.trim() ? "input--error" : ""}`}
                  />
                  <input
                    type="text"
                    placeholder="Role / title (optional)"
                    value={member.role}
                    onChange={e => updateMemberRole(i, e.target.value)}
                    className="member-role-input"
                  />
                </div>
                <button
                  type="button"
                  className="btn-remove"
                  onClick={() => removeMember(i)}
                  title="Remove member"
                >✕</button>
              </div>
            ))}
          </div>
        )}

        {errors.members && <span className="field-error">{errors.members}</span>}
      </div>
    </div>
  );
}
