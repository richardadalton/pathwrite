import { createMemo, Show } from "solid-js";
import { usePathContext } from "@daltonr/pathwrite-solid";
import type { OnboardingData } from "./onboarding";

export default function EnterNameStep() {
  const ctx = usePathContext<OnboardingData>();

  const errors = createMemo(() =>
    ctx.snapshot()?.hasAttemptedNext ? (ctx.snapshot()?.fieldErrors ?? {}) : {}
  );

  return (
    <Show when={ctx.snapshot()}>
      <div class="form-body">
        <p class="step-intro">
          Enter the new employee's full name to begin their onboarding record.
        </p>

        <div class="field" classList={{ "field--error": !!errors().employeeName }}>
          <label for="employeeName">
            Full Name <span class="required">*</span>
          </label>
          <input
            id="employeeName"
            type="text"
            value={ctx.snapshot()?.data.employeeName ?? ""}
            autofocus
            onInput={(e) => ctx.setData("employeeName", e.currentTarget.value)}
            placeholder="e.g. Jane Smith"
            autocomplete="name"
          />
          <Show when={errors().employeeName}>
            <span class="field-error">{errors().employeeName}</span>
          </Show>
        </div>
      </div>
    </Show>
  );
}
