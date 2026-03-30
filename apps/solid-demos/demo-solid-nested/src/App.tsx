import { createSignal, Show } from "solid-js";
import { PathShell } from "@daltonr/pathwrite-solid";
import type { PathData } from "@daltonr/pathwrite-solid";
import { employeeOnboardingPath, ONBOARDING_INITIAL } from "./onboarding";
import type { OnboardingData } from "./onboarding";
import type { EmployeeDetails } from "./employee-details";
import { LAPTOP_TYPES } from "./employee-details";
import EnterNameStep from "./EnterNameStep";
import EmployeeDetailsStep from "./EmployeeDetailsStep";
import ConfirmStep from "./ConfirmStep";

function yesNo(val: string | undefined) {
  return val === "yes" ? "Yes" : "No";
}

export default function App() {
  const [isCompleted, setIsCompleted]     = createSignal(false);
  const [isCancelled, setIsCancelled]     = createSignal(false);
  const [completedData, setCompletedData] = createSignal<OnboardingData | null>(null);

  function handleComplete(data: PathData) {
    setCompletedData(data as OnboardingData);
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
    <main class="page">
      <div class="page-header">
        <h1>Employee Onboarding</h1>
        <p class="subtitle">
          Nested PathShell — an independent Employee Details path runs inside Step 2.
          Data syncs to the parent via <code>onEvent</code>; the parent's{" "}
          <code>fieldErrors</code> guard validates the inner data before proceeding.
        </p>
      </div>

      {/* Completed */}
      <Show when={isCompleted() && completedData()}>
        {(data) => {
          const d = (data().details ?? {}) as EmployeeDetails;
          const laptopLabel = LAPTOP_TYPES.find(l => l.value === d.laptopType)?.label ?? d.laptopType;
          const activePerms = [
            d.permAdmin   === "yes" && "Admin",
            d.permDev     === "yes" && "Developer",
            d.permHR      === "yes" && "HR",
            d.permFinance === "yes" && "Finance",
          ].filter(Boolean) as string[];

          return (
            <section class="result-panel success-panel">
              <div class="result-icon">🎉</div>
              <h2>Onboarding Complete!</h2>
              <p>
                <strong>{data().employeeName}</strong> has been successfully onboarded.
              </p>

              <div class="review-section">
                <p class="section-title">Personal</p>
                <div class="review-card">
                  <div class="review-row"><span class="review-key">Name</span><span>{d.firstName} {d.lastName}</span></div>
                  <Show when={d.phone}><div class="review-row"><span class="review-key">Phone</span><span>{d.phone}</span></div></Show>
                </div>
              </div>

              <div class="review-section">
                <p class="section-title">Department</p>
                <div class="review-card">
                  <div class="review-row"><span class="review-key">Department</span><span>{d.department}</span></div>
                  <Show when={d.manager}><div class="review-row"><span class="review-key">Manager</span><span>{d.manager}</span></div></Show>
                  <Show when={d.office}><div class="review-row"><span class="review-key">Office</span><span>{d.office}</span></div></Show>
                </div>
              </div>

              <div class="review-section">
                <p class="section-title">Equipment &amp; Roles</p>
                <div class="review-card">
                  <div class="review-row"><span class="review-key">Laptop</span><span>{laptopLabel}</span></div>
                  <div class="review-row"><span class="review-key">Phone</span><span>{yesNo(d.needsPhone)}</span></div>
                  <div class="review-row"><span class="review-key">Job Title</span><span>{d.jobTitle}</span></div>
                  <div class="review-row">
                    <span class="review-key">Permissions</span>
                    <span>{activePerms.length > 0 ? activePerms.join(", ") : "None"}</span>
                  </div>
                </div>
              </div>

              <button class="btn-primary" onClick={startOver}>Onboard Another</button>
            </section>
          );
        }}
      </Show>

      {/* Cancelled */}
      <Show when={isCancelled()}>
        <section class="result-panel cancel-panel">
          <div class="result-icon">✖</div>
          <h2>Onboarding Cancelled</h2>
          <p>No record was created.</p>
          <button class="btn-secondary" onClick={startOver}>Try Again</button>
        </section>
      </Show>

      {/* Active wizard */}
      <Show when={!isCompleted() && !isCancelled()}>
        <PathShell
          path={employeeOnboardingPath}
          initialData={ONBOARDING_INITIAL}
          completeLabel="Complete Onboarding"
          cancelLabel="Cancel"
          validationDisplay="inline"
          onComplete={handleComplete}
          onCancel={handleCancel}
          steps={{
            "enter-name":       () => <EnterNameStep />,
            "employee-details": () => <EmployeeDetailsStep />,
            "confirm":          () => <ConfirmStep />,
          }}
        />
      </Show>
    </main>
  );
}
