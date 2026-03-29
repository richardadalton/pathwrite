<script lang="ts">
  import { usePathContext } from "@daltonr/pathwrite-svelte";
  import type { ApplicationData } from "@daltonr/pathwrite-demo-workflow-job-application";

  const ctx = usePathContext<ApplicationData>();
</script>

{#if ctx.snapshot}
  <div class="form-body">
    <p class="step-intro">All async checks passed. Review your application before submitting.</p>

    <div class="eligibility-summary">
      <div class="summary-row">
        <span class="summary-key">Role</span>
        <span>{ctx.snapshot.data.roleId}</span>
      </div>
      <div class="summary-row">
        <span class="summary-key">Experience</span>
        <span>{ctx.snapshot.data.yearsExperience} years</span>
      </div>
      <div class="summary-row">
        <span class="summary-key">Skills</span>
        <span>{ctx.snapshot.data.skills}</span>
      </div>
      {#if ctx.snapshot.data.coverLetter}
        <div class="summary-row">
          <span class="summary-key">Cover Letter</span>
          <span>{ctx.snapshot.data.coverLetter}</span>
        </div>
      {/if}
    </div>
  </div>
{/if}
