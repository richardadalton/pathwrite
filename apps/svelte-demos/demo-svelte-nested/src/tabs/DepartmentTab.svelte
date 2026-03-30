<script lang="ts">
  import { usePathContext } from "@daltonr/pathwrite-svelte";
  import type { EmployeeDetails } from "../employee-details";
  import { DEPARTMENTS, OFFICES } from "../employee-details";
  import TabBar from "./TabBar.svelte";

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
    <div class="field" class:field--error={errors.department}>
      <label for="department">Department <span class="required">*</span></label>
      <select
        id="department"
        value={ctx.snapshot.data.department ?? ""}
        onchange={(e) => ctx.setData("department", e.currentTarget.value)}
      >
        <option value="">Select a department…</option>
        {#each DEPARTMENTS as dept (dept)}
          <option value={dept}>{dept}</option>
        {/each}
      </select>
      {#if errors.department}<span class="field-error">{errors.department}</span>{/if}
    </div>

    <div class="field">
      <label for="manager">Reporting Manager <span class="optional">(optional)</span></label>
      <input
        id="manager"
        type="text"
        value={ctx.snapshot.data.manager ?? ""}
        oninput={(e) => ctx.setData("manager", e.currentTarget.value)}
        placeholder="e.g. John Murphy"
      />
    </div>

    <div class="field">
      <label for="office">Office Location <span class="optional">(optional)</span></label>
      <select
        id="office"
        value={ctx.snapshot.data.office ?? ""}
        onchange={(e) => ctx.setData("office", e.currentTarget.value)}
      >
        <option value="">Select an office…</option>
        {#each OFFICES as office (office)}
          <option value={office}>{office}</option>
        {/each}
      </select>
    </div>

    <div class="field">
      <label for="startDate">Start Date <span class="optional">(optional)</span></label>
      <input
        id="startDate"
        type="date"
        value={ctx.snapshot.data.startDate ?? ""}
        oninput={(e) => ctx.setData("startDate", e.currentTarget.value)}
      />
    </div>
  </div>
</div>
