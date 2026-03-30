import { useState } from "react";
import { PathShell } from "@daltonr/pathwrite-react";
import { employeeOnboardingPath, ONBOARDING_INITIAL } from "./onboarding";
import type { OnboardingData } from "./onboarding";
import type { EmployeeDetails } from "./employee-details";
import { LAPTOP_TYPES } from "./employee-details";
import { EnterNameStep }       from "./EnterNameStep";
import { EmployeeDetailsStep } from "./EmployeeDetailsStep";
import { ConfirmStep }         from "./ConfirmStep";

function yesNo(val: string | undefined) {
  return val === "yes" ? "Yes" : "No";
}

export default function App() {
  const [isCompleted,   setIsCompleted]   = useState(false);
  const [isCancelled,   setIsCancelled]   = useState(false);
  const [completedData, setCompletedData] = useState<OnboardingData | null>(null);

  function handleComplete(data: OnboardingData) {
    setCompletedData(data);
    setIsCompleted(true);
  }

  function handleCancel() {
    setIsCancelled(true);
  }

  function startOver() {
    setIsCompleted(false);
    setIsCancelled(false);
    setCompletedData(null);
  }

  return (
    <main className="page">
      <div className="page-header">
        <h1>Employee Onboarding</h1>
        <p className="subtitle">
          Nested PathShell stress-test — an independent Employee Details path
          runs inside Step 2. Data syncs to the parent via <code>onEvent</code>;
          the parent's <code>canMoveNext</code> guard validates the inner data.
        </p>
      </div>

      {isCompleted && completedData && (() => {
        const d = (completedData.details ?? {}) as EmployeeDetails;
        const laptopLabel = LAPTOP_TYPES.find(l => l.value === d.laptopType)?.label ?? d.laptopType;
        const activePerms = [
          d.permAdmin   === "yes" && "Admin",
          d.permDev     === "yes" && "Developer",
          d.permHR      === "yes" && "HR",
          d.permFinance === "yes" && "Finance",
        ].filter(Boolean) as string[];

        return (
          <section className="result-panel success-panel">
            <div className="result-icon">🎉</div>
            <h2>Onboarding Complete!</h2>
            <p>
              <strong>{completedData.employeeName}</strong> has been successfully onboarded.
            </p>
            <div className="summary">
              <div className="summary-section">
                <p className="summary-section__title">Personal</p>
                <div className="summary-row"><span className="summary-key">Name</span><span>{d.firstName} {d.lastName}</span></div>
                {d.phone && <div className="summary-row"><span className="summary-key">Phone</span><span>{d.phone}</span></div>}
              </div>
              <div className="summary-section">
                <p className="summary-section__title">Department</p>
                <div className="summary-row"><span className="summary-key">Department</span><span>{d.department}</span></div>
                {d.manager && <div className="summary-row"><span className="summary-key">Manager</span><span>{d.manager}</span></div>}
                {d.office   && <div className="summary-row"><span className="summary-key">Office</span><span>{d.office}</span></div>}
              </div>
              <div className="summary-section">
                <p className="summary-section__title">Equipment &amp; Roles</p>
                <div className="summary-row"><span className="summary-key">Laptop</span><span>{laptopLabel}</span></div>
                <div className="summary-row"><span className="summary-key">Phone</span><span>{yesNo(d.needsPhone)}</span></div>
                <div className="summary-row"><span className="summary-key">Job Title</span><span>{d.jobTitle}</span></div>
                <div className="summary-row">
                  <span className="summary-key">Permissions</span>
                  <span>{activePerms.length > 0 ? activePerms.join(", ") : "None"}</span>
                </div>
              </div>
            </div>
            <button className="btn-primary" onClick={startOver}>Onboard Another</button>
          </section>
        );
      })()}

      {isCancelled && (
        <section className="result-panel cancel-panel">
          <div className="result-icon">✖</div>
          <h2>Onboarding Cancelled</h2>
          <p>No record was created.</p>
          <button className="btn-secondary" onClick={startOver}>Try Again</button>
        </section>
      )}

      {!isCompleted && !isCancelled && (
        <PathShell
          path={employeeOnboardingPath}
          initialData={ONBOARDING_INITIAL}
          completeLabel="Complete Onboarding"
          cancelLabel="Cancel"
          validationDisplay="inline"
          onComplete={data => handleComplete(data as OnboardingData)}
          onCancel={handleCancel}
          steps={{
            "enter-name":       <EnterNameStep />,
            "employee-details": <EmployeeDetailsStep />,
            "confirm":          <ConfirmStep />,
          }}
        />
      )}
    </main>
  );
}
