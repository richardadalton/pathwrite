import { Show } from "solid-js";
import { usePathContext } from "@daltonr/pathwrite-solid";
import type { ApplicationData } from "@daltonr/pathwrite-demo-workflow-job-application";

export default function ReviewStep() {
  const ctx = usePathContext<ApplicationData>();

  const data = () => ctx.snapshot()!.data;

  return (
    <Show when={ctx.snapshot()}>
      <div class="form-body">
        <p class="step-intro">
          All async checks passed. Review your application before submitting.
        </p>

        <div class="eligibility-summary">
          <div class="summary-row">
            <span class="summary-key">Role</span>
            <span>{data().roleId as string}</span>
          </div>
          <div class="summary-row">
            <span class="summary-key">Experience</span>
            <span>{data().yearsExperience} years</span>
          </div>
          <div class="summary-row">
            <span class="summary-key">Skills</span>
            <span>{data().skills as string}</span>
          </div>
          <Show when={data().coverLetter}>
            <div class="summary-row">
              <span class="summary-key">Cover Letter</span>
              <span>{data().coverLetter as string}</span>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
}
