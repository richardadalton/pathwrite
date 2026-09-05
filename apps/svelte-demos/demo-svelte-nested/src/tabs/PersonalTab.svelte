<script lang="ts">
  import { usePathContext } from "@daltonr/pathwrite-svelte";
  import type { EmployeeDetails } from "../employee-details";
  import TabBar from "./TabBar.svelte";

  const ctx = usePathContext<EmployeeDetails>();

  // A step component only renders while a path is active, so the snapshot is present.

  const snapshot = $derived(ctx.snapshot!);

  let errors = $derived(
    snapshot.hasAttemptedNext || snapshot.hasValidated ? (snapshot.fieldErrors ?? {}) : {}
  );
</script>

<div class="tab-content">
  <TabBar />
  <div class="form-body">
    <div class="row">
      <div class="field" class:field--error={errors.firstName}>
        <label for="firstName">First Name <span class="required">*</span></label>
        <input
          id="firstName"
          type="text"
          value={snapshot.data.firstName ?? ""}
          oninput={(e) => ctx.setData("firstName", e.currentTarget.value)}
          placeholder="Jane"
          autocomplete="given-name"
        />
        {#if errors.firstName}<span class="field-error">{errors.firstName}</span>{/if}
      </div>
      <div class="field" class:field--error={errors.lastName}>
        <label for="lastName">Last Name <span class="required">*</span></label>
        <input
          id="lastName"
          type="text"
          value={snapshot.data.lastName ?? ""}
          oninput={(e) => ctx.setData("lastName", e.currentTarget.value)}
          placeholder="Smith"
          autocomplete="family-name"
        />
        {#if errors.lastName}<span class="field-error">{errors.lastName}</span>{/if}
      </div>
    </div>

    <div class="field">
      <label for="dateOfBirth">Date of Birth <span class="optional">(optional)</span></label>
      <input
        id="dateOfBirth"
        type="date"
        value={snapshot.data.dateOfBirth ?? ""}
        oninput={(e) => ctx.setData("dateOfBirth", e.currentTarget.value)}
      />
    </div>

    <div class="field">
      <label for="phone">Phone Number <span class="optional">(optional)</span></label>
      <input
        id="phone"
        type="tel"
        value={snapshot.data.phone ?? ""}
        oninput={(e) => ctx.setData("phone", e.currentTarget.value)}
        placeholder="+353 86 123 4567"
        autocomplete="tel"
      />
    </div>

    <div class="field">
      <label for="personalEmail">Personal Email <span class="optional">(optional)</span></label>
      <input
        id="personalEmail"
        type="email"
        value={snapshot.data.personalEmail ?? ""}
        oninput={(e) => ctx.setData("personalEmail", e.currentTarget.value)}
        placeholder="jane@personal.com"
        autocomplete="email"
      />
    </div>
  </div>
</div>
