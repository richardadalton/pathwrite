<script lang="ts">
  import { usePathContext } from "@daltonr/pathwrite-svelte";
  import type { OnboardingData } from "./onboarding";

  const ctx = usePathContext<OnboardingData>();
  let errors = $derived(ctx.snapshot?.hasAttemptedNext ? ctx.snapshot.fieldErrors ?? {} : {});
</script>

{#if ctx.snapshot}
  <div class="form-body">
    <p class="step-intro">
      Enter the new employee's full name to begin their onboarding record.
    </p>
    <div class="field" class:field--error={errors.employeeName}>
      <label for="employeeName">Full Name <span class="required">*</span></label>
      <input
        id="employeeName"
        type="text"
        value={ctx.snapshot.data.employeeName ?? ""}
        oninput={(e) => ctx.setData("employeeName", e.currentTarget.value)}
        placeholder="e.g. Jane Smith"
        autocomplete="name"
      />
      {#if errors.employeeName}<span class="field-error">{errors.employeeName}</span>{/if}
    </div>
  </div>
{/if}
