<script lang="ts">
  import { PathShell } from "@daltonr/pathwrite-svelte";
  
  import { services, createApplicationPath, INITIAL_DATA, type ApplicationData } from "@daltonr/pathwrite-demo-workflow-job-application";
  import RoleStep        from "./RoleStep.svelte";
  import ExperienceStep  from "./ExperienceStep.svelte";
  import EligibilityStep from "./EligibilityStep.svelte";
  import CoverLetterStep from "./CoverLetterStep.svelte";
  import ReviewStep      from "./ReviewStep.svelte";

  // Path is created once — factory closes over the services singleton.
  const applicationPath = createApplicationPath(services);

  let completedData = $state<ApplicationData | null>(null);

  function startOver() {
    completedData = null;
  }
</script>

<main class="page">
  <div class="page-header">
    <h1>Job Application</h1>
    <p class="subtitle">
      Demonstrates async <code>canMoveNext</code> guards, async <code>shouldSkip</code>
      with accurate progress, <code>loadingLabel</code>, and service injection via
      <code>usePathContext&lt;TData, TServices&gt;()</code>.
    </p>
  </div>

  {#if completedData}
    <section class="result-panel success-panel">
      <div class="result-icon">✓</div>
      <h2>Application Submitted</h2>
      <p>Your application for role <strong>{completedData.roleId}</strong> was received.</p>
      <button class="btn-primary" onclick={startOver}>Submit Another</button>
    </section>
  {:else}
    <PathShell
      path={applicationPath}
      {services}
      initialData={INITIAL_DATA}
      completeLabel="Submit Application"
      loadingLabel="Please wait…"
      hideCancel={true}
      validationDisplay="inline"
      oncomplete={(data) => { completedData = data as ApplicationData; }}
      role={RoleStep}
      experience={ExperienceStep}
      eligibility={EligibilityStep}
      coverLetter={CoverLetterStep}
      review={ReviewStep}
    />
  {/if}
</main>
