import { createMemo, For, Show } from "solid-js";
import { usePathContext } from "@daltonr/pathwrite-solid";
import type { EmployeeDetails } from "../employee-details";
import TabBar from "./TabBar";

const PERMISSIONS = [
  { key: "permAdmin",   label: "Admin Access",     desc: "Full system administration" },
  { key: "permDev",     label: "Developer Access",  desc: "Code repositories & CI/CD pipelines" },
  { key: "permHR",      label: "HR Access",         desc: "Personnel records & payroll" },
  { key: "permFinance", label: "Finance Access",    desc: "Accounting & expense systems" },
] as const;

export default function RolesTab() {
  const ctx = usePathContext<EmployeeDetails>();

  const errors = createMemo(() => {
    const snap = ctx.snapshot();
    return (snap?.hasAttemptedNext || snap?.hasValidated) ? (snap?.fieldErrors ?? {}) : {};
  });

  return (
    <div class="tab-content">
      <TabBar />
      <div class="form-body">
        <div class="field" classList={{ "field--error": !!errors().jobTitle }}>
          <label for="jobTitle">Job Title <span class="required">*</span></label>
          <input
            id="jobTitle"
            type="text"
            value={ctx.snapshot()?.data.jobTitle ?? ""}
            onInput={(e) => ctx.setData("jobTitle", e.currentTarget.value)}
            placeholder="e.g. Senior Software Engineer"
          />
          <Show when={errors().jobTitle}>
            <span class="field-error">{errors().jobTitle}</span>
          </Show>
        </div>

        <div class="perm-section">
          <p class="pref-label">System Permissions</p>
          <div class="perm-list">
            <For each={PERMISSIONS}>
              {({ key, label, desc }) => (
                <label class="perm-option">
                  <div class="perm-text">
                    <span class="perm-label">{label}</span>
                    <span class="perm-desc">{desc}</span>
                  </div>
                  <div class="toggle">
                    <input
                      type="checkbox"
                      checked={(ctx.snapshot()?.data[key] ?? "no") === "yes"}
                      onChange={(e) => ctx.setData(key, e.currentTarget.checked ? "yes" : "no")}
                    />
                    <span class="toggle-track" />
                    <span class="toggle-thumb" />
                  </div>
                </label>
              )}
            </For>
          </div>
        </div>
      </div>
    </div>
  );
}
