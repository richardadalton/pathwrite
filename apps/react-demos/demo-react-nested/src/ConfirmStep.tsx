import { usePathContext } from "@daltonr/pathwrite-react";
import type { OnboardingData } from "./onboarding";
import type { EmployeeDetails } from "./employee-details";
import { LAPTOP_TYPES } from "./employee-details";

function laptopLabel(val: string) {
  return LAPTOP_TYPES.find(l => l.value === val)?.label ?? val;
}

function yesNo(val: string | undefined) {
  return val === "yes" ? "Yes" : "No";
}

export function ConfirmStep() {
  const { snapshot } = usePathContext<OnboardingData>();
  const data = snapshot!.data;
  const d = (data.details ?? {}) as EmployeeDetails;

  const activePerms = [
    d.permAdmin   === "yes" && "Admin",
    d.permDev     === "yes" && "Developer",
    d.permHR      === "yes" && "HR",
    d.permFinance === "yes" && "Finance",
  ].filter(Boolean) as string[];

  return (
    <div className="form-body">
      <p className="step-intro">
        Review the details below. Click <strong>Complete Onboarding</strong> to submit,
        or use <strong>Previous</strong> to go back and make changes.
      </p>

      <div className="review-section">
        <p className="section-title">Employee</p>
        <div className="review-card">
          <div className="review-row">
            <span className="review-key">Name</span>
            <span>{data.employeeName}</span>
          </div>
        </div>
      </div>

      <div className="review-section">
        <p className="section-title">Personal</p>
        <div className="review-card">
          <div className="review-row">
            <span className="review-key">Full Name</span>
            <span>{[d.firstName, d.lastName].filter(Boolean).join(" ") || "—"}</span>
          </div>
          {d.dateOfBirth && (
            <div className="review-row">
              <span className="review-key">Date of Birth</span>
              <span>{d.dateOfBirth}</span>
            </div>
          )}
          {d.phone && (
            <div className="review-row">
              <span className="review-key">Phone</span>
              <span>{d.phone}</span>
            </div>
          )}
          {d.personalEmail && (
            <div className="review-row">
              <span className="review-key">Personal Email</span>
              <span>{d.personalEmail}</span>
            </div>
          )}
        </div>
      </div>

      <div className="review-section">
        <p className="section-title">Department</p>
        <div className="review-card">
          <div className="review-row">
            <span className="review-key">Department</span>
            <span>{d.department || "—"}</span>
          </div>
          {d.manager && (
            <div className="review-row">
              <span className="review-key">Manager</span>
              <span>{d.manager}</span>
            </div>
          )}
          {d.office && (
            <div className="review-row">
              <span className="review-key">Office</span>
              <span>{d.office}</span>
            </div>
          )}
          {d.startDate && (
            <div className="review-row">
              <span className="review-key">Start Date</span>
              <span>{d.startDate}</span>
            </div>
          )}
        </div>
      </div>

      <div className="review-section">
        <p className="section-title">Equipment</p>
        <div className="review-card">
          <div className="review-row">
            <span className="review-key">Laptop</span>
            <span>{laptopLabel(d.laptopType ?? "macbook-pro")}</span>
          </div>
          <div className="review-row">
            <span className="review-key">Mobile Phone</span>
            <span>{yesNo(d.needsPhone)}</span>
          </div>
          <div className="review-row">
            <span className="review-key">Access Card</span>
            <span>{yesNo(d.needsAccessCard)}</span>
          </div>
          {d.otherEquipment && (
            <div className="review-row">
              <span className="review-key">Other</span>
              <span>{d.otherEquipment}</span>
            </div>
          )}
        </div>
      </div>

      <div className="review-section">
        <p className="section-title">Roles &amp; Permissions</p>
        <div className="review-card">
          <div className="review-row">
            <span className="review-key">Job Title</span>
            <span>{d.jobTitle || "—"}</span>
          </div>
          <div className="review-row">
            <span className="review-key">Permissions</span>
            <span>
              {activePerms.length > 0
                ? activePerms.map(p => (
                    <span key={p} className="badge badge--on" style={{ marginRight: 4 }}>{p}</span>
                  ))
                : <span className="badge badge--off">None</span>
              }
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
