import { createMemo, Show } from "solid-js";
import { usePathContext } from "@daltonr/pathwrite-solid";
import type { ProfileSubData } from "./wizard";

export default function GoalsStep() {
  const ctx = usePathContext<ProfileSubData>();

  const errors = createMemo(() =>
    ctx.snapshot()?.hasAttemptedNext ? (ctx.snapshot()?.fieldErrors ?? {}) : {}
  );

  const d = createMemo(() => ctx.snapshot()?.data);

  return (
    <Show when={ctx.snapshot()}>
      <div class="form-body">
        {/* Who we're filling in for */}
        <div class="subwizard-context">
          <p class="subwizard-for">Setting goals for</p>
          <p class="subwizard-name">{d()?.memberName as string}</p>
        </div>

        {/* 30-day goals */}
        <div class="field" classList={{ "field--error": !!errors().goals30 }}>
          <label for="goals30">
            30-Day Goals <span class="required">*</span>
            <span class="field-hint">First month priorities</span>
          </label>
          <textarea
            id="goals30"
            rows={6}
            placeholder="What should this person achieve in their first 30 days? Think about: getting set up with tools and access, meeting key stakeholders, completing any required training, and making one or two small early contributions."
            value={(d()?.goals30 as string) ?? ""}
            onInput={(e) => ctx.setData("goals30", e.currentTarget.value)}
          />
          <Show when={errors().goals30}>
            <p class="field-error">{errors().goals30}</p>
          </Show>
        </div>

        {/* 90-day goals */}
        <div class="field" classList={{ "field--error": !!errors().goals90 }}>
          <label for="goals90">
            90-Day Goals <span class="required">*</span>
            <span class="field-hint">Full quarter ownership</span>
          </label>
          <textarea
            id="goals90"
            rows={6}
            placeholder="What does success look like after 90 days? Describe the areas they should own independently, projects they should be driving, team relationships they should have built, and metrics you'll use to evaluate their progress."
            value={(d()?.goals90 as string) ?? ""}
            onInput={(e) => ctx.setData("goals90", e.currentTarget.value)}
          />
          <Show when={errors().goals90}>
            <p class="field-error">{errors().goals90}</p>
          </Show>
        </div>
      </div>
    </Show>
  );
}
