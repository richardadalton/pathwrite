<script lang="ts">
  import { usePathContext } from "@daltonr/pathwrite-svelte";
  import type { ApplicationData } from "@daltonr/pathwrite-demo-workflow-job-application";

  const ctx = usePathContext<ApplicationData>();
  let errors = $derived(ctx.snapshot?.hasAttemptedNext ? ctx.snapshot.fieldErrors : {});
</script>

{#if ctx.snapshot}
  <div class="form-body">
    <p class="step-intro">
      Tell us about your background. The next step will run an async eligibility
      check — try entering <strong>less than 2 years</strong> to see the guard block navigation.
    </p>

    <div class="field" class:field--error={errors.yearsExperience}>
      <label for="years">Years of Relevant Experience</label>
      <input
        id="years"
        type="number"
        min="0"
        step="1"
        value={ctx.snapshot.data.yearsExperience}
        oninput={(e) => ctx.setData("yearsExperience", e.currentTarget.value)}
        placeholder="e.g. 3"
      />
      {#if errors.yearsExperience}<span class="field-error">{errors.yearsExperience}</span>{/if}
    </div>

    <div class="field" class:field--error={errors.skills}>
      <label for="skills">Key Skills</label>
      <input
        id="skills"
        type="text"
        value={ctx.snapshot.data.skills}
        oninput={(e) => ctx.setData("skills", e.currentTarget.value)}
        placeholder="e.g. TypeScript, React, Node.js"
      />
      {#if errors.skills}<span class="field-error">{errors.skills}</span>{/if}
    </div>
  </div>
{/if}
