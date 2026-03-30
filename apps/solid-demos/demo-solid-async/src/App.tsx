import { createSignal, Show } from "solid-js";
import { PathShell } from "@daltonr/pathwrite-solid";
import type { PathData } from "@daltonr/pathwrite-solid";
import {
  services,
  createApplicationPath,
  INITIAL_DATA,
  type ApplicationData,
} from "@daltonr/pathwrite-demo-workflow-job-application";
import RoleStep from "./RoleStep";
import ExperienceStep from "./ExperienceStep";
import EligibilityStep from "./EligibilityStep";
import CoverLetterStep from "./CoverLetterStep";
import ReviewStep from "./ReviewStep";

// Path is created once — the factory closes over the services singleton.
const applicationPath = createApplicationPath(services);

export default function App() {
  const [completedData, setCompletedData] = createSignal<ApplicationData | null>(null);

  function handleComplete(data: PathData) {
    setCompletedData(data as ApplicationData);
  }

  return (
    <main class="page">
      <div class="page-header">
        <h1>Job Application</h1>
        <p class="subtitle">
          Demonstrates async <code>canMoveNext</code> guards, async <code>shouldSkip</code>{" "}
          with accurate progress, <code>loadingLabel</code>, and service injection via{" "}
          <code>usePathContext&lt;TData, TServices&gt;</code>.
        </p>
      </div>

      <Show when={completedData()}>
        {(data) => (
          <section class="result-panel success-panel">
            <div class="result-icon">✓</div>
            <h2>Application Submitted!</h2>
            <p>
              Your application for role <strong>{data().roleId}</strong> was received.
              We'll be in touch soon.
            </p>
            <button class="btn-primary" onClick={() => setCompletedData(null)}>
              Submit Another
            </button>
          </section>
        )}
      </Show>

      <Show when={!completedData()}>
        <PathShell
          path={applicationPath}
          services={services}
          initialData={INITIAL_DATA}
          completeLabel="Submit Application"
          loadingLabel="Please wait…"
          hideCancel={true}
          validationDisplay="inline"
          onComplete={handleComplete}
          steps={{
            "role":         () => <RoleStep />,
            "experience":   () => <ExperienceStep />,
            "eligibility":  () => <EligibilityStep />,
            "cover-letter": () => <CoverLetterStep />,
            "review":       () => <ReviewStep />,
          }}
        />
      </Show>
    </main>
  );
}
