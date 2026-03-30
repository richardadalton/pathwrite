import { usePathContext } from "@daltonr/pathwrite-react";
import type { EmployeeDetails } from "../employee-details";
import { DEPARTMENTS, OFFICES } from "../employee-details";
import { TabBar } from "./TabBar";

export function DepartmentTab() {
  const { snapshot, setData } = usePathContext<EmployeeDetails>();
  const data = snapshot.data;
  const showErrors = snapshot.hasAttemptedNext || snapshot.hasValidated;
  const errors = showErrors ? snapshot.fieldErrors : {};

  return (
    <div className="tab-content">
      <TabBar />
      <div className="form-body">
        <div className={`field ${errors.department ? "field--error" : ""}`}>
          <label htmlFor="department">Department <span className="required">*</span></label>
          <select
            id="department"
            value={data.department ?? ""}
            onChange={e => setData("department", e.target.value)}
          >
            <option value="">Select a department…</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          {errors.department && <span className="field-error">{errors.department}</span>}
        </div>

        <div className="field">
          <label htmlFor="manager">Reporting Manager <span className="optional">(optional)</span></label>
          <input
            id="manager" type="text"
            value={data.manager ?? ""}
            onChange={e => setData("manager", e.target.value)}
            placeholder="e.g. John Murphy"
          />
        </div>

        <div className="field">
          <label htmlFor="office">Office Location <span className="optional">(optional)</span></label>
          <select
            id="office"
            value={data.office ?? ""}
            onChange={e => setData("office", e.target.value)}
          >
            <option value="">Select an office…</option>
            {OFFICES.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        <div className="field">
          <label htmlFor="startDate">Start Date <span className="optional">(optional)</span></label>
          <input
            id="startDate" type="date"
            value={data.startDate ?? ""}
            onChange={e => setData("startDate", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
