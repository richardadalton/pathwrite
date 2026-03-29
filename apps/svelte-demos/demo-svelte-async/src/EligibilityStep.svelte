<script lang="ts">
  import { usePathContext } from "@daltonr/pathwrite-svelte";
  import type { ApplicationData } from "@daltonr/pathwrite-demo-workflow-job-application";

  const ctx = usePathContext<ApplicationData>();

  // validationDisplay="inline" suppresses the shell's blockingError rendering —
  // we render it here instead.
  let blockingError = $derived(ctx.snapshot?.hasAttemptedNext ? ctx.snapshot.blockingError : null);
  let guardRunning  = $derived(ctx.snapshot?.status === "validating");
</script>

{#if ctx.snapshot}
  <div class="form-body">
    <p class="step-intro">
      Clicking <strong>Next</strong> runs an async eligibility check against our API.
      The check takes ~900ms — watch the spinner on the button.
    </p>

    <div class="eligibility-summary">
      <div class="summary-row">
        <span class="summary-key">Role</span>
        <span>{ctx.snapshot.data.roleId || "—"}</span>
      </div>
      <div class="summary-row">
        <span class="summary-key">Experience</span>
        <span>{ctx.snapshot.data.yearsExperience ? `${ctx.snapshot.data.yearsExperience} years` : "—"}</span>
      </div>
      <div class="summary-row">
        <span class="summary-key">Skills</span>
        <span>{ctx.snapshot.data.skills || "—"}</span>
      </div>
    </div>

    {#if blockingError}
      <p class="field-error" style="margin-top: 12px">{blockingError}</p>
    {/if}

    {#if !guardRunning}
      <p class="hint">
        <strong>What's happening:</strong> <code>canMoveNext</code> is async — it calls
        <code>services.checkEligibility()</code> and the engine awaits the result before deciding
        whether to advance. While it runs, <code>snapshot.status === "validating"</code>, and the
        shell shows a CSS spinner on the Next button. If blocked, we render
        <code>snapshot.blockingError</code> here (since <code>validationDisplay="inline"</code>
        suppresses the shell's own rendering).
      </p>
    {/if}
  </div>
{/if}
