<script lang="ts">
  import { getPathContext } from "@daltonr/pathwrite-svelte";
  import type { OnboardingData } from "./onboarding";

  const ctx = getPathContext<OnboardingData>();
  let errors = $derived(ctx.snapshot?.hasAttemptedNext ? ctx.snapshot.fieldErrors : {});
</script>

{#if ctx.snapshot}
  <div class="form-body">
    <p class="step-intro">Let's start with the basics — we just need a name and email.</p>

    <div class="row">
      <div class="field" class:field--error={errors.firstName}>
        <label for="firstName">First Name <span class="required">*</span></label>
        <input id="firstName" type="text" value={ctx.snapshot.data.firstName ?? ""}
          oninput={(e) => ctx.setData("firstName", e.currentTarget.value.trim())}
          placeholder="Jane" autocomplete="given-name" autofocus />
        {#if errors.firstName}<span class="field-error">{errors.firstName}</span>{/if}
      </div>
      <div class="field" class:field--error={errors.lastName}>
        <label for="lastName">Last Name <span class="required">*</span></label>
        <input id="lastName" type="text" value={ctx.snapshot.data.lastName ?? ""}
          oninput={(e) => ctx.setData("lastName", e.currentTarget.value.trim())}
          placeholder="Smith" autocomplete="family-name" />
        {#if errors.lastName}<span class="field-error">{errors.lastName}</span>{/if}
      </div>
    </div>

    <div class="field" class:field--error={errors.email}>
      <label for="email">Email Address <span class="required">*</span></label>
      <input id="email" type="email" value={ctx.snapshot.data.email ?? ""}
        oninput={(e) => ctx.setData("email", e.currentTarget.value.trim())}
        placeholder="jane@example.com" autocomplete="email" />
      {#if errors.email}<span class="field-error">{errors.email}</span>{/if}
    </div>
  </div>
{/if}

