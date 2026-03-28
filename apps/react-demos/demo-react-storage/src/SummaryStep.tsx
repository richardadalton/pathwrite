import { usePathContext } from "@daltonr/pathwrite-react";
import type { WizardData, Person, MemberProfile } from "./wizard";

function formatDate(d: string): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-IE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return d;
  }
}

export function SummaryStep() {
  const { snapshot } = usePathContext<WizardData>();
  const data     = snapshot!.data;
  const members  = (data.members ?? []) as Person[];
  const profiles = (data.profiles ?? {}) as Record<string, MemberProfile>;

  return (
    <div className="form-body">
      <p className="step-intro">
        Review all team member profiles before submitting. Everything looks good? Click{" "}
        <strong>Submit Onboarding</strong>.
      </p>

      <div className="review-section">
        <p className="section-title">Team</p>
        <div className="review-card">
          <div className="review-row">
            <span className="review-key">Team Name</span>
            <span>{data.teamName as string}</span>
          </div>
          <div className="review-row">
            <span className="review-key">Members</span>
            <span>{members.length}</span>
          </div>
        </div>
      </div>

      {members.map((member, i) => {
        const profile = profiles[String(i)];
        return (
          <div key={i} className="review-section">
            <p className="section-title">
              {member.name}
              {member.role && <span className="section-title-sub"> — {member.role}</span>}
            </p>
            {profile ? (
              <div className="review-card">
                <div className="review-row">
                  <span className="review-key">Department</span>
                  <span>{profile.department}</span>
                </div>
                <div className="review-row">
                  <span className="review-key">Start Date</span>
                  <span>{formatDate(profile.startDate)}</span>
                </div>
                <div className="review-row">
                  <span className="review-key">Bio</span>
                  <span>{profile.bio}</span>
                </div>
                <div className="review-row">
                  <span className="review-key">30-Day Goals</span>
                  <span>{profile.goals30}</span>
                </div>
                <div className="review-row">
                  <span className="review-key">90-Day Goals</span>
                  <span>{profile.goals90}</span>
                </div>
              </div>
            ) : (
              <div className="review-card">
                <div className="review-row">
                  <span className="review-key">Profile</span>
                  <span className="text-pending">Not completed</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
