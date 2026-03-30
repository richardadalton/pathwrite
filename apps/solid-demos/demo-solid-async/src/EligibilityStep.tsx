import { createMemo, Show } from "solid-js";
import { usePathContext } from "@daltonr/pathwrite-solid";
import type { ApplicationData } from "@daltonr/pathwrite-demo-workflow-job-application";

export default function EligibilityStep() {
  const ctx = usePathContext<ApplicationData>();

  const snap = () => ctx.snapshot()!;

  // blockingError is set when canMoveNext returns { allowed: false, reason }.
  // Render it here because the shell uses validationDisplay="inline".
  const blockingError = createMemo(() =>
    snap().hasAttemptedNext ? snap().blockingError : null
  );

  const guardRunning = createMemo(() => snap().status === "validating");

  return (
    <Show when={ctx.snapshot()}>
      <div class="form-body">
        <p class="step-intro">
          Clicking <strong>Next</strong> runs an async eligibility check against
          our API. The check takes ~900ms — watch the spinner on the button.
        </p>

        <div class="eligibility-summary">
          <div class="summary-row">
            <span class="summary-key">Role</span>
            <span>{snap().data.roleId || "—"}</span>
          </div>
          <div class="summary-row">
            <span class="summary-key">Experience</span>
            <span>{snap().data.yearsExperience ? `${snap().data.yearsExperience} years` : "—"}</span>
          </div>
          <div class="summary-row">
            <span class="summary-key">Skills</span>
            <span>{(snap().data.skills as string) || "—"}</span>
          </div>
        </div>

        <Show when={blockingError()}>
          <p class="field-error" style="margin-top: 12px">{blockingError()}</p>
        </Show>

        <Show when={!guardRunning()}>
          <p class="hint">
            <strong>What's happening:</strong> <code>canMoveNext</code> is async
            — it calls <code>services.checkEligibility()</code> and the engine
            awaits the result before deciding whether to advance. While it runs,{" "}
            <code>snapshot.status === "validating"</code>, and the shell shows a
            CSS spinner on the Next button. If blocked, the guard returns{" "}
            <code>{"{ allowed: false, reason }"}</code> and <code>snapshot.blockingError</code>{" "}
            is set.
          </p>
        </Show>
      </div>
    </Show>
  );
}
