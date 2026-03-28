import { useEffect, useRef, useState } from "react";
import { usePathContext } from "@daltonr/pathwrite-react";
import type { ApplicationData } from "./application-path";

type CheckState = "idle" | "blocked";

export function EligibilityStep() {
  const { snapshot } = usePathContext<ApplicationData>();
  const snap = snapshot!;

  // Track isNavigating transitions so we can detect when the guard blocks.
  // When isNavigating goes true → false and we are still on this step,
  // the async canMoveNext guard returned false.
  const [checkState, setCheckState] = useState<CheckState>("idle");
  const wasNavigating = useRef(false);

  useEffect(() => {
    if (snap.isNavigating) {
      wasNavigating.current = true;
    } else if (wasNavigating.current) {
      wasNavigating.current = false;
      // If we're still on the eligibility step, the guard blocked.
      if (snap.stepId === "eligibility") {
        setCheckState("blocked");
      }
    }
  }, [snap.isNavigating, snap.stepId]);

  // Reset the blocked state if the user navigates back and changes their years.
  const prevYears = useRef(snap.data.yearsExperience);
  useEffect(() => {
    if (snap.data.yearsExperience !== prevYears.current) {
      prevYears.current = snap.data.yearsExperience;
      setCheckState("idle");
    }
  }, [snap.data.yearsExperience]);

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

      {checkState === "blocked" && (
        <div className="notice notice--error">
          <strong>Eligibility check failed.</strong> A minimum of 2 years of
          relevant experience is required. Go back and update your experience
          to continue.
        </div>
      )}

      {checkState === "idle" && (
        <p className="hint">
          <strong>What's happening:</strong> <code>canMoveNext</code> is async
          — it calls <code>services.checkEligibility()</code> and the engine
          awaits the result before deciding whether to advance. The shell
          applies <code>pw-shell__btn--loading</code> to the Next button while
          <code>isNavigating</code> is true, showing a CSS spinner.
        </p>
      )}
    </div>
  );
}
