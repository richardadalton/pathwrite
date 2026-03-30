import { createMemo, Show } from "solid-js";
import { usePathContext } from "@daltonr/pathwrite-solid";
import type { OnboardingData } from "./onboarding";

export default function PersonalInfoStep() {
  const ctx = usePathContext<OnboardingData>();

  const errors = createMemo(() =>
    ctx.snapshot()?.hasAttemptedNext ? (ctx.snapshot()?.fieldErrors ?? {}) : {}
  );

  return (
    <Show when={ctx.snapshot()}>
      <div class="form-body">
        <p class="step-intro">Let's start with the basics — we just need a name and email.</p>

        <div class="row">
          <div class="field" classList={{ "field--error": !!errors().firstName }}>
            <label for="firstName">First Name <span class="required">*</span></label>
            <input
              id="firstName"
              type="text"
              value={ctx.snapshot()?.data.firstName ?? ""}
              onInput={(e) => ctx.setData("firstName", e.currentTarget.value.trim())}
              placeholder="Jane"
              autocomplete="given-name"
              autofocus
            />
            <Show when={errors().firstName}>
              <span class="field-error">{errors().firstName}</span>
            </Show>
          </div>

          <div class="field" classList={{ "field--error": !!errors().lastName }}>
            <label for="lastName">Last Name <span class="required">*</span></label>
            <input
              id="lastName"
              type="text"
              value={ctx.snapshot()?.data.lastName ?? ""}
              onInput={(e) => ctx.setData("lastName", e.currentTarget.value.trim())}
              placeholder="Smith"
              autocomplete="family-name"
            />
            <Show when={errors().lastName}>
              <span class="field-error">{errors().lastName}</span>
            </Show>
          </div>
        </div>

        <div class="field" classList={{ "field--error": !!errors().email }}>
          <label for="email">Email Address <span class="required">*</span></label>
          <input
            id="email"
            type="email"
            value={ctx.snapshot()?.data.email ?? ""}
            onInput={(e) => ctx.setData("email", e.currentTarget.value.trim())}
            placeholder="jane@example.com"
            autocomplete="email"
          />
          <Show when={errors().email}>
            <span class="field-error">{errors().email}</span>
          </Show>
        </div>
      </div>
    </Show>
  );
}
