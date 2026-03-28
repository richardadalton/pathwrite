import { usePathContext } from "@daltonr/pathwrite-react";
import type { ProfileSubData } from "./wizard";

export function GoalsStep() {
  const { snapshot, setData } = usePathContext<ProfileSubData>();
  const snap   = snapshot!;
  const data   = snap.data;
  const errors = snap.hasAttemptedNext ? snap.fieldErrors : {};

  return (
    <div className="form-body">
      <div className="subwizard-context">
        <p className="subwizard-for">Goals for</p>
        <p className="subwizard-name">
          {data.memberName as string}
          {data.memberRole && (
            <span className="subwizard-role"> — {data.memberRole as string}</span>
          )}
        </p>
      </div>

      <div className={`field ${errors.goals30 ? "field--error" : ""}`}>
        <label htmlFor="goals30">
          30-Day Goals <span className="required">*</span>
        </label>
        <textarea
          id="goals30"
          rows={4}
          placeholder="What should this person achieve in their first 30 days?"
          value={(data.goals30 as string) ?? ""}
          autoFocus
          onChange={e => setData("goals30", e.target.value)}
        />
        {errors.goals30 && <span className="field-error">{errors.goals30}</span>}
      </div>

      <div className={`field ${errors.goals90 ? "field--error" : ""}`}>
        <label htmlFor="goals90">
          90-Day Goals <span className="required">*</span>
        </label>
        <textarea
          id="goals90"
          rows={4}
          placeholder="What milestones should they hit by the end of 90 days?"
          value={(data.goals90 as string) ?? ""}
          onChange={e => setData("goals90", e.target.value)}
        />
        {errors.goals90 && <span className="field-error">{errors.goals90}</span>}
      </div>
    </div>
  );
}
