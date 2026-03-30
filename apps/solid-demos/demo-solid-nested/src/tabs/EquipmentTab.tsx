import { For } from "solid-js";
import { usePathContext } from "@daltonr/pathwrite-solid";
import type { EmployeeDetails } from "../employee-details";
import { LAPTOP_TYPES } from "../employee-details";
import TabBar from "./TabBar";

export default function EquipmentTab() {
  const ctx = usePathContext<EmployeeDetails>();

  return (
    <div class="tab-content">
      <TabBar />
      <div class="form-body">
        <div class="field">
          <label for="laptopType">Laptop <span class="optional">(optional)</span></label>
          <select
            id="laptopType"
            value={ctx.snapshot()?.data.laptopType ?? "macbook-pro"}
            onChange={(e) => ctx.setData("laptopType", e.currentTarget.value)}
          >
            <For each={LAPTOP_TYPES}>
              {(l) => <option value={l.value}>{l.label}</option>}
            </For>
          </select>
        </div>

        <div class="field">
          <label>Mobile Phone</label>
          <div class="radio-group">
            <For each={["yes", "no"]}>
              {(val) => (
                <label class="radio-option">
                  <input
                    type="radio"
                    name="needsPhone"
                    value={val}
                    checked={(ctx.snapshot()?.data.needsPhone ?? "no") === val}
                    onChange={() => ctx.setData("needsPhone", val)}
                  />
                  <span class="radio-option-label">
                    {val === "yes" ? "Provide a company phone" : "No phone needed"}
                  </span>
                </label>
              )}
            </For>
          </div>
        </div>

        <div class="field">
          <label>Access Card</label>
          <div class="radio-group">
            <For each={["yes", "no"]}>
              {(val) => (
                <label class="radio-option">
                  <input
                    type="radio"
                    name="needsAccessCard"
                    value={val}
                    checked={(ctx.snapshot()?.data.needsAccessCard ?? "yes") === val}
                    onChange={() => ctx.setData("needsAccessCard", val)}
                  />
                  <span class="radio-option-label">
                    {val === "yes" ? "Issue an access card" : "No access card"}
                  </span>
                </label>
              )}
            </For>
          </div>
        </div>

        <div class="field">
          <label for="otherEquipment">Other Equipment <span class="optional">(optional)</span></label>
          <input
            id="otherEquipment"
            type="text"
            value={ctx.snapshot()?.data.otherEquipment ?? ""}
            onInput={(e) => ctx.setData("otherEquipment", e.currentTarget.value)}
            placeholder="e.g. standing desk, external monitor…"
          />
        </div>
      </div>
    </div>
  );
}
