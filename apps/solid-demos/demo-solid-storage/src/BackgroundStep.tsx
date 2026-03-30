import { createMemo, Show } from "solid-js";
import { usePathContext } from "@daltonr/pathwrite-solid";
import type { ProfileSubData } from "./wizard";

export default function BackgroundStep() {
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
          <p class="subwizard-for">Completing profile for</p>
          <p class="subwizard-name">
            {d()?.memberName as string}
            <Show when={d()?.memberRole}>
              <span class="subwizard-role"> — {d()?.memberRole as string}</span>
            </Show>
          </p>
        </div>

        {/* Department */}
        <div class="field" classList={{ "field--error": !!errors().department }}>
          <label for="department">Department <span class="required">*</span></label>
          <input
            id="department"
            type="text"
            placeholder="e.g. Engineering, Design, Product, Marketing…"
            value={(d()?.department as string) ?? ""}
            onInput={(e) => ctx.setData("department", e.currentTarget.value)}
          />
          <Show when={errors().department}>
            <p class="field-error">{errors().department}</p>
          </Show>
        </div>

        {/* Start date */}
        <div class="field" classList={{ "field--error": !!errors().startDate }}>
          <label for="start-date">Start Date <span class="required">*</span></label>
          <input
            id="start-date"
            type="date"
            value={(d()?.startDate as string) ?? ""}
            onChange={(e) => ctx.setData("startDate", e.currentTarget.value)}
          />
          <Show when={errors().startDate}>
            <p class="field-error">{errors().startDate}</p>
          </Show>
        </div>

        {/* Bio */}
        <div class="field" classList={{ "field--error": !!errors().bio }}>
          <label for="bio">
            Short Bio <span class="required">*</span>
            <span class="field-hint">Introduce this person to the team</span>
          </label>
          <textarea
            id="bio"
            rows={6}
            placeholder="Describe their background, previous experience, what drew them to this role, and what they'll bring to the team."
            value={(d()?.bio as string) ?? ""}
            onInput={(e) => ctx.setData("bio", e.currentTarget.value)}
          />
          <Show when={errors().bio}>
            <p class="field-error">{errors().bio}</p>
          </Show>
        </div>
      </div>
    </Show>
  );
}
