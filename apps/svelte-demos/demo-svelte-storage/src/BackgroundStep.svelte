<script lang="ts">
  import { usePathContext } from "@daltonr/pathwrite-svelte";
  import type { ProfileSubData } from "./wizard";

  const ctx = usePathContext<ProfileSubData>();
  let errors = $derived(ctx.snapshot?.hasAttemptedNext ? ctx.snapshot.fieldErrors : {});
</script>

{#if ctx.snapshot}
  {@const d = ctx.snapshot.data}
  <div class="form-body">
    <!-- Who we're filling in for -->
    <div class="subwizard-context">
      <p class="subwizard-for">Completing profile for</p>
      <p class="subwizard-name">
        {d.memberName}
        {#if d.memberRole}<span class="subwizard-role"> — {d.memberRole}</span>{/if}
      </p>
    </div>

    <!-- Department -->
    <div class="field" class:field--error={errors.department}>
      <label for="department">Department <span class="required">*</span></label>
      <input
        id="department"
        type="text"
        placeholder="e.g. Engineering, Design, Product, Marketing…"
        value={d.department ?? ""}
        oninput={(e) => ctx.setData("department", e.currentTarget.value)}
      />
      {#if errors.department}<p class="field-error">{errors.department}</p>{/if}
    </div>

    <!-- Start date -->
    <div class="field" class:field--error={errors.startDate}>
      <label for="start-date">Start Date <span class="required">*</span></label>
      <input
        id="start-date"
        type="date"
        value={d.startDate ?? ""}
        onchange={(e) => ctx.setData("startDate", e.currentTarget.value)}
      />
      {#if errors.startDate}<p class="field-error">{errors.startDate}</p>{/if}
    </div>

    <!-- Bio -->
    <div class="field" class:field--error={errors.bio}>
      <label for="bio">
        Short Bio <span class="required">*</span>
        <span class="field-hint">Introduce this person to the team</span>
      </label>
      <textarea
        id="bio"
        rows="6"
        placeholder="Describe their background, previous experience, what drew them to this role, and what they'll bring to the team."
        value={d.bio ?? ""}
        oninput={(e) => ctx.setData("bio", e.currentTarget.value)}
      ></textarea>
      {#if errors.bio}<p class="field-error">{errors.bio}</p>{/if}
    </div>
  </div>
{/if}
