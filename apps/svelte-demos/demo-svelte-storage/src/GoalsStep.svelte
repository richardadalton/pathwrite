<script lang="ts">
  import { getPathContext } from "@daltonr/pathwrite-svelte";
  import type { ProfileSubData } from "./wizard";

  const ctx = getPathContext<ProfileSubData>();
  let errors = $derived(ctx.snapshot?.hasAttemptedNext ? ctx.snapshot.fieldErrors : {});
</script>

{#if ctx.snapshot}
  {@const d = ctx.snapshot.data}
  <div class="form-body">
    <!-- Who we're filling in for -->
    <div class="subwizard-context">
      <p class="subwizard-for">Setting goals for</p>
      <p class="subwizard-name">{d.memberName}</p>
    </div>

    <!-- 30-day goals -->
    <div class="field" class:field--error={errors.goals30}>
      <label for="goals30">
        30-Day Goals <span class="required">*</span>
        <span class="field-hint">First month priorities</span>
      </label>
      <textarea
        id="goals30"
        rows="6"
        placeholder="What should this person achieve in their first 30 days? Think about: getting set up with tools and access, meeting key stakeholders, completing any required training, and making one or two small early contributions."
        value={d.goals30 ?? ""}
        oninput={(e) => ctx.setData("goals30", e.currentTarget.value)}
      ></textarea>
      {#if errors.goals30}<p class="field-error">{errors.goals30}</p>{/if}
    </div>

    <!-- 90-day goals -->
    <div class="field" class:field--error={errors.goals90}>
      <label for="goals90">
        90-Day Goals <span class="required">*</span>
        <span class="field-hint">Full quarter ownership</span>
      </label>
      <textarea
        id="goals90"
        rows="6"
        placeholder="What does success look like after 90 days? Describe the areas they should own independently, projects they should be driving, team relationships they should have built, and metrics you'll use to evaluate their progress."
        value={d.goals90 ?? ""}
        oninput={(e) => ctx.setData("goals90", e.currentTarget.value)}
      ></textarea>
      {#if errors.goals90}<p class="field-error">{errors.goals90}</p>{/if}
    </div>
  </div>
{/if}
