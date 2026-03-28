import { useState } from "react";
import { PathShell } from "@daltonr/pathwrite-react";
import { services } from "./services";
import { createApplicationPath, INITIAL_DATA, type ApplicationData } from "./application-path";
import { RoleStep }        from "./RoleStep";
import { ExperienceStep }  from "./ExperienceStep";
import { EligibilityStep } from "./EligibilityStep";
import { ReviewStep }      from "./ReviewStep";

// Path is created once — the factory closes over the services singleton.
const applicationPath = createApplicationPath(services);

export default function App() {
  const [completedData, setCompletedData] = useState<ApplicationData | null>(null);

  if (completedData) {
    const role = completedData.availableRoles.find(r => r.id === completedData.roleId);
    return (
      <main className="page">
        <div className="page-header">
          <h1>Application Submitted</h1>
          <p className="subtitle">
            Your application for <strong>{role?.label ?? completedData.roleId}</strong> was received.
          </p>
        </div>
        <section className="result-panel success-panel">
          <div className="result-icon">✓</div>
          <h2>All done!</h2>
          <p>We'll be in touch soon.</p>
          <button className="btn-primary" onClick={() => setCompletedData(null)}>
            Submit Another
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="page-header">
        <h1>Job Application</h1>
        <p className="subtitle">
          Demonstrates async <code>onEnter</code> (data loading) and async{" "}
          <code>canMoveNext</code> (guard enforcement) with a real spinner.
        </p>
      </div>

      <PathShell
        path={applicationPath}
        initialData={INITIAL_DATA}
        completeLabel="Submit Application"
        hideCancel
        validationDisplay="inline"
        onComplete={(data) => setCompletedData(data as ApplicationData)}
        steps={{
          "role":        <RoleStep />,
          "experience":  <ExperienceStep />,
          "eligibility": <EligibilityStep />,
          "review":      <ReviewStep />,
        }}
      />
    </main>
  );
}
