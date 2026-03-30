<script lang="ts">
  import { PathShell, usePathContext } from "@daltonr/pathwrite-svelte";
  import type { PathEvent, PathSnapshot } from "@daltonr/pathwrite-svelte";
  import { employeeDetailsPath, DETAILS_INITIAL, type EmployeeDetails } from "./employee-details";
  import type { OnboardingData } from "./onboarding";
  import PersonalTab    from "./tabs/PersonalTab.svelte";
  import DepartmentTab  from "./tabs/DepartmentTab.svelte";
  import EquipmentTab   from "./tabs/EquipmentTab.svelte";
  import RolesTab       from "./tabs/RolesTab.svelte";

  const ctx = usePathContext<OnboardingData>();

  let initialDetails = $derived<EmployeeDetails>({
    ...DETAILS_INITIAL,
    ...(ctx.snapshot.data.details as Partial<EmployeeDetails> ?? {}),
  });

  function handleInnerEvent(event: PathEvent) {
    if (event.type === "stateChanged") {
      ctx.setData("details", (event.snapshot as PathSnapshot<EmployeeDetails>).data);
    }
  }
</script>

<div class="nested-shell-wrapper">
  <p class="step-intro">
    Fill in details for <strong>{ctx.snapshot.data.employeeName}</strong> using the tabs below.
    Switch between tabs freely — data is saved as you type.
    First name, last name, department, and job title are required before proceeding.
  </p>

  <PathShell
    path={employeeDetailsPath}
    initialData={initialDetails}
    hideProgress={true}
    hideCancel={true}
    hideFooter={true}
    validateWhen={ctx.snapshot?.hasAttemptedNext}
    validationDisplay="inline"
    onevent={handleInnerEvent}
    personal={PersonalTab}
    department={DepartmentTab}
    equipment={EquipmentTab}
    roles={RolesTab}
  />
</div>
