<script lang="ts">
  import { usePathContext } from "@daltonr/pathwrite-svelte";
  import type { ApplicationData } from "@daltonr/pathwrite-demo-workflow-job-application";

  const ctx = usePathContext<ApplicationData>();
  let errors = $derived(ctx.snapshot?.hasAttemptedNext ? ctx.snapshot.fieldErrors : {});
</script>

{#if ctx.snapshot}
  <div class="form-body">
    <p class="step-intro">
      This step uses an async <code>shouldSkip</code>. Selecting
      <strong>Software Engineer</strong> or <strong>Data Scientist</strong> on the first step
      routes here; other roles skip straight to Review. Notice how the progress bar step count
      updates once the skip resolves.
    </p>

    <div class="field" class:field--error={errors.coverLetter}>
      <label for="coverLetter">Cover Letter</label>
      <textarea
        id="coverLetter"
        rows={5}
        value={ctx.snapshot.data.coverLetter}
        oninput={(e) => ctx.setData("coverLetter", e.currentTarget.value)}
        placeholder="Tell us why you're a great fit for this role…"
      ></textarea>
      {#if errors.coverLetter}<span class="field-error">{errors.coverLetter}</span>{/if}
    </div>

    <p class="hint">
      <strong>What's happening:</strong> <code>shouldSkip</code> called
      <code>services.requiresCoverLetter(roleId)</code> asynchronously. Before that resolved,
      <code>snapshot.stepCount</code> included this step optimistically. Once navigation walked
      past it, the engine cached the result in <code>resolvedSkips</code> and the progress bar
      reflects the true visible count.
    </p>
  </div>
{/if}
