import { usePathContext } from "@daltonr/pathwrite-react";
import type { ApplicationData } from "./application-path";

export function EligibilityStep() {
  const { snapshot } = usePathContext<ApplicationData>();
  const snap = snapshot!;

  // status === "validating" means canMoveNext is currently running.
  const guardRunning = snap.status === "validating";

  return (
    <div className="form-body">
      <p className="step-intro">
        Clicking <strong>Next</strong> runs an async eligibility check against
        our API. The check takes ~900ms — watch the spinner on the button.
      </p>

      <div className="eligibility-summary">
        <div className="summary-row">
          <span className="summary-key">Role</span>
          <span>{snap.data.roleId || "—"}</span>
        </div>
        <div className="summary-row">
          <span className="summary-key">Experience</span>
          <span>{snap.data.yearsExperience ? `${snap.data.yearsExperience} years` : "—"}</span>
        </div>
        <div className="summary-row">
          <span className="summary-key">Skills</span>
          <span>{(snap.data.skills as string) || "—"}</span>
        </div>
      </div>

      {!guardRunning && (
        <p className="hint">
          <strong>What's happening:</strong> <code>canMoveNext</code> is async
          — it calls <code>services.checkEligibility()</code> and the engine
          awaits the result before deciding whether to advance. While it runs,{" "}
          <code>snapshot.status === "validating"</code>, and the shell shows a
          CSS spinner on the Next button. If blocked, the guard returns{" "}
          <code>{"{ allowed: false, reason }"}</code> and the shell renders{" "}
          <code>snapshot.blockingError</code> automatically.
        </p>
      )}
    </div>
  );
}
