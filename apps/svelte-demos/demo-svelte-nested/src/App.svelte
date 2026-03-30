<script lang="ts">
  import { PathShell } from "@daltonr/pathwrite-svelte";
  import { employeeOnboardingPath, ONBOARDING_INITIAL, type OnboardingData } from "./onboarding";
  import EnterNameStep      from "./EnterNameStep.svelte";
  import EmployeeDetailsStep from "./EmployeeDetailsStep.svelte";
  import ConfirmStep        from "./ConfirmStep.svelte";

  let isCompleted   = $state(false);
  let isCancelled   = $state(false);
  let completedData = $state<OnboardingData | null>(null);

  function handleComplete(data: OnboardingData) {
    completedData = data;
    isCompleted = true;
  }

  function handleCancel(_data: OnboardingData) {
    isCancelled = true;
  }

  function startOver() {
    isCompleted   = false;
    isCancelled   = false;
    completedData = null;
  }
</script>

<main class="page">
  <div class="page-header">
    <h1>Employee Onboarding</h1>
    <p class="subtitle">A nested wizard — outer 3-step path with an inner tabbed PathShell.</p>
  </div>

  <!-- Completed -->
  {#if isCompleted && completedData}
    <section class="result-panel success-panel">
      <div class="result-icon">🎉</div>
      <h2>Onboarding Complete!</h2>
      <p>The record for <strong>{completedData.employeeName}</strong> has been submitted.</p>
      <button class="btn-primary" onclick={startOver}>Start Over</button>
    </section>
  {/if}

  <!-- Cancelled -->
  {#if isCancelled}
    <section class="result-panel cancel-panel">
      <div class="result-icon">✖</div>
      <h2>Onboarding Cancelled</h2>
      <p>No record was saved.</p>
      <button class="btn-secondary" onclick={startOver}>Try Again</button>
    </section>
  {/if}

  <!-- Active wizard -->
  {#if !isCompleted && !isCancelled}
    <PathShell
      path={employeeOnboardingPath}
      initialData={ONBOARDING_INITIAL}
      completeLabel="Complete Onboarding"
      cancelLabel="Cancel"
      validationDisplay="inline"
      oncomplete={handleComplete}
      oncancel={handleCancel}
      enterName={EnterNameStep}
      employeeDetails={EmployeeDetailsStep}
      confirm={ConfirmStep}
    />
  {/if}
</main>
