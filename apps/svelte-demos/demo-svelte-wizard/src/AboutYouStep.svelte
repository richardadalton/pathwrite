<script lang="ts">
  import { getPathContext } from "@daltonr/pathwrite-svelte";
  import type { OnboardingData } from "./onboarding";

  const ctx = getPathContext<OnboardingData>();
  let errors = $derived(ctx.snapshot?.hasAttemptedNext ? ctx.snapshot.fieldErrors : {});

  const EXPERIENCE_OPTIONS = [
    { value: "junior", label: "Junior (0–2 years)" },
    { value: "mid",    label: "Mid-level (3–5 years)" },
    { value: "senior", label: "Senior (6–10 years)" },
    { value: "lead",   label: "Lead / Principal (10+ years)" },
  ];
</script>

{#if ctx.snapshot}
  <div class="form-body">
    <p class="step-intro">Tell us a bit about your professional background.</p>

    <div class="field" class:field--error={errors.jobTitle}>
      <label for="jobTitle">Job Title <span class="required">*</span></label>
      <input id="jobTitle" type="text" value={ctx.snapshot.data.jobTitle ?? ""}
        oninput={(e) => ctx.setData("jobTitle", e.currentTarget.value.trim())}
        placeholder="e.g. Frontend Developer" autocomplete="organization-title" autofocus />
      {#if errors.jobTitle}<span class="field-error">{errors.jobTitle}</span>{/if}
    </div>

    <div class="field">
      <label for="company">Company <span class="optional">(optional)</span></label>
      <input id="company" type="text" value={ctx.snapshot.data.company ?? ""}
        oninput={(e) => ctx.setData("company", e.currentTarget.value.trim())}
        placeholder="e.g. Acme Corp" autocomplete="organization" />
    </div>

    <div class="field" class:field--error={errors.experience}>
      <label for="experience">Experience Level <span class="required">*</span></label>
      <select id="experience" value={ctx.snapshot.data.experience ?? ""}
        onchange={(e) => ctx.setData("experience", e.currentTarget.value)}>
        <option value="" disabled selected>Select your level…</option>
        {#each EXPERIENCE_OPTIONS as o}
          <option value={o.value}>{o.label}</option>
        {/each}
      </select>
      {#if errors.experience}<span class="field-error">{errors.experience}</span>{/if}
    </div>
  </div>
{/if}

