import { useState } from "react";
import { PathShell } from "@daltonr/pathwrite-react";
import { services, createApplicationPath, INITIAL_DATA, type ApplicationData } from "@daltonr/pathwrite-demo-workflow-job-application";
import { RoleStep }         from "./RoleStep";
import { ExperienceStep }   from "./ExperienceStep";
import { EligibilityStep }  from "./EligibilityStep";
import { CoverLetterStep }  from "./CoverLetterStep";
import { ReviewStep }       from "./ReviewStep";

// Path is created once — the factory closes over the services singleton.
const applicationPath = createApplicationPath(services);

export default function App() {
  const [completedData, setCompletedData] = useState<ApplicationData | null>(null);

  if (completedData) {
    return (
      <main className="page">
        <div className="page-header">
          <h1>Application Submitted</h1>
          <p className="subtitle">
            Your application for role <strong>{completedData.roleId}</strong> was received.
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
          Demonstrates async <code>canMoveNext</code> guards, async <code>shouldSkip</code>{" "}
          with accurate progress, <code>loadingLabel</code>, and service injection via{" "}
          <code>usePathContext&lt;TData, TServices&gt;</code>.
        </p>
      </div>

      <PathShell
        path={applicationPath}
        services={services}
        initialData={INITIAL_DATA}
        completeLabel="Submit Application"
        loadingLabel="Please wait…"
        hideCancel
        validationDisplay="inline"
        onComplete={(data) => setCompletedData(data as ApplicationData)}
        steps={{
          "role":         <RoleStep />,
          "experience":   <ExperienceStep />,
          "eligibility":  <EligibilityStep />,
          "coverLetter":  <CoverLetterStep />,
          "review":       <ReviewStep />,
        }}
      />
    </main>
  );
}
