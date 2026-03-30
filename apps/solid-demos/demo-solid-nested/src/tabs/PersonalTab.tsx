import { createMemo, Show } from "solid-js";
import { usePathContext } from "@daltonr/pathwrite-solid";
import type { EmployeeDetails } from "../employee-details";
import TabBar from "./TabBar";

export default function PersonalTab() {
  const ctx = usePathContext<EmployeeDetails>();

  const errors = createMemo(() => {
    const snap = ctx.snapshot();
    return (snap?.hasAttemptedNext || snap?.hasValidated) ? (snap?.fieldErrors ?? {}) : {};
  });

  return (
    <div class="tab-content">
      <TabBar />
      <div class="form-body">
        <div class="row">
          <div class="field" classList={{ "field--error": !!errors().firstName }}>
            <label for="firstName">First Name <span class="required">*</span></label>
            <input
              id="firstName"
              type="text"
              value={ctx.snapshot()?.data.firstName ?? ""}
              onInput={(e) => ctx.setData("firstName", e.currentTarget.value)}
              placeholder="Jane"
              autocomplete="given-name"
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
              onInput={(e) => ctx.setData("lastName", e.currentTarget.value)}
              placeholder="Smith"
              autocomplete="family-name"
            />
            <Show when={errors().lastName}>
              <span class="field-error">{errors().lastName}</span>
            </Show>
          </div>
        </div>

        <div class="field">
          <label for="dateOfBirth">Date of Birth <span class="optional">(optional)</span></label>
          <input
            id="dateOfBirth"
            type="date"
            value={ctx.snapshot()?.data.dateOfBirth ?? ""}
            onInput={(e) => ctx.setData("dateOfBirth", e.currentTarget.value)}
          />
        </div>

        <div class="field">
          <label for="phone">Phone Number <span class="optional">(optional)</span></label>
          <input
            id="phone"
            type="tel"
            value={ctx.snapshot()?.data.phone ?? ""}
            onInput={(e) => ctx.setData("phone", e.currentTarget.value)}
            placeholder="+353 86 123 4567"
            autocomplete="tel"
          />
        </div>

        <div class="field">
          <label for="personalEmail">Personal Email <span class="optional">(optional)</span></label>
          <input
            id="personalEmail"
            type="email"
            value={ctx.snapshot()?.data.personalEmail ?? ""}
            onInput={(e) => ctx.setData("personalEmail", e.currentTarget.value)}
            placeholder="jane@personal.com"
            autocomplete="email"
          />
        </div>
      </div>
    </div>
  );
}
