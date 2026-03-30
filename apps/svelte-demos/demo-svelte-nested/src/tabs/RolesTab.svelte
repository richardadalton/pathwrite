<script lang="ts">
  import { usePathContext } from "@daltonr/pathwrite-svelte";
  import type { EmployeeDetails } from "../employee-details";
  import TabBar from "./TabBar.svelte";

  const PERMISSIONS = [
    { key: "permAdmin",   label: "Admin Access",     desc: "Full system administration" },
    { key: "permDev",     label: "Developer Access",  desc: "Code repositories & CI/CD pipelines" },
    { key: "permHR",      label: "HR Access",         desc: "Personnel records & payroll" },
    { key: "permFinance", label: "Finance Access",    desc: "Accounting & expense systems" },
  ] as const;

  const ctx = usePathContext<EmployeeDetails>();

  let errors = $derived(
    ctx.snapshot?.hasAttemptedNext || ctx.snapshot?.hasValidated
      ? ctx.snapshot?.fieldErrors ?? {}
      : {}
  );
</script>

<div class="tab-content">
  <TabBar />
  <div class="form-body">
    <div class="field" class:field--error={errors.jobTitle}>
      <label for="jobTitle">Job Title <span class="required">*</span></label>
      <input
        id="jobTitle"
        type="text"
        value={ctx.snapshot.data.jobTitle ?? ""}
        oninput={(e) => ctx.setData("jobTitle", e.currentTarget.value)}
        placeholder="e.g. Senior Software Engineer"
      />
      {#if errors.jobTitle}<span class="field-error">{errors.jobTitle}</span>{/if}
    </div>

    <div class="perm-section">
      <p class="pref-label">System Permissions</p>
      <div class="perm-list">
        {#each PERMISSIONS as perm (perm.key)}
          <label class="perm-option">
            <div class="perm-text">
              <span class="perm-label">{perm.label}</span>
              <span class="perm-desc">{perm.desc}</span>
            </div>
            <div class="toggle">
              <input
                type="checkbox"
                checked={(ctx.snapshot.data[perm.key] ?? "no") === "yes"}
                onchange={(e) => ctx.setData(perm.key, e.currentTarget.checked ? "yes" : "no")}
              />
              <span class="toggle-track"></span>
              <span class="toggle-thumb"></span>
            </div>
          </label>
        {/each}
      </div>
    </div>
  </div>
</div>
