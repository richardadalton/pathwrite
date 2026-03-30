import { usePathContext } from "@daltonr/pathwrite-react";
import type { EmployeeDetails } from "../employee-details";
import { TabBar } from "./TabBar";

const PERMISSIONS = [
  { key: "permAdmin",   label: "Admin Access",   desc: "Full system administration" },
  { key: "permDev",     label: "Developer Access", desc: "Code repositories & CI/CD pipelines" },
  { key: "permHR",      label: "HR Access",       desc: "Personnel records & payroll" },
  { key: "permFinance", label: "Finance Access",  desc: "Accounting & expense systems" },
] as const;

export function RolesTab() {
  const { snapshot, setData } = usePathContext<EmployeeDetails>();
  const data = snapshot.data;
  const showErrors = snapshot.hasAttemptedNext || snapshot.hasValidated;
  const errors = showErrors ? snapshot.fieldErrors : {};

  return (
    <div className="tab-content">
      <TabBar />
      <div className="form-body">
        <div className={`field ${errors.jobTitle ? "field--error" : ""}`}>
          <label htmlFor="jobTitle">Job Title <span className="required">*</span></label>
          <input
            id="jobTitle" type="text"
            value={data.jobTitle ?? ""}
            onChange={e => setData("jobTitle", e.target.value)}
            placeholder="e.g. Senior Software Engineer"
          />
          {errors.jobTitle && <span className="field-error">{errors.jobTitle}</span>}
        </div>

        <div className="perm-section">
          <p className="pref-label">System Permissions</p>
          <div className="perm-list">
            {PERMISSIONS.map(({ key, label, desc }) => (
              <label key={key} className="perm-option">
                <div className="perm-text">
                  <span className="perm-label">{label}</span>
                  <span className="perm-desc">{desc}</span>
                </div>
                <div className="toggle">
                  <input
                    type="checkbox"
                    checked={(data[key] ?? "no") === "yes"}
                    onChange={e => setData(key, e.target.checked ? "yes" : "no")}
                  />
                  <span className="toggle-track" />
                  <span className="toggle-thumb" />
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
