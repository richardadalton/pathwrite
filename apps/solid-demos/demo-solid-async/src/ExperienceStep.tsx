import { createMemo, Show } from "solid-js";
import { usePathContext } from "@daltonr/pathwrite-solid";
import type { ApplicationData } from "@daltonr/pathwrite-demo-workflow-job-application";

export default function ExperienceStep() {
  const ctx = usePathContext<ApplicationData>();

  const errors = createMemo(() =>
    ctx.snapshot()?.hasAttemptedNext ? (ctx.snapshot()?.fieldErrors ?? {}) : {}
  );

  return (
    <Show when={ctx.snapshot()}>
      {(snap) => (
        <div class="form-body">
          <p class="step-intro">
            Tell us about your background. The next step will run an async eligibility
            check — try entering <strong>less than 2 years</strong> to see the guard
            block navigation.
          </p>

          <div class="field" classList={{ "field--error": !!errors().yearsExperience }}>
            <label for="years">Years of Relevant Experience</label>
            <input
              id="years"
              type="number"
              min="0"
              step="1"
              value={snap().data.yearsExperience}
              onInput={(e) => ctx.setData("yearsExperience", e.currentTarget.value)}
              placeholder="e.g. 3"
              autofocus
            />
            <Show when={errors().yearsExperience}>
              <span class="field-error">{errors().yearsExperience}</span>
            </Show>
          </div>

          <div class="field" classList={{ "field--error": !!errors().skills }}>
            <label for="skills">Key Skills</label>
            <input
              id="skills"
              type="text"
              value={snap().data.skills}
              onInput={(e) => ctx.setData("skills", e.currentTarget.value)}
              placeholder="e.g. TypeScript, React, Node.js"
            />
            <Show when={errors().skills}>
              <span class="field-error">{errors().skills}</span>
            </Show>
          </div>
        </div>
      )}
    </Show>
  );
}
