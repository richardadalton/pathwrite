import { usePathContext } from "@daltonr/pathwrite-react";
import type { ProfileSubData } from "./wizard";

export function BackgroundStep() {
  const { snapshot, setData } = usePathContext<ProfileSubData>();
  const snap   = snapshot!;
  const data   = snap.data;
  const errors = snap.hasAttemptedNext ? snap.fieldErrors : {};

  return (
    <div className="form-body">
      <div className="subwizard-context">
        <p className="subwizard-for">Completing profile for</p>
        <p className="subwizard-name">
          {data.memberName as string}
          {data.memberRole && (
            <span className="subwizard-role"> — {data.memberRole as string}</span>
          )}
        </p>
      </div>

      <div className={`field ${errors.department ? "field--error" : ""}`}>
        <label htmlFor="department">Department <span className="required">*</span></label>
        <input
          id="department"
          type="text"
          placeholder="e.g. Engineering, Design, Product, Marketing…"
          value={(data.department as string) ?? ""}
          autoFocus
          onChange={e => setData("department", e.target.value)}
        />
        {errors.department && <span className="field-error">{errors.department}</span>}
      </div>

      <div className={`field ${errors.startDate ? "field--error" : ""}`}>
        <label htmlFor="start-date">Start Date <span className="required">*</span></label>
        <input
          id="start-date"
          type="date"
          value={(data.startDate as string) ?? ""}
          onChange={e => setData("startDate", e.target.value)}
        />
        {errors.startDate && <span className="field-error">{errors.startDate}</span>}
      </div>

      <div className={`field ${errors.bio ? "field--error" : ""}`}>
        <label htmlFor="bio">
          Short Bio <span className="required">*</span>
          <span className="field-hint">Introduce this person to the team</span>
        </label>
        <textarea
          id="bio"
          rows={6}
          placeholder="Describe their background, previous experience, what drew them to this role, and what they'll bring to the team."
          value={(data.bio as string) ?? ""}
          onChange={e => setData("bio", e.target.value)}
        />
        {errors.bio && <span className="field-error">{errors.bio}</span>}
      </div>
    </div>
  );
}
