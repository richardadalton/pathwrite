import { usePathContext } from "@daltonr/pathwrite-react";
import type { EmployeeDetails } from "../employee-details";
import { LAPTOP_TYPES } from "../employee-details";
import { TabBar } from "./TabBar";

export function EquipmentTab() {
  const { snapshot, setData } = usePathContext<EmployeeDetails>();
  const data = snapshot.data;

  return (
    <div className="tab-content">
      <TabBar />
      <div className="form-body">
        <div className="field">
          <label htmlFor="laptopType">Laptop <span className="optional">(optional)</span></label>
          <select
            id="laptopType"
            value={data.laptopType ?? "macbook-pro"}
            onChange={e => setData("laptopType", e.target.value)}
          >
            {LAPTOP_TYPES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>

        <div className="field">
          <label>Mobile Phone</label>
          <div className="radio-group">
            {["yes", "no"].map(val => (
              <label key={val} className="radio-option">
                <input
                  type="radio"
                  name="needsPhone"
                  value={val}
                  checked={(data.needsPhone ?? "no") === val}
                  onChange={() => setData("needsPhone", val)}
                />
                <span className="radio-option-label">{val === "yes" ? "Provide a company phone" : "No phone needed"}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Access Card</label>
          <div className="radio-group">
            {["yes", "no"].map(val => (
              <label key={val} className="radio-option">
                <input
                  type="radio"
                  name="needsAccessCard"
                  value={val}
                  checked={(data.needsAccessCard ?? "yes") === val}
                  onChange={() => setData("needsAccessCard", val)}
                />
                <span className="radio-option-label">{val === "yes" ? "Issue an access card" : "No access card"}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="otherEquipment">Other Equipment <span className="optional">(optional)</span></label>
          <input
            id="otherEquipment" type="text"
            value={data.otherEquipment ?? ""}
            onChange={e => setData("otherEquipment", e.target.value)}
            placeholder="e.g. standing desk, external monitor…"
          />
        </div>
      </div>
    </div>
  );
}
