import { createMemo, Show, For } from "solid-js";
import { usePathContext } from "@daltonr/pathwrite-solid";
import type { OnboardingData } from "./onboarding";

const EXPERIENCE_OPTIONS = [
  { value: "junior", label: "Junior (0–2 years)" },
  { value: "mid",    label: "Mid-level (3–5 years)" },
  { value: "senior", label: "Senior (6–10 years)" },
  { value: "lead",   label: "Lead / Principal (10+ years)" },
];

export default function AboutYouStep() {
  const ctx = usePathContext<OnboardingData>();

  const errors = createMemo(() =>
    ctx.snapshot()?.hasAttemptedNext ? (ctx.snapshot()?.fieldErrors ?? {}) : {}
  );

  return (
    <Show when={ctx.snapshot()}>
      <div class="form-body">
        <p class="step-intro">Tell us a bit about your professional background.</p>

        <div class="field" classList={{ "field--error": !!errors().jobTitle }}>
          <label for="jobTitle">Job Title <span class="required">*</span></label>
          <input
            id="jobTitle"
            type="text"
            value={ctx.snapshot()?.data.jobTitle ?? ""}
            onInput={(e) => ctx.setData("jobTitle", e.currentTarget.value.trim())}
            placeholder="e.g. Frontend Developer"
            autocomplete="organization-title"
            autofocus
          />
          <Show when={errors().jobTitle}>
            <span class="field-error">{errors().jobTitle}</span>
          </Show>
        </div>

        <div class="field">
          <label for="company">Company <span class="optional">(optional)</span></label>
          <input
            id="company"
            type="text"
            value={ctx.snapshot()?.data.company ?? ""}
            onInput={(e) => ctx.setData("company", e.currentTarget.value.trim())}
            placeholder="e.g. Acme Corp"
            autocomplete="organization"
          />
        </div>

        <div class="field" classList={{ "field--error": !!errors().experience }}>
          <label for="experience">Experience Level <span class="required">*</span></label>
          <select
            id="experience"
            value={ctx.snapshot()?.data.experience ?? ""}
            onChange={(e) => ctx.setData("experience", e.currentTarget.value)}
          >
            <option value="" disabled>Select your level…</option>
            <For each={EXPERIENCE_OPTIONS}>
              {(o) => <option value={o.value}>{o.label}</option>}
            </For>
          </select>
          <Show when={errors().experience}>
            <span class="field-error">{errors().experience}</span>
          </Show>
        </div>
      </div>
    </Show>
  );
}
