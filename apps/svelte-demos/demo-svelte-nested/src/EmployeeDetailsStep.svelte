<script lang="ts">
  import { PathShell, usePathContext } from "@daltonr/pathwrite-svelte";
  import { employeeDetailsPath, DETAILS_INITIAL } from "./employee-details";
  import type { OnboardingData } from "./onboarding";
  import PersonalTab from "./tabs/PersonalTab.svelte";
  import DepartmentTab from "./tabs/DepartmentTab.svelte";
  import EquipmentTab from "./tabs/EquipmentTab.svelte";
  import RolesTab from "./tabs/RolesTab.svelte";

  const ctx = usePathContext<OnboardingData>();

  // A step component only renders while a path is active, so the snapshot is present.

  const snapshot = $derived(ctx.snapshot!);
</script>

<div class="nested-shell-wrapper">
  <p class="step-intro">
    Fill in details for <strong>{snapshot.data.employeeName}</strong> using the tabs below. Switch between tabs
    freely — data is saved as you type. First name, last name, department, and job title are required before proceeding.
  </p>

  <PathShell
    path={employeeDetailsPath}
    initialData={DETAILS_INITIAL}
    restoreKey="details"
    layout="tabs"
    validateWhen={snapshot.hasAttemptedNext}
    validationDisplay="inline"
    personal={PersonalTab}
    department={DepartmentTab}
    equipment={EquipmentTab}
    roles={RolesTab}
  />
</div>
