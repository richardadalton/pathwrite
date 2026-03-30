<script lang="ts">
  import { usePathContext } from "@daltonr/pathwrite-svelte";
  import type { OnboardingData } from "./onboarding";
  import type { EmployeeDetails } from "./employee-details";
  import { LAPTOP_TYPES } from "./employee-details";

  const ctx = usePathContext<OnboardingData>();

  function laptopLabel(val: string) {
    return LAPTOP_TYPES.find(l => l.value === val)?.label ?? val;
  }

  function yesNo(val: string | undefined) {
    return val === "yes" ? "Yes" : "No";
  }

  let d = $derived((ctx.snapshot.data.details ?? {}) as EmployeeDetails);

  let activePerms = $derived([
    d.permAdmin   === "yes" && "Admin",
    d.permDev     === "yes" && "Developer",
    d.permHR      === "yes" && "HR",
    d.permFinance === "yes" && "Finance",
  ].filter(Boolean) as string[]);
</script>

<div class="form-body">
  <p class="step-intro">
    Review the details below. Click <strong>Complete Onboarding</strong> to submit,
    or use <strong>Previous</strong> to go back and make changes.
  </p>

  <div class="review-section">
    <p class="section-title">Employee</p>
    <div class="review-card">
      <div class="review-row">
        <span class="review-key">Name</span>
        <span>{ctx.snapshot.data.employeeName}</span>
      </div>
    </div>
  </div>

  <div class="review-section">
    <p class="section-title">Personal</p>
    <div class="review-card">
      <div class="review-row">
        <span class="review-key">Full Name</span>
        <span>{[d.firstName, d.lastName].filter(Boolean).join(" ") || "—"}</span>
      </div>
      {#if d.dateOfBirth}
        <div class="review-row">
          <span class="review-key">Date of Birth</span>
          <span>{d.dateOfBirth}</span>
        </div>
      {/if}
      {#if d.phone}
        <div class="review-row">
          <span class="review-key">Phone</span>
          <span>{d.phone}</span>
        </div>
      {/if}
      {#if d.personalEmail}
        <div class="review-row">
          <span class="review-key">Personal Email</span>
          <span>{d.personalEmail}</span>
        </div>
      {/if}
    </div>
  </div>

  <div class="review-section">
    <p class="section-title">Department</p>
    <div class="review-card">
      <div class="review-row">
        <span class="review-key">Department</span>
        <span>{d.department || "—"}</span>
      </div>
      {#if d.manager}
        <div class="review-row">
          <span class="review-key">Manager</span>
          <span>{d.manager}</span>
        </div>
      {/if}
      {#if d.office}
        <div class="review-row">
          <span class="review-key">Office</span>
          <span>{d.office}</span>
        </div>
      {/if}
      {#if d.startDate}
        <div class="review-row">
          <span class="review-key">Start Date</span>
          <span>{d.startDate}</span>
        </div>
      {/if}
    </div>
  </div>

  <div class="review-section">
    <p class="section-title">Equipment</p>
    <div class="review-card">
      <div class="review-row">
        <span class="review-key">Laptop</span>
        <span>{laptopLabel(d.laptopType ?? "macbook-pro")}</span>
      </div>
      <div class="review-row">
        <span class="review-key">Mobile Phone</span>
        <span>{yesNo(d.needsPhone)}</span>
      </div>
      <div class="review-row">
        <span class="review-key">Access Card</span>
        <span>{yesNo(d.needsAccessCard)}</span>
      </div>
      {#if d.otherEquipment}
        <div class="review-row">
          <span class="review-key">Other</span>
          <span>{d.otherEquipment}</span>
        </div>
      {/if}
    </div>
  </div>

  <div class="review-section">
    <p class="section-title">Roles &amp; Permissions</p>
    <div class="review-card">
      <div class="review-row">
        <span class="review-key">Job Title</span>
        <span>{d.jobTitle || "—"}</span>
      </div>
      <div class="review-row">
        <span class="review-key">Permissions</span>
        <span>
          {#if activePerms.length > 0}
            {#each activePerms as perm}
              <span class="badge badge--on" style="margin-right: 4px">{perm}</span>
            {/each}
          {:else}
            <span class="badge badge--off">None</span>
          {/if}
        </span>
      </div>
    </div>
  </div>
</div>
