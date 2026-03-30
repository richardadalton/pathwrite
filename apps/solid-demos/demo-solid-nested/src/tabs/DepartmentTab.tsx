import { createMemo, For, Show } from "solid-js";
import { usePathContext } from "@daltonr/pathwrite-solid";
import type { EmployeeDetails } from "../employee-details";
import { DEPARTMENTS, OFFICES } from "../employee-details";
import TabBar from "./TabBar";

export default function DepartmentTab() {
  const ctx = usePathContext<EmployeeDetails>();

  const errors = createMemo(() => {
    const snap = ctx.snapshot();
    return (snap?.hasAttemptedNext || snap?.hasValidated) ? (snap?.fieldErrors ?? {}) : {};
  });

  return (
    <div class="tab-content">
      <TabBar />
      <div class="form-body">
        <div class="field" classList={{ "field--error": !!errors().department }}>
          <label for="department">Department <span class="required">*</span></label>
          <select
            id="department"
            value={ctx.snapshot()?.data.department ?? ""}
            onChange={(e) => ctx.setData("department", e.currentTarget.value)}
          >
            <option value="">Select a department…</option>
            <For each={DEPARTMENTS}>
              {(d) => <option value={d}>{d}</option>}
            </For>
          </select>
          <Show when={errors().department}>
            <span class="field-error">{errors().department}</span>
          </Show>
        </div>

        <div class="field">
          <label for="manager">Reporting Manager <span class="optional">(optional)</span></label>
          <input
            id="manager"
            type="text"
            value={ctx.snapshot()?.data.manager ?? ""}
            onInput={(e) => ctx.setData("manager", e.currentTarget.value)}
            placeholder="e.g. John Murphy"
          />
        </div>

        <div class="field">
          <label for="office">Office Location <span class="optional">(optional)</span></label>
          <select
            id="office"
            value={ctx.snapshot()?.data.office ?? ""}
            onChange={(e) => ctx.setData("office", e.currentTarget.value)}
          >
            <option value="">Select an office…</option>
            <For each={OFFICES}>
              {(o) => <option value={o}>{o}</option>}
            </For>
          </select>
        </div>

        <div class="field">
          <label for="startDate">Start Date <span class="optional">(optional)</span></label>
          <input
            id="startDate"
            type="date"
            value={ctx.snapshot()?.data.startDate ?? ""}
            onInput={(e) => ctx.setData("startDate", e.currentTarget.value)}
          />
        </div>
      </div>
    </div>
  );
}
